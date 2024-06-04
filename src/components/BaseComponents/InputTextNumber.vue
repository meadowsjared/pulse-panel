<template>
  <input
    ref="textInputElement"
    type="text"
    v-model.number="innerModelValue"
    @keydown.enter="textInputElement?.blur()"
    @keydown.up.prevent=";(max === undefined || innerModelValue < max) && innerModelValue++"
    @keydown.down.prevent=";(min === undefined || innerModelValue > min) && innerModelValue--"
    @keydown.page-down.prevent="decreaseBigStep"
    @keydown.page-up.prevent="increaseBigStep"
    v-bind="$attrs" />
</template>

<script setup lang="ts">
import { ref, useModel } from 'vue'

const textInputElement = ref<HTMLInputElement | null>(null)
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

const innerModelValue = useModel(props, 'modelValue')

function increaseBigStep() {
  if (props.max === undefined) {
    innerModelValue.value = innerModelValue.value + props.bigStep
  } else {
    innerModelValue.value = Math.min(innerModelValue.value + props.bigStep, props.max)
  }
}

function decreaseBigStep() {
  if (props.min === undefined) {
    innerModelValue.value = innerModelValue.value - props.bigStep
  } else {
    innerModelValue.value = Math.max(innerModelValue.value - props.bigStep, props.min)
  }
}
</script>
