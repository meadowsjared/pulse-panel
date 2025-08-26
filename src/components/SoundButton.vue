<template>
  <div
    v-if="modelValue?.title !== undefined"
    class="sound-button-container"
    @drop="handleFileDrop(false, $event)"
    @dragover.prevent>
    <button
      ref="soundButton"
      @click="playSound"
      @mousedown="handleMouseDown"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @auxclick="handleAuxClick"
      @blur="focusVisible = false"
      @keyup="handleKeyup"
      :class="[
        'sound-button',
        {
          reset: props.modelValue.reset,
          'playing-sound': playingThisSound,
          'has-image': modelValue.imageKey,
          'edit-mode': props.displayMode === 'edit',
          'editing-sound': settingsStore.currentEditingSound?.id === modelValue.id,
          focusVisible,
        },
      ]"
      :style="mergedStyle">
      <span
        ref="buttonTitle"
        v-if="!props.modelValue.hideTitle"
        :class="['button-title', { 'four-lines': isFourLines, 'five-or-more-lines': isFiveOrMoreLines }]"
        :style="props.modelValue.color && `color: ${props.modelValue.color}`"
        >{{ modelValue.title || 'New Sound' }}</span
      >
    </button>
    <div :class="['button-group', { 'button-group-visible': displayMode === 'edit' }]" @click.capture="editSound">
      <button title="Edit" class="edit-buttons" :tabindex="displayMode !== 'edit' ? -1 : 0">Edit Sound</button>
    </div>
  </div>
  <div v-else class="sound-button-container" @drop="handleFileDrop(true, $event)" @dragover.prevent>
    <button
      @click="addSound"
      @blur="focusVisible = false"
      @keyup="handleKeyup"
      :class="['sound-button add-button', { focusVisible }]">
      <inline-svg :src="Plus" />
    </button>
    <div :class="['button-group', { 'button-group-visible': displayMode === 'edit' }]" @click="addSound">
      <button title="Add Sound" class="edit-buttons add-button" :tabindex="displayMode !== 'edit' ? -1 : 0">
        Add Sound
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSoundStore } from '../store/sound'
import { Sound } from '../@types/sound'
import { computed, onMounted, ref } from 'vue'
import Plus from '../assets/images/plus.svg'
import InlineSvg from 'vue-inline-svg'
import { DisplayMode, useSettingsStore } from '../store/settings'

// Define the props
const props = defineProps<{
  modelValue: Sound
  displayMode: DisplayMode
  isPreview?: boolean
}>()

// define the emits
const emit = defineEmits<{
  (event: 'update:modelValue', value: Sound): void
  (event: 'editSound'): void
  (event: 'fileDropped', dragEvent: DragEvent, sound: Sound, isNewSound: boolean): void
}>()

const numSoundsPlaying = ref(0)
/**
 * used to manually handle the focus state of the button by:
 * 1. tracking if the button is focused by keyboard events
 * 2. preventing focus events from being triggered by the ptt_hotkey
 */
const focusVisible = ref(false)
const lineHeight = ref(0)
const soundButton = ref<HTMLButtonElement | null>(null)
const buttonTitle = ref<HTMLElement | null>(null)

const soundStore = useSoundStore()
const settingsStore = useSettingsStore()

onMounted(() => {
  if (buttonTitle.value) {
    lineHeight.value = parseFloat(getComputedStyle(buttonTitle.value).lineHeight)
  }
})

const mergedStyle = computed(() => {
  return {
    ...(props.modelValue.imageUrl ? { backgroundImage: `url(${props.modelValue.imageUrl})` } : {}),
    ...(props.modelValue.duration ? { '--sound-duration': `${props.modelValue.duration}s` } : {}),
  }
})

const playingThisSound = computed(() => soundStore.playingSoundIds.some(item => item.fileId === props.modelValue.id))

const isFourLines = computed(() => {
  if (buttonTitle.value) {
    const height = buttonTitle.value.offsetHeight
    return height >= lineHeight.value * 4 && height < lineHeight.value * 5
  }
  return false
})

const isFiveOrMoreLines = computed(() => {
  if (buttonTitle.value) {
    const height = buttonTitle.value.offsetHeight
    return height >= lineHeight.value * 5
  }
  return false
})

