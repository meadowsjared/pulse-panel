<template>
  <div class="main">
    <SoundToolbar />
    <div class="soundboard-parent" @dragover.prevent @drop.prevent="droppedOnBackground">
      <Grid
        :length="settingsStore.soundsFiltered().length"
        :pageProvider="wrappedPageProvider"
        :pageSize="30"
        :pageProviderDebounceTime="500"
        :scrollTo="scrollToPosition"
        class="soundboard">
        <template v-slot:probe>
          <div class="item">Probe</div>
        </template>
        <template v-slot:placeholder="{ index, style }">
          <sound-button
            :style="style"
            v-if="settingsStore.soundsFiltered()[index]"
            :key="`${settingsStore.soundsFiltered()[index]?.id}`"
            :id="`sound-${settingsStore.soundsFiltered()[index].id}`"
            :class="{ placeholder: settingsStore.soundsFiltered()[index].isPreview }"
            :model-value="getItemWithoutImage(settingsStore.soundsFiltered()[index])"
            :draggable="
              settingsStore.displayMode === 'edit' && settingsStore.soundsFiltered()[index].title !== undefined
            "
            :displayMode="settingsStore.displayMode" />
        </template>
        <template v-slot:default="{ index, style }">
          <sound-button
            :style="style"
            v-if="settingsStore.soundsFiltered()[index]"
            :key="`${settingsStore.soundsFiltered()[index]?.id}`"
            :id="`sound-${settingsStore.soundsFiltered()[index].id}`"
            :class="{ placeholder: settingsStore.soundsFiltered()[index].isPreview }"
            v-model="settingsStore.soundsFiltered()[index]"
            :draggable="
              settingsStore.displayMode === 'edit' && settingsStore.soundsFiltered()[index].title !== undefined
            "
            :displayMode="settingsStore.displayMode"
            @update:modelValue="handleSoundsUpdate"
            @file-dropped="fileDropped"
            @editSound="editSound(settingsStore.soundsFiltered()[index])"
            @dragstart="dragStart(settingsStore.soundsFiltered()[index])"
            @dragover="dragOver(settingsStore.soundsFiltered()[index])"
            @drop="drop"
            @dragend="dragEnd(settingsStore.soundsFiltered()[index])" />
        </template>
      </Grid>
    </div>
  </div>
  <Transition name="slide-right" @after-enter="focusEditedSound" @after-leave="focusLastEditedSound">
    <div v-if="settingsStore.currentEditingSound !== null" class="rightSideBar">
      <SoundEditor
        v-model="settingsStore.currentEditingSound"
        @update:modelValue="updateCurrentEditingSound"
        @deleteSound="deleteSound($event)" />
    </div>
  </Transition>
  <confirm-dialog
    v-model:showDialog="dialogOpen"
    title="Are you sure?"
    :message="`that you want to delete the '${soundToDelete?.title}' sound?`"
    @confirm="deleteSoundConfirmed"
    confirmText="Yes"
    cancelText="No" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../store/settings'
import { Sound, SoundSegment } from '../@types/sound'
import { File } from '../@types/file'
import { stripFileExtension } from '../utils/utils'
import Grid from 'vue-virtual-scroll-grid'

const dialogOpen = ref(false)
const soundToDelete = ref<Sound | null>(null)

const settingsStore = useSettingsStore()
let draggedIndexStart: number | null = null
let draggedSound: Sound | null = null
const cancelDragEnd = ref(false)
const skipBgDrop = ref(false)
const lastFocusedElement = ref<Sound | null>(null)
const scrollToPosition = ref<number | undefined>(undefined)

interface CompilingSoundWithImage {
  audioFile?: File
  imageFile?: File
}

interface SoundWithImage extends CompilingSoundWithImage {
  // audioFile is required
  audioFile: File
}

async function pageProvider(pageNumber: number, pageSize: number): Promise<Sound[]> {
  console.log('Requesting page')
  const start = pageNumber * pageSize
  const end = Math.min(start + pageSize, settingsStore.soundsFiltered().length)

  // Return the slice of sounds for this page
  return settingsStore.soundsFiltered({ start, end })
}

const wrappedPageProvider = computed(() => {
  return async (pageNumber: number, pageSize: number) => {
    const sounds = await pageProvider(pageNumber, pageSize)
    return sounds.map(sound => ({ sound }))
  }
})

function getItemWithoutImage(item: Sound) {
  const itemCopy = { ...item }
  delete itemCopy.imageUrl
  delete itemCopy.imageKey
  return itemCopy
}

function focusEditedSound() {
  if (settingsStore.currentEditingSound) {
    lastFocusedElement.value = settingsStore.currentEditingSound
    focusSound(settingsStore.currentEditingSound)
  }
}

function focusLastEditedSound() {
  focusSound(lastFocusedElement.value)
}

// update scrollToPosition to the index of pSound
function focusSound(pSound: Sound | null) {
  const index = settingsStore.soundsFiltered().findIndex(sound => sound.id === pSound?.id)
  if (index !== -1) {
    scrollToPosition.value = index
  }
}

