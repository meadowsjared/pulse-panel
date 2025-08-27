<template>
  <input
    type="text"
    v-model="displayValue"
    v-bind="$attrs"
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
  console.log('Committing value:', displayValue.value)
  const totalSeconds = parseMMSSToSeconds(displayValue.value)
  console.log('Parsed total seconds:', totalSeconds)
  const timeString = formatSecondsToMMSS(totalSeconds)
  console.log('Formatted time string:', timeString)
  if (displayValue.value !== timeString) {
    displayValue.value = timeString
  }
  console.log('Parsed time:', displayValue.value, 'to seconds:', totalSeconds)
  emit('update:modelValue', totalSeconds)
}

function adjustValue(event: KeyboardEvent, delta: number) {
  event.preventDefault()
  let newValue
  if (delta > 0) {
    if (props.max === undefined) {
      newValue = props.modelValue + delta
    } else {
      newValue = Math.min(props.modelValue + delta, props.max)
    }
  } else if (props.min === undefined) {
    newValue = props.modelValue + delta
  } else {
    newValue = Math.max(props.modelValue + delta, props.min)
  }
  emit('update:modelValue', newValue)
}
</script>
