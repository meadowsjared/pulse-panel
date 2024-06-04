<template>
  <input
    type="range"
    :min="min"
    :max="max"
    :step="step"
    v-model.number="innerModelValue"
    @keydown.page-up.prevent="innerModelValue = Math.min(innerModelValue + bigStep, max)"
    @keydown.page-down.prevent="innerModelValue = Math.max(innerModelValue - bigStep, min)"
    v-bind="$attrs" />
</template>

<script setup lang="ts">
import { useModel } from 'vue'

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
    min: 0,
    max: 100,
    step: 1,
    bigStep: 10,
  }
)

const innerModelValue = useModel(props, 'modelValue')
</script>
