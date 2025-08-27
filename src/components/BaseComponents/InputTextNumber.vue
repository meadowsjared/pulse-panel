<template>
  <input
    ref="textInputElement"
    type="text"
    v-model.number="displayValue"
    @keydown.enter="commitValue"
    @blur="commitValue"
    @keydown.up.prevent="adjustValue($event, step)"
    @keydown.down.prevent="adjustValue($event, -step)"
    @keydown.page-up.prevent="adjustValue($event, bigStep)"
    @keydown.page-down.prevent="adjustValue($event, -bigStep)"
    v-bind="$attrs" />
</template>

<script setup lang="ts">
const textInputElement = ref<HTMLInputElement | null>(null)
const displayValue = ref('')
const emit = defineEmits<(event: 'update:modelValue', value: number) => void>()

const props = withDefaults(
  defineProps<{
    modelValue: number
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

watch(
  () => props.modelValue,
  newValue => {
    if (parseFloat(displayValue.value) !== newValue) {
      displayValue.value = String(newValue)
    }
  },
  { immediate: true, deep: true }
)

function commitValue() {
  const parsedValue = parseFloat(displayValue.value)
  if (!isNaN(parsedValue)) {
    if (parsedValue !== props.modelValue) {
      emit('update:modelValue', parsedValue)
    }
    if (displayValue.value !== String(parsedValue)) {
      displayValue.value = String(parsedValue)
    }
  } else {
    // On invalid input, snap back to the last known good value.
    displayValue.value = String(props.modelValue)
  }
  textInputElement.value?.blur()
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
