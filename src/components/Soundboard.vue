<template>
  <div class="main">
    <SoundToolbar />
    <div class="soundboard" @dragover.prevent @drop.prevent="droppedOnBackground">
      <template v-for="(sound, index) in settingsStore.soundsFiltered()" :key="sound.id">
        <sound-button
          ref="buttons"
          v-if="sound"
          :key="`${sound?.id}`"
          :id="`sound-${sound.id}`"
          :class="{ placeholder: sound.isPreview }"
          v-model="settingsStore.soundsFiltered()[index]"
          :draggable="settingsStore.displayMode === 'edit' && sound.title !== undefined"
          :displayMode="settingsStore.displayMode"
          :isVisible="sound.isVisible"
          @update:modelValue="handleSoundsUpdate"
          @file-dropped="fileDropped"
          @editSound="editSound(sound)"
          @dragstart="dragStart(sound)"
          @dragover="dragOver(sound)"
          @drop="drop"
          @dragend="dragEnd(sound)" />
      </template>
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
import { Sound } from '../@types/sound'
import { File } from '../@types/file'
import { stripFileExtension } from '../utils/utils'

const dialogOpen = ref(false)
const soundToDelete = ref<Sound | null>(null)

const settingsStore = useSettingsStore()
let draggedIndexStart: number | null = null
let draggedSound: Sound | null = null
const cancelDragEnd = ref(false)
const skipBgDrop = ref(false)
const lastFocusedElement = ref<Element | null>(null)
const buttons = ref<{ ref: HTMLElement }[]>([])
const observer = ref<IntersectionObserver | null>(null)
const currentlyVisible = ref<Map<string, boolean>>(new Map())

watch(
  buttons,
  async newButtons => {
    if (observer.value) {
      observer.value.disconnect()
    }
    if (newButtons.length > 0) {
      const callback = (entries: IntersectionObserverEntry[]) => {
        entries.forEach(entry => {
          // Get the sound ID from the element's ID attribute
          const soundId = entry.target.id?.replace('sound-', '')
          if (soundId) {
            if (entry.isIntersecting) {
              currentlyVisible.value.set(soundId, true)
            } else {
              currentlyVisible.value.delete(soundId)
            }
          }
        })

        // get all the soundButtons in the DOM
        const soundButtons = document.querySelectorAll('.sound-button')
        const { rowPositions, averageRowHeight } = getRowData(soundButtons)
        const buttonVisibilityMap: Map<string, boolean> = new Map()
        // handle buffer rows above and below the visible rows
        if (averageRowHeight > 0) {
          const bufferRows = Math.ceil(rowPositions.length * 0.75)
          soundButtons.forEach(buttonEl => {
            const soundId = buttonEl.id?.replace('sound-', '')
            const rowTop = buttonEl.getBoundingClientRect().top
            for (let i = 1; i <= bufferRows; i++) {
              // flip through all the buffer rows
              if (
                rowTop === rowPositions[0] - i * averageRowHeight ||
                rowTop === rowPositions[rowPositions.length - 1] + i * averageRowHeight
              ) {
                // if it matches this buffer row
                // mark it as visible
                buttonVisibilityMap.set(soundId, true)
              }
            }
          })
        }
        // finally, transfer all the currentlyVisible to buttonVisibility
        currentlyVisible.value.forEach((value, key) => {
          buttonVisibilityMap.set(key, value)
        })
        // now that we have the full list of visible buttons, set the visibility of any button that has changed
        let numFilteredSounds = 0
        const visibilityChanges: { isVisible: boolean; soundId: string }[] = []
        settingsStore.sounds
          .filter(
            sound =>
              (sound.isVisible && (buttonVisibilityMap.get(sound.id) ?? false) === false) ||
              (!sound.isVisible && buttonVisibilityMap.get(sound.id) === true)
          )
          .forEach(sound => {
            // transfer buttonVisibilityMap to the sounds
            const visible = buttonVisibilityMap.get(sound.id) === true
            visibilityChanges.push({ isVisible: visible, soundId: sound.id })
            if (visible) {
              sound.isVisible = true
            } else {
              delete sound.isVisible
            }
            numFilteredSounds++
          })
        if (numFilteredSounds > 0) {
          settingsStore.updateVisibility(visibilityChanges)
        }
      }

      observer.value = new IntersectionObserver(callback)
      await nextTick() // Ensure DOM is updated
      newButtons.forEach(button => {
        button.ref && observer.value?.observe(button.ref)
      })
    }
  },
  { deep: true, flush: 'post' }
)

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect()
  }
})

