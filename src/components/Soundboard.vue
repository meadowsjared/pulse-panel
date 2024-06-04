<template>
  <div class="main">
    <SoundToolbar />
    <div class="soundboard" @dragover.prevent @drop.prevent="droppedOnBackground">
      <template v-for="(sound, i) in settingsStore.soundsFiltered" :key="sound?.id">
        <sound-button
          :data-sound-index="settingsStore.sounds.indexOf(sound)"
          :class="{ placeholder: sound.isPreview }"
          v-model="settingsStore.soundsFiltered[i]"
          :draggable="settingsStore.displayMode === 'edit' && sound.name !== undefined"
          :displayMode="settingsStore.displayMode"
          @dragstart="dragStart(sound, i)"
          @dragover="dragOver(sound)"
          @drop="drop"
          @update:modelValue="handleSoundsUpdate"
          @file-dropped="fileDropped"
          @editSound="editSound(sound)"
          @dragend="dragEnd(sound)" />
      </template>
    </div>
  </div>
  <div v-if="settingsStore.currentEditingSound !== null" class="rightSideBar">
    <SoundEditor
      v-model="settingsStore.currentEditingSound"
      @update:modelValue="updateSound"
      @deleteSound="deleteSound($event)" />
  </div>
  <confirm-dialog
    v-model:showDialog="dialogOpen"
    title="Are you sure?"
    :message="`that you want to delete the '${soundToDelete?.name}' sound?`"
    @confirm="deleteSoundConfirmed"
    confirmText="Yes"
    cancelText="No" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../store/settings'
import { Sound } from '../../@types/sound'
import { v4 } from 'uuid'
import { File } from '../../@types/file'
import { stripFileExtension } from '../utils/utils'

interface CompilingSoundWithImage {
  audioFile?: File
  imageFile?: File
}

interface SoundWithImage extends CompilingSoundWithImage {
  // audioFile is required
  audioFile: File
}

const dialogOpen = ref(false)
const soundToDelete = ref<Sound | null>(null)

const settingsStore = useSettingsStore()
let draggedIndexStart: number | null = null
let draggedSound: Sound | null = null
const cancelDragEnd = ref(false)
const skipBgDrop = ref(false)

