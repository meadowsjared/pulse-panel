<template>
  <div class="edit-dialog">
    <button
      @click="soundStore.playSound(modelValue, null, null, true)"
      title="preview sound"
      :class="{ 'playing-sound': playingThisSound }"
      class="light preview-button absolute left-0 top-0">
      <inline-svg class="w-8 h-8" :src="Listen" />
    </button>
    <h1>Edit Sound</h1>
    <button @click="close" class="close-button absolute right-0 top-0">
      <inline-svg class="w-8 h-8 rotate-45" :src="Plus" />
    </button>
    <div class="input-group">
      <label for="name">Name:</label>
      <input type="text" v-model="props.modelValue.name" id="name" />
      <div class="hide-name-checkbox-group">
        <input title="hide name on button" type="checkbox" v-model="props.modelValue.hideName" id="hideName" /><label
          for="hideName"
          >Hide Name:</label
        >
      </div>
    </div>
    <input
      type="file"
      ref="audioFileInput"
      @change="handleAudioFileUpload"
      class="file-input hidden"
      accept="audio/*" />
    <button @click="audioFileInput?.click()" class="dark">Browse Audio...</button>
    <div class="input-group">
      <div class="volume-control-container">
        <input type="text" class="volume-display" v-model.number="volumeDisplay" />
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
    <input
      type="file"
      ref="imageFileInput"
      @change="handleImageFileUpload"
      class="file-input hidden"
      accept="image/*" />
    <button @click="imageFileInput?.click()" class="dark">Browse Image...</button>
    <div class="flex flex-col text-black">
      <hotkey-picker
        v-model="props.modelValue.hotkey"
        @update:modelValue="updateHotkey"
        :dark="true"
        title="set a keybind for sound"
        >Keybind:</hotkey-picker
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { Sound } from '@/@types/sound'
import Plus from '../assets/images/plus.svg'
import Listen from '../assets/images/listen.svg'
import InlineSvg from 'vue-inline-svg'
import { useSettingsStore } from '../store/settings'
import { computed, ref, VNodeRef, watch } from 'vue'
import PlayIcon from '../assets/images/play.svg'
import { useSoundStore } from '../store/sound'
import { stripFileExtension } from '../utils/utils'

const props = defineProps<{
  modelValue: Sound
}>()

const emit = defineEmits<(event: 'update:modelValue', value: Sound) => void>()
const playingThisSound = computed(() => soundStore.playingSoundIds.includes(props.modelValue.id))

const settingsStore = useSettingsStore()
const soundStore = useSoundStore()
const imageFileInput = ref<VNodeRef | null>(null)
const audioFileInput = ref<VNodeRef | null>(null)

// Watch for changes to the name and update the modelValue
watch(
  () => [props.modelValue.name, props.modelValue.volume, props.modelValue.hideName, props.modelValue.hotkey],
  () => {
    // if hideName is false and modelValue has the property, delete it
    if (!props.modelValue.hideName && props.modelValue.hasOwnProperty('hideName')) {
      delete props.modelValue.hideName
    }
    volumeDisplay.value = Math.round((props.modelValue.volume ?? 1) * 100)
    if ((props.modelValue.volume ?? 1) === 1) {
      delete props.modelValue.volume
    }
    emit('update:modelValue', props.modelValue)
  }
)

// replace volume of undefined with 1
const volumeValue = computed({
  get: () => props.modelValue.volume ?? 1, // default volume to max if not set
  set: (value: number) => {
    props.modelValue.volume = value
    volumeDisplay.value = Math.round(value * 100)
  },
})

// display version of the volume
const volumeDisplay = ref(volumeValue.value * 100)

//update the volumeValue when volumeDisplay changes
watch(
  () => volumeDisplay.value,
  () => {
    volumeValue.value = volumeDisplay.value / 100
  }
)

// Watch for changes to the volume and update the soundStore in case something is playing
watch(
  () => volumeValue.value,
  () => {
    const volume = volumeValue.value
    soundStore.setVolume(volume)
  },
  { immediate: true }
)

function updateHotkey(newKey: string[], oldKey: string[] | undefined) {
  if (oldKey) {
    settingsStore.removeHotkey(props.modelValue, oldKey)
  }
  setTimeout(() => {
    // we must delay this, otherwise it will play the sound when the hotkey is set
    settingsStore.addHotkey(props.modelValue, newKey)
  }, 0)
}

async function handleAudioFileUpload(event: Event) {
  // Handle the file upload event
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  if (!target.files || !target.files[0]) return
  const file = target.files[0]
  const { fileUrl, fileKey } = await settingsStore.replaceFile(props.modelValue.audioKey, file)
  props.modelValue.name = stripFileExtension(file.name)
  props.modelValue.audioKey = fileKey
  props.modelValue.audioUrl = fileUrl
  emit('update:modelValue', props.modelValue)
}

async function handleImageFileUpload(event: Event) {
  // Handle the file upload event
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  if (!target.files || !target.files[0]) return
  const file = target.files[0]
  const { fileUrl, fileKey } = await settingsStore.replaceFile(props.modelValue.imageKey, file)
  props.modelValue.imageKey = fileKey
  props.modelValue.imageUrl = fileUrl
  emit('update:modelValue', props.modelValue)
}

function removeImage() {
  // Remove the image from the modelValue
  settingsStore.deleteFile(props.modelValue.imageKey)
  delete props.modelValue.imageKey
  delete props.modelValue.imageUrl
  emit('update:modelValue', props.modelValue)
}

function close() {
  // Close the editor
  settingsStore.currentEditingSound = null
}
</script>

<style scoped>
.hide-name-checkbox-group > input[type='checkbox']:checked {
  background-color: var(--active-color);
}
input[type='checkbox'] {
  --tw-ring-offset-width: unset;
  --tw-ring-color: transparent;
}
input[type='checkbox']:focus-visible {
  --tw-ring-color: var(--active-color);
}

.volume-control-container {
  display: grid;
  align-items: center;
  grid-template-rows: auto auto;
  grid-template-columns: min-content auto;
  width: 100%;
}

.play-sound-button {
  grid-area: 2 / 1;
  width: max-content;
}

.close-button > svg,
.play-sound-button > svg {
  fill: var(--text-color);
  stroke: none;
}
.play-sound-button > svg {
  fill: var(--accent-text-color);
  stroke: none;
}
.play-sound-button:focus-visible > svg {
  stroke: var(--active-color);
  stroke-width: 0.12rem;
  overflow: visible;
}
.play-sound-button:hover > svg {
  fill: var(--active-color);
}

.volume-display {
  color: var(--text-color);
  background: var(--background-color);
  padding: 0;
  margin-right: 0.5rem;
  margin-bottom: 0.25rem;
  width: 2.2rem;
  border-radius: 0.25rem;
  text-align: center;
  border: none;
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
  position: relative;
}

.image {
  background-position: center;
  background-size: cover;
}

.remove-image-button {
  opacity: 0.5;
}
.remove-image-button:focus-visible {
  opacity: 1;
}

.input-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.input-group > input {
  width: 100%;
}

.hide-name-checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.preview-button {
  padding: 0.25rem;
  width: 2rem;
  aspect-ratio: 1;
  border-radius: 0.25rem;
  background: var(--accent-text-color);
}
.preview-button > svg {
  stroke: var(--background-color);
  width: 100%;
  height: 100%;
}

h1 {
  color: var(--text-color);
}

input {
  color: var(--text-color);
  background: var(--background-color);
  border: none;
}

label {
  color: var(--text-color);
}
</style>
