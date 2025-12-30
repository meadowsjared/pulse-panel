<template>
  <div class="main" ref="main" :style="forcedWidth ? { width: `${forcedWidth}px`, flexGrow: 0 } : {}">
    <SoundToolbar />
    <div class="soundboard" @dragover.prevent @drop.prevent="droppedOnBackground">
      <template v-for="(sound, index) in settingsStore.soundsFiltered()" :key="sound.id">
        <sound-button
          ref="buttons"
          v-if="sound"
          :key="`${sound?.id}`"
          :id="`sound-${sound.id}`"
          :class="{ placeholder: sound.isDragPreview }"
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
  <div v-if="settingsStore.currentEditingSound !== null" class="rightSideBar">
    <SoundEditor
      v-model="settingsStore.currentEditingSound"
      @update:modelValue="updateCurrentEditingSound"
      @close="closeEditor"
      @deleteSound="deleteSound($event)" />
  </div>
  <confirm-dialog
    v-model:showDialog="dialogOpen"
    title="Are you sure?"
    :message="`that you want to delete the '${soundToDelete?.title}' sound?`"
    @confirm="deleteSoundConfirmed"
    confirmText="Yes"
    cancelText="No" />
</template>

<script setup lang="ts">
import { useSettingsStore } from '../store/settings'
import { Sound } from '../@types/sound'
import { File } from '../@types/file'
import { stripFileExtension } from '../utils/utils'

const DRAG_THROTTLE_MS = 50
const INTERSECTION_THROTTLE_NORMAL = 16
const INTERSECTION_THROTTLE_DRAGGING = 100
const BUFFER_ROWS_MULTIPLIER = 0.75

const settingsStore = useSettingsStore()
let draggedIndexStart: number | null = null
let draggedSound: Sound | null = null
const skipBgDrop = ref(false)
const buttons = ref<{ ref: HTMLElement }[]>([])
const observer = ref<IntersectionObserver | null>(null)
const currentlyVisible = ref<Map<string, boolean>>(new Map())
const dragOverThrottle = ref<number | null>(null)
const intersectionThrottle = ref<number | null>(null)
const isDragging = ref(false)
/** Pending intersection entries that had their timeout cleared */
const interruptedEntries: IntersectionObserverEntry[] = []
/** Currently awaited intersection entries */
const awaitedEntries: IntersectionObserverEntry[] = []
const dialogOpen = ref(false)
const soundToDelete = ref<Sound | null>(null)
const main = ref<HTMLDivElement | null>(null)
const forcedWidth = ref<number | null>(null)
const soundEditorOpen = ref(false)