function editSound() {
  if (props.displayMode === 'edit') {
    emit('editSound')
  }
}

function handleAuxClick(event: MouseEvent) {
  if (event.button === 2) {
    emit('editSound')
    return
  }
  if (event.button === 1) {
    playSoundSegment(2)
    // return
  }
}

function handleMouseDown(event: MouseEvent) {
  if (event.button === 1) {
    event.preventDefault()
  }
}

async function playSoundSegment(soundNumber: number) {
  numSoundsPlaying.value++
  const segment = props.modelValue.soundSegments?.[soundNumber - 1] ??
    props.modelValue.soundSegments?.[0] ?? { start: 0, end: 0 }
  soundStore.playSound(props.modelValue, null, null, undefined, true, segment).then(() => {
    numSoundsPlaying.value--
  })
}

async function playSound() {
  numSoundsPlaying.value++
  soundStore.playSound(props.modelValue, null, null, undefined, true).then(() => {
    numSoundsPlaying.value--
  })
}

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

function handleMouseEnter() {
  settingsStore.setHoveringSound(props.modelValue)
}

function handleMouseLeave() {
  settingsStore.setHoveringSound(null)
}

function addSound() {
  const newSound: Sound = {
    title: '',
    id: props.modelValue?.id,
  }
  emit('update:modelValue', newSound)
}

/**
 * Handles the file drop event
 * @param event The drag event
 */
function handleFileDrop(isNewSound: boolean, event: DragEvent) {
  emit('fileDropped', event, props.modelValue, isNewSound)
}
</script>

<style scoped>
.button-title {
  bottom: 0;
  left: 0;
  right: 0;
  font-weight: bold;
  text-wrap: pretty;
}

.four-lines {
  line-height: 1.1;
}

.five-or-more-lines {
  line-height: 1;
}

.button-group {
  cursor: pointer;
  position: relative;
  height: 1rem;
  --transition-duration: 0.3s;
  transition: top var(--transition-duration), height var(--transition-duration);
  top: -30px;
  z-index: 0;
}

.button-group-visible {
  top: 0;
  height: 32px;
}

/* center the plus button on the add sound button */
.add-button > svg {
  width: 50%;
  height: 50%;
  margin: auto;
  fill: var(--text-color);
}

.edit-buttons {
  border-radius: 0.313rem;
  width: 100%;
  margin: 0.25rem 0;
}

/* if the user hovers over .button-group, add outline to the .edit-buttons */
.button-group:hover .edit-buttons {
  color: var(--button-color);
}

.edit-buttons:hover {
  color: var(--button-color);
}

.edit-buttons:focus-visible {
  outline: 1px solid var(--active-color);
}

.sound-button-container {
  display: flex;
  flex-direction: column;
  border-radius: 0.25rem;
}

.sound-button:has(+ .button-group:hover),
.sound-button:hover {
  outline: 2px solid var(--active-color);
}

.sound-button {
  width: 100%;
  height: 80px;
  overflow: hidden;
  background: var(--button-color);
  color: var(--text-color);
  border-radius: 0.313rem;
  background-size: cover;
  background-position: center;
  outline-offset: 0.125rem;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  isolation: isolate;
}

.sound-button.playing-sound::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  animation: play-progress var(--sound-duration) linear forwards;
}

.sound-button.playing-sound.reset::after {
  animation: none;
  right: 100%;
}

@keyframes play-progress {
  from {
    right: 100%;
  }
  to {
    right: 0;
  }
}

.sound-button.focusVisible {
  outline: 2px solid var(--active-color);
}

.sound-button.has-image {
  color: white;
  --opacity: 0.3;
  text-shadow: 0px 0px 8px rgba(0, 0, 0, var(--opacity)), 4px 4px 8px rgba(0, 0, 0, var(--opacity)),
    4px -4px 8px rgba(0, 0, 0, var(--opacity)), -4px 4px 8px rgba(0, 0, 0, var(--opacity)),
    -4px -4px 8px rgba(0, 0, 0, var(--opacity));
}

.sound-button.editing-sound {
  outline: 3px solid var(--alt-text-color);
}
</style>
