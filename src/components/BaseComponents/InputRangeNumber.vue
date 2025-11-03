<template>
  <input
    type="range"
    :min="min"
    :max="max"
    :step="step"
    v-model.number="innerModelValue"
    @keydown.page-up.prevent="innerModelValue = Math.min(innerModelValue + bigStep, max)"
    @keydown.page-down.prevent="innerModelValue = Math.max(innerModelValue - bigStep, min)"
    :style="{ '--value-percent': valuePercent }"
    v-bind="$attrs" />
</template>

<script setup lang="ts">
import { useModel } from 'vue'

const valuePercent = computed(() => {
  const percentage = ((innerModelValue.value - props.min) / (props.max - props.min)) * 100
  return `${Math.max(props.min, Math.min(props.max, percentage))}%`
})

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

<style scoped>
input[type='range'] {
  /* Define local CSS variables with fallbacks */
  --local-thumb-color: var(--slider-thumb-color, var(--button-color));
  --local-track-empty: var(--slider-track-empty, var(--slider-background));
  --local-track-filled: var(--slider-track-filled, var(--button-color));
  --local-height: var(--slider-height, 8px);
  --local-cursor: var(--slider-cursor, pointer);

  appearance: none;
  height: var(--local-height);
  border-radius: calc(var(--local-height) / 2);
  background: linear-gradient(
    to right,
    var(--local-track-filled) var(--value-percent),
    var(--local-track-empty) var(--value-percent)
  );
  cursor: var(--local-cursor);
}
input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: calc(2 * var(--local-height));
  height: calc(2 * var(--local-height));
  border-radius: 50%;
  background-color: var(--local-thumb-color);
}
</style>