async function fileDropped(event: DragEvent, sound: Sound, isNewSound: boolean) {
  event.preventDefault()
  const files: FileList | null = event.dataTransfer?.files ?? null
  if (!files) return
  // iterate the FileList and handle the files
  const newSound: Sound = {
    ...sound,
  }

  const fileArray = Array.from(files)

  if (isNewSound) {
    // go through all the files, and group them by name
    const combinedFiles: SoundWithImage[] = Object.values(
      fileArray.reduce<{
        [fileName: string]: CompilingSoundWithImage
      }>((prevVal, file) => {
        const fileName = stripFileExtension(file.name).toLowerCase().replace(/[`’]/g, "'")
        if (file.type.includes('audio')) {
          if (!prevVal[fileName]) {
            prevVal[fileName] = { audioFile: file }
          } else if (!prevVal[fileName].audioFile) {
            prevVal[fileName].audioFile = file
          }
        } else if (file.type.includes('image')) {
          if (!prevVal[fileName]) {
            prevVal[fileName] = { imageFile: file }
          } else if (!prevVal[fileName].imageFile) {
            prevVal[fileName].imageFile = file
          }
        }
        return prevVal
      }, {})
    ).filter((file): file is SoundWithImage => file.audioFile !== undefined)
    const promAr = combinedFiles.map(async file => {
      const newSound: Sound = {
        id: v4(),
        name: stripFileExtension(file.audioFile.name),
      }
      await handleSoundFileDrop(file.audioFile, newSound, newSound)
      if (file.imageFile) {
        await handleImageFileDrop(file.imageFile, newSound, newSound)
      }
      return newSound
    })
    const soundsToAdd = await Promise.all(promAr)
    // insert the new sounds before the new sound button
    settingsStore.sounds.splice(settingsStore.sounds.length - 1, 0, ...soundsToAdd)
    updateSound()
  } else {
    // we're updating an existing sound button
    // only allow a single file to be dropped for the audio and image at a time
    // (prevents orphaned files from being uploaded)
    let audioModified = false
    let imageModified = false
    const promAr = fileArray.map(async file => {
      if (!audioModified && file.type.includes('audio')) {
        await handleSoundFileDrop(file, newSound, sound)
        audioModified = true
      } else if (!imageModified && file.type.includes('image')) {
        await handleImageFileDrop(file, newSound, sound)
        imageModified = true
      }
    })
    await Promise.all(promAr)
    if (audioModified || imageModified) {
      settingsStore.sounds[settingsStore.sounds.findIndex(s => s.id === sound.id)] = newSound
      updateSound()
    }
  }
}

/**
 * Handles the sound file drop event
 * @param file The file that was dropped
 */
async function handleSoundFileDrop(file: File, newSound: Sound, oldSound: Sound) {
  // if the sound is not new, then they are updating an existing sound
  const { fileUrl, fileKey } = await settingsStore.replaceFile(oldSound.audioKey, file)
  // update the audioUrl and path
  newSound.audioUrl = fileUrl
  newSound.audioKey = fileKey
  newSound.name = stripFileExtension(file.name)
}

/**
 * Handles the image file drop event
 * @param file The file that was dropped
 */
async function handleImageFileDrop(file: File, newSound: Sound, oldSound: Sound) {
  const settingsStore = useSettingsStore()
  const { fileUrl, fileKey } = await settingsStore.replaceFile(oldSound.imageKey, file)
  newSound.imageUrl = fileUrl
  newSound.imageKey = fileKey
}

function droppedOnBackground(event: DragEvent) {
  if (skipBgDrop.value) {
    skipBgDrop.value = false
    return
  }
  if (draggedSound === null) {
    // treat it as if they dropped it on the new sound button
    fileDropped(event, settingsStore.sounds[settingsStore.sounds.length - 1], true)
  } else {
    // we should process this as a drop
    drop()
  }
}

/**
 * Handles the drag end event, which is when the drag is cancelled
 * @param pSound The sound that was dragged
 */
function dragEnd(pSound: Sound) {
  if (cancelDragEnd.value) {
    cancelDragEnd.value = false
    return
  }
  if (draggedIndexStart === null || draggedSound === null) return
  settingsStore.sounds = settingsStore.sounds.filter(sound => !sound.isPreview)
  delete draggedSound.isPreview
  settingsStore.sounds.splice(draggedIndexStart, 0, pSound)
  draggedIndexStart = null
  draggedSound = null
  // no need to save, because we're resetting back to the original order
}

function dragStart(pSound: Sound, index: number) {
  if (settingsStore.displayMode !== 'edit') return
  draggedIndexStart = index
  pSound.isPreview = true
  draggedSound = pSound
}

function drop() {
  skipBgDrop.value = true
  if (settingsStore.displayMode !== 'edit') return
  if (draggedSound === null) return
  delete draggedSound.isPreview // remove the preview flag
  updateSound()
  draggedIndexStart = null
  draggedSound = null
}

function dragOver(pSound: Sound) {
  if (settingsStore.displayMode !== 'edit') return
  if (draggedSound === null) return
  let index = settingsStore.sounds.indexOf(pSound)
  index = Math.min(index, settingsStore.sounds.length - 2)
  const draggedIndex = settingsStore.sounds.indexOf(draggedSound)
  settingsStore.sounds.splice(draggedIndex, 1) // remove the previous sound preview
  settingsStore.sounds.splice(index, 0, draggedSound) // add the sound preview to the new index
}

function updateSound() {
  if (settingsStore.sounds[settingsStore.sounds.length - 1].name !== undefined) {
    settingsStore.sounds.push({
      id: v4(),
    })
  }
  settingsStore.saveSoundArray('sounds', stripAudioUrls(settingsStore.sounds))
}

function deleteSound(pSound: Sound) {
  dialogOpen.value = true
  soundToDelete.value = pSound
}

function deleteSoundConfirmed() {
  if (soundToDelete.value === null) return
  const pSound = soundToDelete.value
  const newEditingIndex = Math.min(
    settingsStore.sounds.findIndex(sound => sound.id === pSound.id),
    settingsStore.sounds.length - 3
  )
  settingsStore.sounds = settingsStore.sounds.filter(sound => sound.id !== pSound.id)
  settingsStore.deleteFile(pSound.audioKey)
  settingsStore.deleteFile(pSound.imageKey)
  settingsStore.saveSoundArray('sounds', stripAudioUrls(settingsStore.sounds))
  // check if soundToDelete is the currentEditingSound
  if (settingsStore.currentEditingSound?.id === pSound.id) {
    // since we deleted soundToDelete, if we set it to newEditingIndex, it will be the next sound
    settingsStore.currentEditingSound = settingsStore.sounds[newEditingIndex] ?? null
  }
  soundToDelete.value = null
}

function editSound(pSound: Sound) {
  if (settingsStore.currentEditingSound === null || settingsStore.currentEditingSound.id !== pSound.id) {
    settingsStore.currentEditingSound = pSound
  } else {
    settingsStore.currentEditingSound = null
  }
}

function handleSoundsUpdate(pSound: Sound) {
  settingsStore.sounds[settingsStore.sounds.findIndex(sound => sound.id === pSound.id)] = pSound
  // add a new sound if sound is null
  if (settingsStore.sounds[settingsStore.sounds.length - 1].name !== undefined) {
    settingsStore.sounds.push({
      id: v4(),
    })
  }
  settingsStore.saveSoundArray('sounds', stripAudioUrls(settingsStore.sounds))
}

function stripAudioUrls(pSounds: Sound[]) {
  return pSounds.map(sound => {
    return {
      id: sound.id,
      name: sound.name,
      hotkey: sound.hotkey,
      hideName: sound.hideName,
      audioKey: sound.audioKey,
      imageKey: sound.imageKey,
      volume: sound.volume,
    }
  })
}
</script>

<style scoped>
.main {
  display: flex;
  height: 100%;
  flex-grow: 1;
  flex-direction: column;
}

.soundboard {
  gap: 0 1rem;
  display: grid;
  padding: 1rem;
  width: 100%;
  height: 100%;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  --grid-height: 110px;
  grid-auto-rows: max-content;
  overflow: auto;
}

.rightSideBar {
  width: 300px;
  height: 100%;
  background: var(--alt-bg-color);
  padding: 1rem;
  overflow-y: auto;
  overflow-x: hidden;
}

.placeholder {
  opacity: 50%;
}
</style>
