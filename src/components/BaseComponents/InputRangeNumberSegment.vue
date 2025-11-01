<template>
  <div class="flex w-full flex-col justify-center" ref="componentRef" v-bind="$attrs">
    <input
      v-if="hasFocus"
      class="label"
      ref="labelRef"
      placeholder="Segment Label"
      @focus="handleComponentFocusIn"
      @blur="handleComponentFocusOut"
      @keypress.enter="handleComponentFocusOut(null)"
      type="text"
      v-model="innerModelValue.label" />
    <div
      v-else-if="innerModelValue.label"
      class="text-center mb-1 cursor-default"
      @click="handleComponentFocusIn($event, true)">
      {{ innerModelValue.label }}
    </div>
    <div v-if="props.format === 'time'" class="flex gap-1 items-center justify-center">
      <InputTimeFormatted
        ref="startTimeInputRef"
        class="text-input"
        v-model="innerModelValue.start"
        @focusin="handleComponentFocusIn"
        @focusout="handleComponentFocusOut"
        :min="props.min"
        :max="props.max"
        :step="props.step"
        :big-step="props.bigStep" />
      <InputTimeFormatted
        ref="endTimeInputRef"
        class="text-input"
        v-model="innerModelValue.end"
        @focusin="handleComponentFocusIn"
        @focusout="handleComponentFocusOut"
        :min="props.min"
        :max="props.max"
        :step="props.step"
        :big-step="props.bigStep" />
    </div>
    <div v-else class="flex gap-1 items-center justify-center">
      <input-text-number
        ref="startTimeInputRef"
        class="text-input"
        v-model="innerModelValue.start"
        @focusin="handleComponentFocusIn"
        @focusout="handleComponentFocusOut"
        :min="props.min"
        :max="props.max"
        :step="props.step"
        :big-step="props.bigStep" />
      <input-text-number
        ref="endTimeInputRef"
        class="text-input"
        v-model="innerModelValue.end"
        @focusin="handleComponentFocusIn"
        @focusout="handleComponentFocusOut"
        :min="props.min"
        :max="props.max"
        :step="props.step"
        :big-step="props.bigStep" />
    </div>
    <div class="segment-line" ref="containerRef">
      <button
        title="start"
        class="range-handle"
        tabindex="0"
        :style="{ left: `${startPosition}px` }"
        @focusin="handleComponentFocusIn"
        @focusout="handleComponentFocusOut"
        @mousedown="handleMouseDown($event, 'start')"
        @keydown.left.prevent="adjustValue($event, 'start', -props.step)"
        @keydown.right.prevent="adjustValue($event, 'start', props.step)"
        @keydown.up.prevent="adjustValue($event, 'start', props.step)"
        @keydown.down.prevent="adjustValue($event, 'start', -props.step)"
        @keydown.page-up.prevent="adjustValue($event, 'start', props.bigStep)"
        @keydown.page-down.prevent="adjustValue($event, 'start', -props.bigStep)" />
      <div
        class="range-line"
        :style="{
          left: lineStartPosition + handleWidthInPx / 2 + 'px',
          width: lineWidth + 'px',
        }" />
      <button
        class="range-handle"
        ref="endRangeHandleRef"
        @focusin="handleComponentFocusIn"
        @focusout="handleComponentFocusOut"
        :style="{ left: `${endPosition}px` }"
        @mousedown="handleMouseDown($event, 'end')"
        @keydown.left.prevent="adjustValue($event, 'end', -props.step)"
        @keydown.right.prevent="adjustValue($event, 'end', props.step)"
        @keydown.up.prevent="adjustValue($event, 'end', props.step)"
        @keydown.down.prevent="adjustValue($event, 'end', -props.step)"
        @keydown.page-up.prevent="adjustValue($event, 'end', props.bigStep)"
        @keydown.page-down.prevent="adjustValue($event, 'end', -props.bigStep)" />
      <input
        class="range-input"
        type="range"
        title="end"
        ref="rangeEndRef"
        tabindex="-1"
        :value="higherValue"
        @input="handleInput($event, 'end')"
        @change="handleInput($event, 'end')"
        @focus="endRangeHandleRef?.focus()"
        :min="min"
        :max="max"
        :step="step"
        @keydown.page-up.prevent="adjustValue($event, 'end', props.bigStep)"
        @keydown.page-down.prevent="adjustValue($event, 'end', -props.bigStep)"
        v-bind="$attrs" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { SoundSegment } from '@/src/@types/sound'