/**
 * Calculate row positions and average row height
 * @param soundButtons NodeList of sound button elements
 * @returns Object containing rowPositions array and averageRowHeight number
 */
function getRowData(soundButtons: NodeListOf<Element>) {
  const rowPositions: number[] = []
  soundButtons.forEach(button => {
    const sound = settingsStore.soundsFiltered().find(s => `sound-${s.id}` === button.id)
    // get if the sound is visible
    const isVisible = sound && currentlyVisible.value.get(sound.id) === true
    if (sound && isVisible) {
      const rowTop = button.getBoundingClientRect().top
      if (!rowPositions.includes(rowTop)) rowPositions.push(rowTop) // Mark this row as processed
    }
  })
  rowPositions.sort((a, b) => a - b)
  const averageRowHeight =
    rowPositions.length > 1 ? (rowPositions[rowPositions.length - 1] - rowPositions[0]) / (rowPositions.length - 1) : 0
  return { rowPositions, averageRowHeight }
}

interface CompilingSoundWithImage {
  audioFile?: File
  imageFile?: File
}

interface SoundWithImage extends CompilingSoundWithImage {
  // audioFile is required
  audioFile: File
}

function focusEditedSound() {
  if (settingsStore.currentEditingSound) {
    const soundButton = document.getElementById(`sound-${settingsStore.currentEditingSound.id}`)
    lastFocusedElement.value = soundButton
    soundButton?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

function focusLastEditedSound() {
  lastFocusedElement.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
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
    settingsStore.insertSounds(settingsStore.sounds.length - 1, ...soundsToAdd)
    settingsStore.sounds.splice(settingsStore.sounds.length - 1, 0, ...soundsToAdd)
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
    await audioContext.close()
    await Promise.all(promAr)
    if (audioModified || imageModified) {
      settingsStore.saveSound(sound)
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
  if (draggedSound === null || draggedIndexStart === null) return
  delete draggedSound.isPreview // remove the preview flag
  settingsStore.moveSound(draggedIndexStart, settingsStore.sounds.indexOf(draggedSound))
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
      settingsStore.saveSound(settingsStore.currentEditingSound)
    }
  }
}

function updateSounds() {
  if (settingsStore.sounds[settingsStore.sounds.length - 1].title !== undefined) {
    settingsStore.sounds.push({
      id: crypto.randomUUID(),
    })
  }
  settingsStore.saveSoundArray(settingsStore.sounds)
}

function deleteSound(pSound: Sound) {
  dialogOpen.value = true
  soundToDelete.value = pSound
}

function deleteSoundConfirmed() {
  if (soundToDelete.value === null) return
  const newEditingIndex = Math.min(
    settingsStore.sounds.findIndex(sound => sound.id === soundToDelete.value?.id),
    /**
     * length - 1 for last element
     * length - 2 to avoid the last element, which will be blank
     * length - 3 to allow for the element to be deleted
     **/
    settingsStore.sounds.length - 3
  )
  settingsStore.deleteSound(soundToDelete.value)
  // check if soundToDelete is the currentEditingSound
  if (settingsStore.currentEditingSound?.id === soundToDelete.value.id) {
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
    settingsStore.saveSound(settingsStore.sounds[settingsStore.sounds.length - 1])
  }
  settingsStore.saveSound(pSound)
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
  padding: 1rem 1rem 0 1rem;
  width: 100%;
  height: 100%;
  --grid-min-col-size: 80px;
  grid-template-columns: repeat(auto-fill, minmax(min(var(--grid-min-col-size), 100%), 1fr));
  --grid-height: 110px;
  grid-auto-rows: max-content;
  overflow: auto;
  --scrollbar-width: 14px;
}

.soundboard::-webkit-scrollbar {
  width: var(--scrollbar-width);
}

.soundboard::-webkit-scrollbar-thumb {
  background: var(--text-color);
  border-radius: calc(var(--scrollbar-width) / 2);
  border: 4px solid var(--input-bg-color);
}

.soundboard::-webkit-scrollbar-track {
  background: var(--input-bg-color);
}

.placeholder {
  opacity: 50%;
}

.rightSideBar {
  width: 300px;
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