watch(
  buttons,
  async newButtons => {
    if (observer.value) {
      observer.value.disconnect()
    }
    if (newButtons.length > 0) {
      const callback = (entries: IntersectionObserverEntry[]) => {
        try {
          // Throttle intersection observer based on drag state
          const throttleDelay = isDragging.value ? INTERSECTION_THROTTLE_DRAGGING : INTERSECTION_THROTTLE_NORMAL

          if (intersectionThrottle.value) {
            // only add entries to interruptedEntries that aren't already in the array
            awaitedEntries.forEach(entry => {
              if (!interruptedEntries.includes(entry)) {
                interruptedEntries.push(entry)
              }
            })
            clearTimeout(intersectionThrottle.value)
          }

          const entriesToProcess = [...entries, ...interruptedEntries]
          awaitedEntries.push(...entriesToProcess)
          intersectionThrottle.value = window.setTimeout(() => {
            processIntersectionEntries(entriesToProcess)
            // clear interruptedEntries
            interruptedEntries.length = 0
            awaitedEntries.length = 0
            intersectionThrottle.value = null
          }, throttleDelay)
        } catch (error) {
          console.error('Error in IntersectionObserver callback:', error)
          console.trace()
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

function processIntersectionEntries(entries: IntersectionObserverEntry[]) {
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
    const bufferRows = Math.ceil(rowPositions.length * BUFFER_ROWS_MULTIPLIER)
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
    })
  if (visibilityChanges.length > 0) {
    settingsStore.updateVisibility(visibilityChanges)
  }
}

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect()
  }
  if (intersectionThrottle.value) {
    clearTimeout(intersectionThrottle.value)
  }
  if (dragOverThrottle.value) {
    clearTimeout(dragOverThrottle.value)
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
    const soundsToAdd = await Promise.all(promAr)
    await audioContext.close()

    // insert the new sounds before the new sound button
    settingsStore.insertSounds(settingsStore.sounds.length - 1, ...soundsToAdd)
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
    await Promise.all(promAr)
    await audioContext.close()

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
  isDragging.value = false

  if (dragOverThrottle.value) {
    clearTimeout(dragOverThrottle.value)
    dragOverThrottle.value = null
  }

  if (draggedIndexStart === null || draggedSound === null) return
  const sounds = settingsStore.sounds.filter(sound => !sound.isDragPreview)
  delete draggedSound.isDragPreview
  sounds.splice(draggedIndexStart, 0, pSound)
  settingsStore.sounds = sounds
  draggedIndexStart = null
  draggedSound = null
  // no need to save, because we're resetting back to the original order
}

function dragStart(pSound: Sound) {
  const index = settingsStore.sounds.indexOf(pSound)
  if (settingsStore.displayMode !== 'edit' || index === -1) return
  draggedIndexStart = index
  pSound.isDragPreview = true
  draggedSound = pSound
  isDragging.value = true
}

function drop() {
  skipBgDrop.value = true
  isDragging.value = false

  if (dragOverThrottle.value) {
    clearTimeout(dragOverThrottle.value)
    dragOverThrottle.value = null
  }

  if (settingsStore.displayMode !== 'edit') return
  if (draggedSound === null || draggedIndexStart === null) return

  delete draggedSound.isDragPreview // remove the preview flag
  settingsStore.moveSound(draggedIndexStart, settingsStore.sounds.indexOf(draggedSound))
  draggedIndexStart = null
  draggedSound = null
}

function dragOver(pSound: Sound) {
  if (settingsStore.displayMode !== 'edit') return

  if (dragOverThrottle.value) {
    clearTimeout(dragOverThrottle.value)
  }

  dragOverThrottle.value = window.setTimeout(() => {
    performDragOver(pSound)
    dragOverThrottle.value = null
  }, DRAG_THROTTLE_MS)
}

async function performDragOver(pSound: Sound) {
  if (settingsStore.displayMode !== 'edit') return
  if (draggedSound === null) return
  let index = settingsStore.sounds.indexOf(pSound)
  index = Math.min(index, settingsStore.sounds.length - 2)
  const draggedIndex = settingsStore.sounds.indexOf(draggedSound)
  if (index === draggedIndex) return
  const sounds = [...settingsStore.sounds]
  sounds.splice(draggedIndex, 1)
  sounds.splice(index, 0, draggedSound)
  settingsStore.sounds = sounds
}

function editSound(pSound: Sound) {
  if (soundEditorOpen.value === false || settingsStore.currentEditingSound?.id !== pSound.id) {
    // get the browser window's current size
    expandWindow(pSound)
  } else {
    collapseWindow()
  }
}

function closeEditor() {
  collapseWindow()
}

function handleSoundsUpdate(pSound: Sound) {
  const soundIndex = settingsStore.sounds.findIndex(sound => sound.id === pSound.id)
  if (soundIndex === -1) return
  settingsStore.sounds[soundIndex] = pSound

  // add a new sound if sound is null
  const lastSound = settingsStore.sounds[settingsStore.sounds.length - 1]
  if (lastSound.title !== undefined) {
    const newSound: Sound = { id: crypto.randomUUID() }
    settingsStore.sounds.push(newSound)
    settingsStore.saveSound(newSound)
  }
  settingsStore.saveSound(pSound)
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

async function expandWindow(pSound: Sound) {
  soundEditorOpen.value = true
  if (settingsStore.currentEditingSound === null) {
    // get the current width of the soundboard
    const soundboardWidth = main.value?.getBoundingClientRect().width ?? 0
    if (soundboardWidth === 0) return
    forcedWidth.value = soundboardWidth
    // expand the window by 300px, to allow for the SoundEditor
    await window.electron?.expandWindow(300, 0)
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  settingsStore.currentEditingSound = pSound
  // reset the size to the original size to allow for window resizing
  forcedWidth.value = null
}

async function collapseWindow() {
  if (settingsStore.currentEditingSound === null) return
  const soundboardWidth = main.value?.getBoundingClientRect().width ?? 0
  if (soundboardWidth === 0) return
  forcedWidth.value = soundboardWidth
  settingsStore.currentEditingSound = null
  await window.electron?.expandWindow(-300, 0)
  // reset the size to the original size to allow for window resizing
  forcedWidth.value = null
  soundEditorOpen.value = false
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