import { useModel, ref, computed, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: SoundSegment
    min?: number
    max?: number
    step?: number
    bigStep?: number
    precision?: number
    format?: 'number' | 'time'
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    bigStep: 10,
    precision: 2,
    format: 'number',
  }
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: SoundSegment): void
  (event: 'focus', target: HTMLElement): void
  (event: 'blur'): void
}>()

const innerModelValue = useModel(props, 'modelValue')
const componentRef = ref<HTMLElement>()
const containerRef = ref<HTMLElement>()
const isDragging = ref<'start' | 'end' | null>(null)
const rangeEndRef = ref<HTMLInputElement>()
const endRangeHandleRef = ref<HTMLButtonElement>()
const startTimeInputRef = ref<HTMLInputElement>()
const endTimeInputRef = ref<HTMLInputElement>()
const previousValue = ref<SoundSegment | null>(null)
const labelRef = ref<HTMLInputElement>()
const ignoreWatch = ref(false)
const hasFocus = ref(false)

watch(
  () => innerModelValue.value,
  newValue => {
    if (ignoreWatch.value) return
    if (previousValue.value && newValue.start > newValue.end) {
      handleFlippedFocus(previousValue.value, newValue)
    }
    if (newValue.label === '') {
      delete newValue.label
      ignoreWatch.value = true
    }
    previousValue.value = { ...newValue }
  },
  { immediate: true, deep: true }
)

const handleWidthInPx = computed(() => {
  if (!containerRef.value) return 0
  const handleWidth = getComputedStyle(containerRef.value).getPropertyValue('--thumb-size')
  return parseFloat(handleWidth)
})

const containerWidth2 = ref(0)

onMounted(() => {
  if (rangeEndRef.value) {
    function updateWidth(width: number): void {
      if (!rangeEndRef.value) return
      containerWidth2.value = width - handleWidthInPx.value / 2 + 1 - handleWidthInPx.value / 2
    }
    updateWidth(rangeEndRef.value.offsetWidth) // Set initial width
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        updateWidth(entry.contentRect.width)
      }
    })
    resizeObserver.observe(rangeEndRef.value)
    onUnmounted(() => {
      resizeObserver.disconnect()
    })
  }
})

function isNode(target: EventTarget | null): target is Node {
  return target !== null && target instanceof Node
}

function handleComponentFocusIn(_event: FocusEvent, focusLabel = false) {
  if (focusLabel) {
    hasFocus.value = true
    nextTick(() => {
      labelRef.value?.focus()
    })
    return
  }
  if (hasFocus.value || !componentRef.value) return
  emit('focus', componentRef.value)

  hasFocus.value = true
}

function handleComponentFocusOut(event: FocusEvent | null) {
  // For focusout events, check where focus is going (relatedTarget)
  const relatedTarget = event?.relatedTarget || null

  // If relatedTarget is null, focus is leaving the document entirely
  if (relatedTarget === null) {
    hasFocus.value = false
    emit('blur')
    return
  }

  // Check if the element gaining focus is still within this component
  if (isNode(relatedTarget)) {
    if (componentRef.value && !componentRef.value.contains(relatedTarget)) {
      hasFocus.value = false
      emit('blur')
    }
    // If relatedTarget IS within the component, don't emit blur
  } else {
    // relatedTarget exists but isn't a Node (shouldn't happen in practice)
    hasFocus.value = false
    emit('blur')
  }
}

// Calculate the position of the start handle based on the value
const startPosition = computed(() => {
  return getPosition(innerModelValue.value.start, 0, containerWidth2)
})

const endPosition = computed(() => {
  const endPositionValue = getPosition(innerModelValue.value.end, 0, containerWidth2)
  return endPositionValue
})

const lineStartPosition = computed(() => {
  return Math.min(startPosition.value, endPosition.value)
})

// this is a computed that will find the lowest value between props.min and props.max, just in case they put them in backwards
const minValue = computed(() => Math.min(props.min, props.max))
const maxValue = computed(() => Math.max(props.min, props.max))

const higherValue = computed(() =>
  Math.min(Math.max(innerModelValue.value.start, innerModelValue.value.end, minValue.value), maxValue.value)
)

const lowerValue = computed(() =>
  Math.max(Math.min(innerModelValue.value.start, innerModelValue.value.end, maxValue.value), minValue.value)
)

// Add this computed property for the line width
const lineWidth = computed(() => {
  const startPixelPosition = getPosition(lowerValue.value, 0, containerWidth2)
  const endPixelPosition = getPosition(higherValue.value, 0, containerWidth2)
  const width = Math.max(endPixelPosition - startPixelPosition - handleWidthInPx.value / 2, 0)
  return width + handleWidthInPx.value / 2
})

