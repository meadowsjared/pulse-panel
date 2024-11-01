<template>
  <div class="edit-dialog">
    <div class="title-bar flex justify-between">
      <button
        @click="soundStore.playSound(modelValue, null, null, true)"
        title="preview sound"
        :class="{ 'playing-sound': playingThisSound }"
        class="light preview-button">
        <inline-svg class="w-8 h-8" :src="Listen" />
      </button>
      <h1>Edit Sound</h1>
      <button @click="close" class="close-button">
        <inline-svg class="w-8 h-8 rotate-45" :src="Plus" />
      </button>
    </div>
    <div class="sound-properties">
      <div class="input-group">
        <label for="title">Sound title:</label>
        <input type="text" v-model="props.modelValue.title" id="title" placeholder="Enter text for the button" />
        <div class="hide-title-checkbox-group">
          <div title="hide title on button">
            <input type="checkbox" v-model="props.modelValue.hideTitle" id="hideTitle" /><label for="hideTitle"
              >Hide title</label
            >
          </div>
          <div title="set title color button">
            <color-picker v-model="props.modelValue.color" />
          </div>
        </div>
        <label for="tags" @click="tagInputRef && tagInputRef.textInputRef?.focus()">Tags:</label>
        <tag-input
          ref="tagInputRef"
          id="tags"
          v-model="props.modelValue.tags"
          placeholder="Tags are used for searching" />
      </div>
      <input
        type="file"
        ref="audioFileInput"
        @change="handleAudioFileUpload"
        class="file-input hidden"
        accept="audio/*" />
      <button @click="audioFileInput?.click()" class="light">Browse Audio...</button>
      <div class="input-group">
        <div class="volume-control-container">
          <input-text-number
            id="volume-display"
            class="volume-display"
            :min="0"
            :max="100"
            :bigStep="5"
            v-model="volumeDisplay" />
          <label class="volume-label" for="volume-display">Volume:</label>
          <button
            @click="soundStore.playSound(modelValue, null, null, undefined, true)"
            :class="['play-sound-button', { focusVisible }]"
            @blur="focusVisible = false"
            @keyup="handleKeyup">
            <inline-svg :src="PlayIcon" class="w-6 h-6" />
          </button>
          <input-range-number class="volume-slider" :bigStep="5" v-model="volumeDisplay" />
        </div>
      </div>
      <div v-if="modelValue.imageUrl" class="relative">
        <button @click="removeImage" class="remove-image-button absolute top-2 right-2 w-8 h-8 bg-white">
          <inline-svg :src="Plus" alt="remove image" class="w-full h-full rotate-45" />
        </button>
        <img :src="modelValue.imageUrl" alt="preview button" class="image" />
      </div>
      <input
        type="file"
        ref="imageFileInput"
        @change="handleImageFileUpload"
        class="file-input hidden"
        accept="image/*" />
      <button ref="browseImageButton" @click="imageFileInput?.click()" class="light">Browse Image...</button>
      <div class="flex flex-col text-black">
        <hotkey-picker
          v-model="props.modelValue.hotkey"
          @update:modelValue="updateHotkey"
          @focus-next-element="focusNextElement"
          @focus-prev-element="focusPrevElement"
          :dark="false"
          title="set a keybind for sound"
          >Keybind:</hotkey-picker
        >
      </div>
      <button ref="deleteButton" @click="emit('deleteSound', modelValue)" class="light danger">DELETE</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Sound } from '@/@types/sound'
import Plus from '../assets/images/plus.svg'
import Listen from '../assets/images/listen.svg'
import InlineSvg from 'vue-inline-svg'
import { useSettingsStore } from '../store/settings'
import { computed, ref, watch } from 'vue'
import PlayIcon from '../assets/images/play.svg'
import { useSoundStore } from '../store/sound'
import { stripFileExtension } from '../utils/utils'
import { TagInputRef } from './BaseComponents/TagInputTypes'
import { throttle } from 'lodash'

const props = defineProps<{
  modelValue: Sound
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: Sound): void
  (event: 'deleteSound', sound: Sound): void
}>()
const playingThisSound = computed(() => soundStore.playingSoundIds.includes(props.modelValue.id))

const settingsStore = useSettingsStore()
const soundStore = useSoundStore()
const imageFileInput = ref<HTMLInputElement | null>(null)
const audioFileInput = ref<HTMLInputElement | null>(null)
const deleteButton = ref<HTMLButtonElement | null>(null)
const browseImageButton = ref<HTMLButtonElement | null>(null)
const tagInputRef = ref<TagInputRef | null>(null)
const focusVisible = ref(false)

/**
 * Displays the volume as a percentage
 */
const volumeDisplay = computed({
  get: () => Math.round((props.modelValue.volume ?? settingsStore.defaultVolume) * 100),
  set: (value: number) => {
    value = Math.min(100, Math.max(0, Math.round(value)))
    soundStore.setVolume(value / 100, props.modelValue.id)
    saveVolumeDebounced(value)
  },
})

