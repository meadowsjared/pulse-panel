<template>
  <div
    v-if="modelValue?.name !== undefined"
    class="sound-button-container"
    @drop="handleFileDrop(false, $event)"
    @dragover.prevent>
    <button
      ref="soundButton"
      @blur="focusVisible = false"
      @click="playSound(false)"
      @auxclick="emit('editSound')"
      @keydown="handleKeydown"
      @focus="handleFocus"
      :class="{
        'playing-sound': playingThisSound,
        'has-image': modelValue.imageKey,
        'edit-mode': props.displayMode === 'edit',
        'cursor-default': props.displayMode === 'edit',
        'editing-sound': settingsStore.currentEditingSound?.id === modelValue.id,
        focusVisible,
      }"
      class="sound-button"
      :style="modelValue.imageUrl ? { backgroundImage: `url(${modelValue.imageUrl})` } : {}">
      <span v-if="!props.modelValue.hideName" class="button-name">{{ modelValue.name || 'New Sound' }}</span>
    </button>
    <div :class="{ 'button-group': displayMode === 'edit' }">
      <button v-if="displayMode === 'edit'" @click.capture="editSound" title="Edit" class="edit-buttons">
        Edit Sound
      </button>
      <button v-if="displayMode === 'edit'" @click.capture="playSound(true)" title="Play" class="edit-buttons">
        Play Sound
      </button>
    </div>
  </div>
  <div v-else class="sound-button-container" @drop="handleFileDrop(true, $event)" @dragover.prevent>
    <button @click="addSound" class="sound-button add-button">
      <inline-svg :src="Plus" />
    </button>
    <div :class="{ 'button-group': displayMode === 'edit' }">
      <button v-if="displayMode === 'edit'" @click="addSound" title="Add Sound" class="add-button">Add Sound</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSoundStore } from '../store/sound'
import { Sound } from '../../@types/sound'
import { computed, ref } from 'vue'
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
 * used to
 * 1. track if the button is focused by keyboard events
 * 2. prevent focus events from being triggered when the sound is playing
 */
const focusVisible = ref(false)
const soundButton = ref<HTMLButtonElement | null>(null)

const soundStore = useSoundStore()
const settingsStore = useSettingsStore()

const playingThisSound = computed(() => soundStore.playingSoundIds.includes(props.modelValue.id))

function editSound() {
  if (props.displayMode === 'edit') {
    emit('editSound')
  }
}

function playSound(forcePlay: boolean) {
  if (!forcePlay && props.displayMode === 'edit') return
  numSoundsPlaying.value++
  soundStore.playSound(props.modelValue).then(() => {
    numSoundsPlaying.value--
  })
}

function handleKeydown() {
  if (!playingThisSound.value) {
    focusVisible.value = true
  }
}

function handleFocus(event: FocusEvent) {
  if (event.relatedTarget !== null) {
    focusVisible.value = true
  }
}

function addSound() {
  const newSound: Sound = {
    name: '',
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
.button-name {
  bottom: 0;
  left: 0;
  right: 0;
  font-weight: bold;
}

.edit-buttons > svg {
  width: 100%;
  height: 100%;
  fill: white;
  stroke: var(--text-color);
}

.add-button > svg {
  width: 50%;
  height: 50%;
  margin: auto;
  fill: var(--text-color);
}

.button-group {
  padding: 0.5rem 0 0 0;
}

.button-group > button {
  text-wrap: nowrap;
}

.sound-button-container {
  display: flex;
  flex-direction: column;
}

.sound-button {
  width: 100%;
  height: var(--grid-height);
  overflow: hidden;
  background: var(--button-color);
  color: var(--text-color);
  border-radius: 0.313rem;
  background-size: cover;
  background-position: center;
}

.sound-button.focusVisible:focus-visible {
  outline: 2px solid var(--alt-link-color);
}

.sound-button:focus-visible {
  outline: none;
}

.sound-button.has-image {
  color: white;
  --opacity: 0.3;
  text-shadow: 0px 0px 8px rgba(0, 0, 0, var(--opacity)), 4px 4px 8px rgba(0, 0, 0, var(--opacity)),
    4px -4px 8px rgba(0, 0, 0, var(--opacity)), -4px 4px 8px rgba(0, 0, 0, var(--opacity)),
    -4px -4px 8px rgba(0, 0, 0, var(--opacity));
}

.sound-button.playing-sound {
  filter: brightness(50%);
}

.sound-button.editing-sound {
  outline: 3px solid var(--alt-text-color);
}
</style>
