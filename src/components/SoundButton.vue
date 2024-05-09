<template>
  <button
    v-if="modelValue?.name !== undefined"
    ref="soundButton"
    @blur="buttonBlurred"
    @click="playSound(false)"
    @auxclick="emit('editSound')"
    v-on:drop="handleFileDrop"
    v-on:dragover.prevent
    :class="{
      'playing-sound': playingThisSound,
      'has-image': modelValue.imageKey,
      'edit-mode': props.displayMode === 'edit',
      'cursor-default': props.displayMode === 'edit',
      'editing-sound': settingsStore.currentEditingSound?.id === modelValue.id,
    }"
    class="sound-button relative"
    :style="modelValue.imageUrl ? { backgroundImage: `url(${modelValue.imageUrl})` } : {}">
    <span v-if="!props.modelValue.hideName" class="button-name">{{ modelValue.name || 'New Sound' }}</span>
    <button
      @click.capture="deleteSound"
      title="Delete"
      v-if="props.displayMode === 'edit'"
      class="edit-buttons absolute top-0 right-0 w-8 h-8 rotate-45">
      <inline-svg :src="Plus" />
    </button>
    <button
      @click.capture="editSound"
      title="Edit"
      v-if="props.displayMode === 'edit'"
      class="edit-buttons absolute left-0 bottom-0 w-8 h-8">
      <inline-svg :src="EditIcon" />
    </button>
    <button
      @click.capture="playSound(true)"
      title="Play"
      v-if="props.displayMode === 'edit'"
      class="edit-buttons absolute right-0 bottom-0 w-8 h-8">
      <inline-svg :src="PlayIcon" />
    </button>
  </button>
  <button v-else @click="addSound" v-on:drop="handleFileDrop" v-on:dragover.prevent class="sound-button add-button">
    <inline-svg :src="Plus" />
  </button>
</template>

<script setup lang="ts">
import { useSoundStore } from '../store/sound'
import { Sound } from '../../@types/sound'
import { computed, ref } from 'vue'
import Plus from '../assets/images/plus.svg'
import InlineSvg from 'vue-inline-svg'
import { File } from '../../@types/file'
import { DisplayMode, useSettingsStore } from '../store/settings'
import EditIcon from '../assets/images/edit.svg'
import PlayIcon from '../assets/images/play.svg'
import { stripFileExtension } from '../utils/utils'

// Define the props
const props = defineProps<{
  modelValue: Sound
  displayMode: DisplayMode
}>()

// define the emits
const emit = defineEmits<{
  (event: 'update:modelValue', value: Sound): void
  (event: 'deleteSound'): void
  (event: 'editSound'): void
}>()

const numSoundsPlaying = ref(0)
const soundButton = ref<HTMLButtonElement | null>(null)

const soundStore = useSoundStore()
const settingsStore = useSettingsStore()

const playingThisSound = computed(() => soundStore.playingSoundIds.includes(props.modelValue.id))

function deleteSound() {
  if (props.displayMode === 'edit') {
    emit('deleteSound')
  }
}

function editSound() {
  if (props.displayMode === 'edit') {
    emit('editSound')
  }
}

function playSound(forcePlay: boolean) {
  soundButton.value?.setAttribute('tabindex', '-1') // remove the tabindex so it can't be focused
  if (!forcePlay && props.displayMode === 'edit') return
  numSoundsPlaying.value++
  soundStore.playSound(props.modelValue).then(() => {
    soundButton.value?.setAttribute('tabindex', '0') // add the tabindex back
    numSoundsPlaying.value--
  })
}

function buttonBlurred() {
  if (numSoundsPlaying.value > 0 && soundButton.value?.getAttribute('tabindex') !== '0') {
    soundButton.value?.setAttribute('tabindex', '0') // add the tabindex back
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
async function handleFileDrop(event: DragEvent) {
  event.preventDefault()
  const files: FileList | null = event.dataTransfer?.files ?? null
  if (!files) return
  // iterate the FileList and handle the files
  const newSound: Sound = {
    ...props.modelValue,
  }
  // only allow a single file to be dropped for the audio and image at a time
  // (prevents orphaned files from being uploaded)
  let audioModified = false
  let imageModified = false
  for (const file of Array.from(files)) {
    if (!audioModified && file.type.includes('audio')) {
      await handleSoundFileDrop(file, newSound)
      audioModified = true
    } else if (!imageModified && file.type.includes('image')) {
      await handleImageFileDrop(file, newSound)
      imageModified = true
    }
  }
  if (audioModified || imageModified) {
    emit('update:modelValue', newSound)
  }
}

/**
 * Handles the sound file drop event
 * @param file The file that was dropped
 */
async function handleSoundFileDrop(file: File, newSound: Sound) {
  // if the sound is not new, then they are updating an existing sound
  const { fileUrl, fileKey } = await settingsStore.replaceFile(props.modelValue.audioKey, file)
  // update the audioUrl and path
  newSound.audioUrl = fileUrl
  newSound.audioKey = fileKey
  newSound.name = stripFileExtension(file.name)
}

/**
 * Handles the image file drop event
 * @param file The file that was dropped
 */
async function handleImageFileDrop(file: File, newSound: Sound) {
  const settingsStore = useSettingsStore()
  const { fileUrl, fileKey } = await settingsStore.replaceFile(props.modelValue.imageKey, file)
  newSound.imageUrl = fileUrl
  newSound.imageKey = fileKey
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
  stroke: var(--alt-bg-color);
}

.add-button > svg {
  width: 50%;
  height: 50%;
  margin: auto;
  fill: var(--alt-bg-color);
}

.sound-button {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--alt-light-text-color);
  color: var(--alt-bg-color);
  border-radius: 0.313rem;
  background-size: cover;
  background-position: center;
}

.sound-button:focus-visible {
  outline: 2px solid var(--alt-link-color);
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
