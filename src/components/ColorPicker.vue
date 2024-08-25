<template>
  <div class="color-picker">
    <label for="colorPicker">Color:</label>
    <input id="colorPicker" type="color" v-model="defaultColor" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ modelValue: string | undefined }>()

const emit = defineEmits<(event: 'update:modelValue', value: string | undefined) => void>()

const defaultColor = computed({
  get: () => props.modelValue ?? '#ffffff',
  set: (value: string) => {
    emit('update:modelValue', value)
  },
})
</script>

<style scoped>
.color-picker {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

input[type='color']::-webkit-color-swatch-wrapper {
  padding: 0;
}
input[type='color']::-webkit-color-swatch {
  border: none;
}
</style>
