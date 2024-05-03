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
      <div class="volume-control-container">
        <div class="volume-display">{{ volumeDisplay }}</div>
        <label class="volume-label" for="volume">Volume:</label>
        <button @click="soundStore.playSound(modelValue)" class="play-sound-button">
          <inline-svg :src="PlayIcon" class="w-6 h-6" />
        </button>
        <input
          class="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          v-model.number="volumeValue"
          id="volume" />
      </div>
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
import PlayIcon from '../assets/images/play.svg'
import { useSoundStore } from '../store/sound'

const props = defineProps<{
  modelValue: Sound
}>()

const emit = defineEmits<(event: 'update:modelValue', value: Sound) => void>()

const settingsStore = useSettingsStore()
const soundStore = useSoundStore()

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

// display version of the volume
const volumeDisplay = computed(() => `${Math.round(volumeValue.value * 100)}%`)

// Watch for changes to the volume and update the soundStore in case something is playing
watch(
  () => volumeValue.value,
  () => {
    const volume = volumeValue.value
    soundStore.setVolume(volume)
  }
)

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
.volume-control-container {
  display: grid;
  align-items: center;
  grid-template-rows: auto auto;
  grid-template-columns: min-content auto;
  width: 100%;
}

.play-sound-button {
  grid-area: 2 / 1;
}

.play-sound-button > svg {
  fill: var(--alt-bg-color);
  stroke: var(--alt-bg-color);
}

.volume-display {
  color: var(--alt-bg-color);
  padding-right: 0.5rem;
}

.volume-label {
  text-align: left;
  grid-area: 1 / 2;
}

.volume-slider {
  grid-area: 2 / 2;
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
