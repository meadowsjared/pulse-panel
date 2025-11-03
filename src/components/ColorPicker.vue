<template>
  <div class="color-picker" ref="colorPickerRef">
    <label for="colorPicker" @click="togglePicker">Color:</label>
    <div class="color-swatch" :style="{ backgroundColor: defaultColor }" @click="togglePicker"></div>

    <!-- Dropdown picker -->
    <div v-if="showPicker" class="color-picker-dropdown">
      <ChromePicker :model-value="defaultColor" @update:model-value="updateColor" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { ChromePicker } from 'vue-color'

const props = defineProps<{ modelValue: string | undefined }>()

const emit = defineEmits<(event: 'update:modelValue', value: string | undefined) => void>()

const showPicker = ref(false)
const colorPickerRef = ref<HTMLElement>()

const defaultColor = computed({
  get: () => props.modelValue ?? '#ffffff',
  set: (value: string) => {
    emit('update:modelValue', value)
  },
})

const togglePicker = () => {
  showPicker.value = !showPicker.value
}

const updateColor = (color: { hex: string }) => {
  // ChromePicker might return different formats, adjust as needed
  const colorValue = color.hex ?? color
  defaultColor.value = colorValue
}

const handleClickOutside = (event: MouseEvent) => {
  if (colorPickerRef.value && !colorPickerRef.value.contains(event.target as Node)) {
    showPicker.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.color-picker {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  position: relative;
}

.color-swatch {
  width: 64px;
  height: 32px;
  border: 2px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.color-swatch:hover {
  border-color: #999;
}

.color-picker-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  --vc-body-bg: var(--top-toolbar-color);
  --vc-input-bg: var(--top-toolbar-color-light);
  --vc-input-text: var(--button-text);
  --vc-input-label: var(--button-text);
  --vc-picker-bg: var(--alt-bg-color);
  --vc-chrome-toggle-btn-highlighted: var(--background-color);
}
</style>