async function fileDropped(event: DragEvent, sound: Sound, isNewSound: boolean) {
  event.preventDefault()
  const files: FileList | null = event.dataTransfer?.files ?? null
  if (!files) return
  // iterate the FileList and handle the files
  const oldImageKey = sound.imageKey
  const oldAudioKey = sound.audioKey

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
    const audioContext = new AudioContext()
    const promAr = combinedFiles.map(async file => {
      const newSound: Sound = {
        id: crypto.randomUUID(),
        title: stripFileExtension(file.audioFile.name),
      }
      await handleSoundFileDrop(file.audioFile, newSound, audioContext)
      if (file.imageFile) {
        await handleImageFileDrop(file.imageFile, newSound)
      }
      return newSound
    })
    audioContext.close()
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
    const audioContext = new AudioContext()
    const promAr = fileArray.map(async file => {
      if (!audioModified && file.type.includes('audio')) {
        await handleSoundFileDrop(file, sound, audioContext, oldAudioKey)
        audioModified = true
      } else if (!imageModified && file.type.includes('image')) {
        await handleImageFileDrop(file, sound, oldImageKey)
        imageModified = true
      }
    })
    audioContext.close()
    await Promise.all(promAr)
    if (audioModified || imageModified) {
      updateSound()
    }
  }
}

/**
 * Handles the sound file drop event
 * @param file The file that was dropped
 */
async function handleSoundFileDrop(file: File, newSound: Sound, audioContext: AudioContext, oldAudioKey?: string) {
  // if the sound is not new, then they are updating an existing sound
  const { fileUrl, fileKey } = await settingsStore.replaceFile(oldAudioKey, file)
  // update the audioUrl and path
  newSound.audioUrl = fileUrl
  newSound.audioKey = fileKey
  newSound.duration = await settingsStore.getAudioDuration(fileUrl, audioContext)
  newSound.title = stripFileExtension(file.name)
}

/**
 * Handles the image file drop event
 * @param file The file that was dropped
 */
async function handleImageFileDrop(file: File, newSound: Sound, oldImageKey?: string) {
  const settingsStore = useSettingsStore()
  const { fileUrl, fileKey } = await settingsStore.replaceFile(oldImageKey, file)
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

function dragStart(pSound: Sound) {
  const index = settingsStore.sounds.indexOf(pSound)
  if (settingsStore.displayMode !== 'edit' || index === -1) return
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
  if (index === draggedIndex) return
  settingsStore.sounds.splice(draggedIndex, 1) // remove the previous sound preview
  settingsStore.sounds.splice(index, 0, draggedSound) // add the sound preview to the new index
}

function updateCurrentEditingSound() {
  if (settingsStore.currentEditingSound !== null) {
    const currentSound = settingsStore.currentEditingSound
    const index = settingsStore.sounds.findIndex(sound => sound.id === currentSound.id)
    if (index !== -1) {
      settingsStore.sounds[index] = settingsStore.currentEditingSound
      updateSound()
    }
  }
}

function updateSound() {
  if (settingsStore.sounds[settingsStore.sounds.length - 1].title !== undefined) {
    settingsStore.sounds.push({
      id: crypto.randomUUID(),
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
  if (settingsStore.sounds[settingsStore.sounds.length - 1].title !== undefined) {
    settingsStore.sounds.push({
      id: crypto.randomUUID(),
    })
  }
  settingsStore.saveSoundArray('sounds', stripAudioUrls(settingsStore.sounds))
}

function stripAudioUrls(pSounds: Sound[]) {
  return pSounds.map(sound => {
    return {
      id: sound.id,
      title: sound.title,
      hideTitle: sound.hideTitle,
      tags: sound.tags,
      hotkey: sound.hotkey,
      audioKey: sound.audioKey,
      imageKey: sound.imageKey,
      volume: sound.volume,
      color: sound.color,
      soundSegments: stripSegmentIds(sound.soundSegments),
    }
  })
}

function stripSegmentIds(pSegments: SoundSegment[] | undefined) {
  if (!pSegments) return undefined
  return pSegments?.map(segment => {
    return {
      start: segment.start,
      end: segment.end,
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

.soundboard-parent {
  height: 100%;
  overflow-y: auto;
  padding-top: 1rem;
}

.soundboard {
  gap: 0 1rem;
  display: grid;
  padding: 0 1rem 0 1rem;
  width: 100%;
  height: 100%;
  --grid-min-col-size: 80px;
  grid-template-columns: repeat(auto-fill, minmax(min(var(--grid-min-col-size), 100%), 1fr));
  --grid-height: 110px;
  grid-auto-rows: max-content;
  overflow: auto;
  --scrollbar-width: 14px;
}

.soundboard-parent::-webkit-scrollbar {
  width: var(--scrollbar-width);
}

.soundboard-parent::-webkit-scrollbar-thumb {
  background: var(--text-color);
  border-radius: calc(var(--scrollbar-width) / 2);
  border: 4px solid var(--input-bg-color);
}

.soundboard-parent::-webkit-scrollbar-track {
  background: var(--input-bg-color);
}

.placeholder {
  opacity: 50%;
}

.rightSideBar {
  width: 300px;
  min-width: 208px;
  overflow: hidden;
  background: var(--alt-bg-color);
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: width 0.3s ease;
  min-width: 0;
}

.slide-right-enter-from,
.slide-right-leave-to {
  width: 0;
}
</style>
