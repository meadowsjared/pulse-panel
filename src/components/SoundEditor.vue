<template>
  <div class="edit-dialog">
    <button @click="close" class="close-button absolute right-2 top-2">
      <inline-svg class="w-8 h-8 rotate-45" :src="Plus" />
    </button>
    <h1>Edit Sound</h1>
    <div class="input-group">
      <label for="name">Name:</label>
      <input type="text" v-model="props.modelValue.name" id="name" />
    </div>
    <div class="input-group">
      <label for="volume">Volume:</label>
      <input
        class="volume-slider"
        type="range"
        min="0"
        max="1"
        step="0.01"
        @update:modelValue="props.modelValue.volume = $event"
        v-model.number="volumeValue"
        id="volume" />
    </div>
    <div
      :style="modelValue.imageUrl ? { backgroundImage: `url(${modelValue.imageUrl})` } : {}"
      class="image w-full aspect-square relative mt-4">
      <button @click="removeImage" class="remove-image-button absolute top-2 right-2 w-8 h-8 bg-white">
        <inline-svg :src="Plus" class="w-full h-full rotate-45" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Sound } from '@/@types/sound'
import Plus from '../assets/images/plus.svg'
import InlineSvg from 'vue-inline-svg'
import { useSettingsStore } from '../store/settings'
import { computed, watch } from 'vue'

const props = defineProps<{
  modelValue: Sound
}>()

const emit = defineEmits<(event: 'update:modelValue', value: Sound) => void>()

const settingsStore = useSettingsStore()

// Watch for changes to the name and update the modelValue
watch(
  () => [props.modelValue.name, props.modelValue.volume],
  () => {
    emit('update:modelValue', props.modelValue)
  }
)

// replace volume of undefined with 1
const volumeValue = computed({
  get: () => props.modelValue.volume ?? 1,
  set: (value: number) => (props.modelValue.volume = value),
})

function removeImage() {
  // Remove the image from the modelValue
  settingsStore.deleteFile(props.modelValue.imagePath)
  delete props.modelValue.imagePath
  delete props.modelValue.imageUrl
  emit('update:modelValue', props.modelValue)
}

function close() {
  // Close the editor
  settingsStore.currentEditingSound = null
}
</script>

<style scoped>
.volume-slider {
  width: 100%;
  cursor: pointer;
}

.edit-dialog {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.image {
  background-position: center;
  background-size: cover;
}

.remove-image-button {
  opacity: 0.5;
}

.input-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.close-button {
  fill: var(--alt-bg-color);
}

h1 {
  color: var(--alt-bg-color);
}

input {
  color: var(--alt-bg-color);
}

label {
  color: var(--alt-bg-color);
}
</style>