const saveVolumeDebounced = throttle((value: number) => {
  const newValue = Math.round(value) / 100
  if (props.modelValue.volume === newValue) return
  // we don't need to handle this here, but if we don't, it will trigger once
  // when it's set to the same number as the default volume,
  // and then a second time when the volume is deleted,
  // because no volume will turn into the default volume
  if (newValue === settingsStore.defaultVolume) {
    delete props.modelValue.volume
  } else {
    props.modelValue.volume = newValue
  }
}, 100)

// Watch for changes to the title and update the modelValue
watch(
  () => [
    props.modelValue.title,
    props.modelValue.volume,
    props.modelValue.hideTitle,
    props.modelValue.hotkey,
    props.modelValue.tags,
    props.modelValue.color,
  ],
  () => {
    // if hideTitle is false and modelValue has the property, delete it
    if (!props.modelValue.hideTitle && props.modelValue.hasOwnProperty('hideTitle')) {
      delete props.modelValue.hideTitle
    }
    if (props.modelValue.color === '#ffffff') {
      delete props.modelValue.color
    }
    volumeDisplay.value = Math.round((props.modelValue.volume ?? settingsStore.defaultVolume) * 100)
    if ((props.modelValue.volume ?? settingsStore.defaultVolume) === settingsStore.defaultVolume) {
      delete props.modelValue.volume
    }
    if (props.modelValue.tags?.length === 0) {
      delete props.modelValue.tags
    }
    emit('update:modelValue', props.modelValue)
  }
)

/**
 * Handles the keyup event
 * The reason why we do this is to prevent the ptt_hotkey from accidentally triggering the soundButton to be focused
 * @param event The keyup event
 */
function handleKeyup(event: KeyboardEvent) {
  // if the soundStore is sending a ptt_hotkey and the keyup event is the ptt_hotkey, prevent the default action (which will focus it)
  if (soundStore.sendingPttHotkey && settingsStore.ptt_hotkey.includes(event.code)) {
    event.preventDefault()
    return
  }
  focusVisible.value = true
}

function focusNextElement() {
  // Focus the next element
  deleteButton.value?.focus()
}

function focusPrevElement() {
  // Focus the previous element
  browseImageButton.value?.focus()
}

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
  props.modelValue.title = stripFileExtension(file.name)
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
.edit-dialog {
  height: calc(100% - 3.5rem);
}

.sound-properties {
  margin-bottom: 8rem;
  height: 100%;
  overflow: hidden auto;
  --scrollbar-width: 14px;
  scroll-margin-block: 50px;
  padding: 0.5rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sound-properties::-webkit-scrollbar {
  width: var(--scrollbar-width);
  padding-right: 1.5rem;
}

.sound-properties::-webkit-scrollbar-thumb {
  background: var(--text-color);
  border-radius: calc(var(--scrollbar-width) / 2);
  border: 4px solid var(--input-bg-color);
}

.sound-properties::-webkit-scrollbar-track {
  background: var(--input-bg-color);
}

.title-bar {
  position: sticky;
  top: 0;
  background: var(--top-toolbar-color);
  padding: 0.75rem 1rem;
  z-index: 1;
  gap: 0.5rem;
}

.hide-title-checkbox-group {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 0.5rem;
}
.hide-title-checkbox-group > div {
  display: flex;
  align-items: center;
  justify-self: center;
  gap: 0.5rem;
}
.hide-title-checkbox-group > div > input[type='checkbox']:checked {
  background-color: var(--button-color);
}
input[type='checkbox'] {
  --tw-ring-offset-width: unset;
  --tw-ring-color: transparent;
  background-color: var(--input-bg-color);
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

.close-button:focus-visible {
  outline: 2px solid var(--active-color);
  outline-offset: 2px;
}

.close-button > svg,
.play-sound-button > svg {
  fill: var(--text-color);
  stroke: none;
}
.play-sound-button > svg {
  fill: var(--button-color);
  stroke: none;
}
.play-sound-button.focusVisible > svg {
  stroke: var(--active-color);
  stroke-width: 0.12rem;
  overflow: visible;
  fill: var(--accent-text-color);
}
.play-sound-button:hover > svg {
  fill: var(--link-color);
}
.play-sound-button:active > svg {
  fill: var(--accent-text-color);
}

.volume-display {
  color: var(--text-color);
  background: var(--input-bg-color);
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

.image {
  object-fit: cover;
  width: 100%;
  aspect-ratio: 1 / 1;
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

.input-group > label {
  margin-bottom: 0.25rem;
}

.input-group > input {
  width: 100%;
}

.hide-title-checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.preview-button {
  padding: 0.25rem;
  width: 2rem;
  aspect-ratio: 1;
  border-radius: 0.25rem;
}
.preview-button > svg {
  stroke: var(--text-color);
  width: 100%;
  height: 100%;
}
.preview-button:active > svg {
  stroke: var(--background-color);
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