function getPosition(value: number, offset: number, containerWidth2: Ref<number>) {
  const valueClamped = Math.max(minValue.value, Math.min(value, maxValue.value))
  const percentage = (valueClamped - minValue.value) / (maxValue.value - minValue.value)
  return percentage * (containerWidth2.value + offset)
}

function handleMouseDown(event: MouseEvent, type: 'start' | 'end') {
  ignoreWatch.value = true
  event.preventDefault()
  event.stopPropagation()
  if (event.target instanceof HTMLButtonElement) {
    event.target?.focus()
  }
  isDragging.value = type
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(event: MouseEvent) {
  if (isDragging.value === null || !containerRef.value) return
  const containerRect = containerRef.value.getBoundingClientRect()
  const usableWidth = containerRect.width - handleWidthInPx.value
  // Calculate relative position within the container, accounting for handle center
  let relativeX = event.clientX - containerRect.left - handleWidthInPx.value / 2
  // Clamp to container bounds
  relativeX = Math.max(0, Math.min(relativeX, usableWidth))
  // Convert position to value
  const percentage = relativeX / usableWidth
  let newValue = minValue.value + percentage * (maxValue.value - minValue.value)
  newValue = Math.round(newValue / props.step) * props.step // Apply step rounding
  newValue = Math.max(minValue.value, Math.min(newValue, maxValue.value)) // Clamp to min/max bounds
  // round the newValue to the nearest {precision}
  const factor = Math.pow(10, props.precision)
  newValue = Math.round(newValue * factor) / factor
  const segment = innerModelValue.value
  const newSegment = { ...segment, [isDragging.value]: newValue }
  innerModelValue.value = newSegment
}

function swapStartEndIfFlipped() {
  if (innerModelValue.value.start > innerModelValue.value.end) {
    const { start, end, id } = innerModelValue.value
    innerModelValue.value = { start: end, end: start, id } // swap em
  }
}

function handleFlippedFocus(previousValue: SoundSegment, newValue: SoundSegment) {
  const isStartChanging = previousValue.start !== newValue.start
  nextTick(() => {
    if (isStartChanging) {
      endTimeInputRef.value?.focus()
    } else {
      startTimeInputRef.value?.focus()
    }
    const { start, end, id, label } = newValue
    innerModelValue.value = { start: end, end: start, id, ...(label !== undefined && { label }) } // swap em
  })
}

function handleMouseUp() {
  ignoreWatch.value = false
  swapStartEndIfFlipped()
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  isDragging.value = null
}

function handleInput(event: Event, type: 'start' | 'end') {
  const target = event.target
  if (target instanceof HTMLInputElement) {
    handleValueUpdate(type, Number(target.value))
  }
}

function adjustValue(event: KeyboardEvent, type: 'start' | 'end', amount: number) {
  event?.stopPropagation()
  event?.preventDefault()
  handleValueUpdate(type, innerModelValue.value[type] + amount)
}

function handleValueUpdate(type: 'start' | 'end', newValue: number) {
  newValue = Math.max(newValue, minValue.value)
  newValue = Math.min(newValue, maxValue.value)
  if (newValue !== innerModelValue.value[type]) {
    const newSegment = { ...innerModelValue.value, [type]: newValue }
    innerModelValue.value = newSegment
  }
}

// Cleanup event listeners on unmount
onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<style scoped>
.segment-line {
  isolation: isolate;
  position: relative;
  display: flex;
  align-items: center;
  padding-inline: 1px;
  padding-block: 4px;
  --thumb-size: 15px;
}

.text-input {
  width: 60px;
  height: 20px;
  padding: 4px;
  text-align: center;
  margin-bottom: 0.15rem;
}

/* remove default styles */
.range-input {
  appearance: none;
  height: 0.5rem;
  border-radius: 100vw;
  background-color: var(--slider-background);
}

/* change the color of the range-input handle */
.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
}

.range-line {
  position: absolute;
  top: 50%;
  height: 0.5rem;
  transform: translateY(-50%);
  background-color: var(--button-color);
  border-radius: 100vw;
  pointer-events: none;
}

.segment-line > .range-handle {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: var(--thumb-size);
  aspect-ratio: 1;
  background-color: var(--button-color);
  border-radius: 100vw;
  cursor: ew-resize;
  user-select: none;
  padding-block: calc(var(--thumb-size) / 2);
  height: 0;
  border: none;
  z-index: 1;
}

.segment-line > .range-handle:focus {
  outline: 2px solid var(--text-color);
}

.label {
  width: calc(100% - 0.5rem);
  padding: 0;
  padding-left: 0.25rem;
  margin-left: 0.25rem;
  margin-bottom: 0.25rem;
}
</style>
