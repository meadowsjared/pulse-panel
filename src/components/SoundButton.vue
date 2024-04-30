<template>
  <button
    v-if="modelValue?.name !== undefined"
    @click="playSound"
    v-on:drop="handleFileDrop"
    v-on:dragover.prevent
    :class="{ 'playing-sound': playingSound, 'has-image': modelValue.imagePath }"
    class="sound-button"
    :style="modelValue.imageUrl ? { backgroundImage: `url(${modelValue.imageUrl})` } : {}">
    <span>{{ modelValue.name || 'New Sound' }}</span>
  </button>
  <button v-else @click="addSound" v-on:drop="handleFileDrop" v-on:dragover.prevent class="sound-button add-button">
    <inline-svg :src="Plus" />
  </button>
</template>

<script setup lang="ts">
import { useSoundStore } from '../store/sound'
import { Sound } from '../../@types/sound'
import { ref } from 'vue'
import Plus from '../assets/images/plus.svg'
import InlineSvg from 'vue-inline-svg'
import { File } from '../../@types/file'
import { useSettingsStore } from '../store/settings'
import { v4 } from 'uuid'

// Define the props
const props = defineProps<{
  modelValue: Sound
}>()

// define the emits
const emits = defineEmits<(event: 'update:modelValue', value: Sound) => void>()
const playingSound = ref(false)
const numSoundsPlaying = ref(0)

const soundStore = useSoundStore()

function playSound() {
  playingSound.value = true
  numSoundsPlaying.value++
  soundStore.playSound(props.modelValue).then(() => {
    numSoundsPlaying.value--
    if (numSoundsPlaying.value < 1) {
      playingSound.value = false
    }
  })
}

function addSound() {
  const newSound: Sound = {
    name: '',
    id: props.modelValue?.id,
  }
  emits('update:modelValue', newSound)
}

/**
 * Handles the file drop event
 * @param event The drag event
 */
async function handleFileDrop(event: DragEvent) {
  event.preventDefault()
  const file: File | null = event.dataTransfer?.files[0] ?? null
  if (!file) return
  if (file.type.includes('audio')) {
    handleSoundFileDrop(file)
    return
  }
  if (file.type.includes('image')) {
    handleImageFileDrop(file)
  }
}

/**
 * Handles the sound file drop event
 * @param file The file that was dropped
 */
async function handleSoundFileDrop(file: File) {
  const settingsStore = useSettingsStore()
  const audioUrl = await settingsStore.saveFile(file)
  // if the sound is new
  if (props.modelValue.name === undefined) {
    if (file && file.path) {
      const newSound: Sound = {
        name: stripFileExtension(file.name),
        audioUrl: audioUrl,
        audioPath: file.path,
        id: v4(),
      }
      emits('update:modelValue', newSound)
    }
    return
  }

  // if the sound is not new, then they are updating an existing sound
  await settingsStore.replaceFile(props.modelValue.audioPath, file)
  // update the audioUrl and path
  const newSound: Sound = {
    ...props.modelValue,
    audioUrl: URL.createObjectURL(file),
    audioPath: file.path,
    name: stripFileExtension(file.name),
  }
  emits('update:modelValue', newSound)
}

/**
 * Handles the image file drop event
 * @param file The file that was dropped
 */
async function handleImageFileDrop(file: File) {
  const settingsStore = useSettingsStore()
  const imageUrl = await settingsStore.replaceFile(props.modelValue.imagePath, file)
  const newSound: Sound = {
    ...props.modelValue,
    imageUrl: imageUrl,
    imagePath: file.path,
  }
  emits('update:modelValue', newSound)
}

/**
 * Strips the file extension from a file name
 * @param fileName The name of the file
 */
function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '')
}
</script>

<style scoped>
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

.sound-button.has-image {
  color: white;
}

.sound-button.playing-sound {
  filter: brightness(50%);
}
</style>
