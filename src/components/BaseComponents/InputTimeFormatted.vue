<template>
  <input
    type="text"
    v-model="displayValue"
    v-bind="$attrs"
    draggable="true"
    @dragstart.prevent.stop
    @blur="commitValue"
    @keydown.enter="commitValue"
    @keydown.up.prevent="adjustValue($event, step)"
    @keydown.down.prevent="adjustValue($event, -step)"
    @keydown.page-up.prevent="adjustValue($event, bigStep)"
    @keydown.page-down.prevent="adjustValue($event, -bigStep)" />
</template>

<script setup lang="ts">
import { formatSecondsToMMSS, parseMMSSToSeconds } from '../../utils/utils'

const props = withDefaults(
  defineProps<{
    modelValue: number // The v-model value will be in SECONDS
    min?: number
    max?: number
    step?: number
    bigStep?: number
  }>(),
  {
    step: 1,
    bigStep: 10,
    min: 0,
    max: 100,
  }
)

const emit = defineEmits<(event: 'update:modelValue', value: number) => void>()

const displayValue = ref('')

watch(
  () => props.modelValue,
  newValue => {
    if (displayValue.value !== formatSecondsToMMSS(newValue)) {
      displayValue.value = formatSecondsToMMSS(newValue)
    }
  },
  { immediate: true }
)

/**
 * Commits the current input value by parsing it and emitting the update.
 */
function commitValue() {
  const totalSeconds = parseMMSSToSeconds(displayValue.value)
  const clampedSeconds = Math.max(props.min, Math.min(totalSeconds, props.max))
  const timeString = formatSecondsToMMSS(clampedSeconds)
  if (displayValue.value !== timeString) {
    displayValue.value = timeString
  }
  emit('update:modelValue', clampedSeconds)
}

function adjustValue(event: KeyboardEvent, delta: number) {
  event.preventDefault()
  const totalSeconds = parseMMSSToSeconds(displayValue.value)
  let newValue
  if (delta > 0) {
    if (props.max === undefined) {
      newValue = totalSeconds + delta
    } else {
      newValue = Math.min(totalSeconds + delta, props.max)
    }
  } else if (props.min === undefined) {
    newValue = totalSeconds + delta
  } else {
    newValue = Math.max(totalSeconds + delta, props.min)
  }
  const timeString = formatSecondsToMMSS(newValue)
  if (displayValue.value !== timeString) {
    displayValue.value = timeString
  }
  emit('update:modelValue', newValue)
}
</script>
