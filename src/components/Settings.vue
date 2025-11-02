<template>
  <div :class="{ main: true, darkMode: settingsStore.darkMode }">
    <div class="bar">
      <h1 class="mx-auto">Settings</h1>
    </div>
    <h2>Audio Output Devices:</h2>
    <div class="mx-auto">
      <div class="audio-output-devices">
        <div v-for="(outputDevice, i) in outputDevices" :key="i" class="select-line">
          <button
            :class="{
              'delete-button': true,
              light: i !== outputDevices.length - 1,
              'opacity-0 cursor-default': i === outputDevices.length - 1 || i === 0,
              'cursor-pointer': i !== outputDevices.length - 1,
            }"
            :tabindex="i === outputDevices.length - 1 || i === 0 ? -1 : 0"
            @click="deleteOutputDevice(i)"
            title="Remove Output Device">
            <inline-svg class="w-full h-full rotate-45" :src="PlusIcon" />
          </button>
          <select-custom
            v-model="outputDevices[i]"
            @change="optionSelected($event, i)"
            defaultText="Select an output device"
            :options="
              settingsStore.allOutputDevices.map(option => ({ label: option.label, value: option.deviceId }))
            " />
          <button
            :class="{
              'play-sound-button': true,
              light: i !== outputDevices.length - 1,
              playingAudio: soundStore.outputDeviceData[i]?.playingAudio,
              'opacity-0 cursor-default': i === outputDevices.length - 1,
            }"
            @click="outputDevice && soundStore.playSound(null, [outputDevice], outputDevices, true)">
            <inline-svg :src="SpeakerIcon" class="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
    <div class="default-volume">
      <label for="default-volume-input">Default Volume:</label>
      <input-text-number id="default-volume-input" :min="0" :max="100" :bigStep="5" v-model="volumeDisplay" />
      <input-range-number :bigStep="5" v-model="volumeDisplay" />
    </div>
    <label
      >Allow overlapping sounds<input
        type="checkbox"
        v-model="allowOverlappingSound"
        @input="updateAllowOverlappingSound"
    /></label>
    <label>Dark Mode<input type="checkbox" v-model="darkMode" @input="updateDarkMode" /></label>
    <hotkey-picker
      class="push-to-talk-hotkey"
      v-model="selectedHotkey"
      :dark="false"
      @update:modelValue="selectedHotkeyUpdated"
      title="this will be the button that pulse-panel with hold down any time sound is playing"
      >Push-to-Talk Key:</hotkey-picker
    >
    <div class="downloadVBCableGroup mx-auto mt-2">
      <button @click="downloadVBCable" class="light downloadVBCable">
        Get VB-Cable<inline-svg :src="Download" class="download-icon" />
      </button>
      <div class="vb-cable-status-message" :class="{ showVBCableMessage }">{{ vbCableMessage }}</div>
    </div>
    <div class="flex justify-center mt-4 flex-col">
      <h2>Quick Tags:</h2>
      <div class="flex justify-center gap-2 flex-wrap flex-col">
        <div v-if="settingsStore.quickTags.length === 0">No tags however,</div>
        <div>{{ allTags.length }} tags are available</div>
        <div class="flex justify-center flex-wrap gap-1 cursor-grab">
          <div
            v-for="(tag, index) in settingsStore.quickTags"
            :class="['tag select-none', { dragging: tag.isPreview }]"
            draggable="true"
            @dragstart="dragStart(tag, index)"
            @dragenter.prevent="dragOver(tag)"
            @dragend="dragEnd">
            {{ tag.label
            }}<button class="remove-button" @click="removeTag(index)">
              <inline-svg :src="PlusIcon" class="rotate-45" />
            </button>
          </div>
        </div>
      </div>
      <div class="flex justify-center mt-2">
        <select-custom
          v-model="newTag"
          class="new-tag-select"
          @change="tagSelected($event)"
          defaultText="Select a tag from the list of used tags"
          :options="
            allTags.map((tag, index) => ({ label: `${tag.name} (${tag.count})`, value: tag.name || `tag-${index}` }))
          " />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import InlineSvg from 'vue-inline-svg'
import { useSettingsStore } from '../store/settings'
import { useSoundStore } from '../store/sound'
import SpeakerIcon from '../assets/images/speaker.svg'
import Download from '../assets/images/download.svg'
import { throttle } from 'lodash'
import PlusIcon from '../assets/images/plus.svg'
import { LabelActive } from '../@types/sound'

const settingsStore = useSettingsStore()
const soundStore = useSoundStore()
const outputDevices = ref<(string | null)[]>([])
const allowOverlappingSound = ref(false)
const darkMode = ref(true)
const selectedHotkey = ref<string[] | undefined>(settingsStore.ptt_hotkey ?? undefined)
const showVBCableMessage = ref(false)
const vbCableMessage = ref('')
const newTag = ref<string | null>(null)

let draggedIndexStart: number | null = null
let draggedQuickTag: LabelActive | null = null
const cancelDragEnd = ref(false)

/**
 * Displays the volume as a percentage
 */
const volumeDisplay = computed({
  get: () => Math.round(settingsStore.defaultVolume * 100),
  set: (value: number) => {
    saveVolumeDebounced(value)
  },
})

/**
 * list of unique tags from all sounds with their usage counts
 */
const allTags = computed(() => {
  const tagCounts = new Map<string, number>()
  settingsStore.sounds.forEach(sound => {
    if (sound.tags) {
      sound.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    }
  })
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ name: tag, count }))
    .filter(tagObj => !settingsStore.quickTags.some(tag => tag.label === tagObj.name)) // Filter out existing quick tags
    .sort((a, b) => {
      // Sort by count descending first, then by name ascending for ties
      if (b.count !== a.count) {
        return b.count - a.count
      }
      return a.name.localeCompare(b.name)
    })
})

const saveVolumeDebounced = throttle((value: number) => {
  const newValue = Math.round(value) / 100
  if (settingsStore.defaultVolume === newValue) return
  settingsStore.saveDefaultVolume(newValue)
}, 100)

function tagSelected(payload: Event) {
  if (!(payload.target instanceof HTMLSelectElement)) {
    console.debug('payload.target', payload.target)
    throw new Error('Event target is not a select element.')
  }
  const tag = payload.target.value
  if (tag && !settingsStore.quickTags.some(t => t.label === tag)) {
    settingsStore.addQuickTags([tag])
  }
  newTag.value = null
}

function removeTag(index: number) {
  settingsStore.removeQuickTag(index)
}

async function downloadVBCable() {
  // before we run the installer, make a backup copy of settingsStore.allOutputDevices
  // so we can know which device was added by the installer
  const originalOutputDeviceIds = settingsStore.allOutputDevices.map(device => device.deviceId)

  // set it to false to reset the animation
  showVBCableMessage.value = false
  const vbCableResult = await window.electron?.downloadVBCable(settingsStore.appName)

  if (vbCableResult?.vbCableInstallerRan) {
    // update the output devices, since they installed VB-Cable will be the default
    settingsStore.fetchAllOutputDevices().then(() => {
      // check originalOutputDeviceIds against settingsStore.allOutputDevices
      // and add the new device to the outputDevices array
      const newDevice = settingsStore.allOutputDevices.find(
        device => !originalOutputDeviceIds.includes(device.deviceId)
      )
      if (newDevice) {
        // we add the new device to the end of the array, since we know it was added by VB-Cable
        addOutputDevice(newDevice.deviceId)
      }
    })
  }

  if (vbCableResult?.errors?.some(errorObj => errorObj.message === 'User did not grant permission.')) {
    vbCableMessage.value = 'Download Permission Denied'
    showVBCableMessage.value = true
    return
    // console.error('Error downloading VB-Cable:', vbCableResult.error)
  }

  if (vbCableResult?.vbCableAlreadyInstalled) {
    // set it to true to trigger the animation
    showVBCableMessage.value = true
    vbCableMessage.value = 'VB-Cable Already Installed'
  }
}

function selectedHotkeyUpdated(event: string[] | undefined) {
  selectedHotkey.value = event
  // save the value to the IndexedDB store
  settingsStore.saveSetting('ptt_hotkey', [...(event ?? [])])
}

function dragStart(pTag: LabelActive, index: number) {
  draggedIndexStart = index
  pTag.isPreview = true
  draggedQuickTag = pTag
}

function dragOver(pTag: LabelActive) {
  if (draggedQuickTag === null) return
  const index = settingsStore.quickTags.indexOf(pTag)
  const draggedIndex = settingsStore.quickTags.indexOf(draggedQuickTag)
  if (index === draggedIndex) return
  const quickTagsTemp = [...settingsStore.quickTags]
  quickTagsTemp.splice(draggedIndex, 1) // remove the previous tag preview
  quickTagsTemp.splice(index, 0, draggedQuickTag) // add the tag preview to the new index
  settingsStore.setQuickTags(quickTagsTemp)
}

/**
 * Handles the drag end event, which is when the drag is cancelled
 * @param pTag The tag that was dragged
 */
function dragEnd() {
  if (cancelDragEnd.value) {
    cancelDragEnd.value = false
    return
  }
  if (draggedIndexStart === null || draggedQuickTag === null) return
  delete draggedQuickTag.isPreview
  draggedIndexStart = null
  draggedQuickTag = null
}

window.electron?.onDarkModeToggle((value: boolean) => {
  if (settingsStore.darkMode === value) return
  darkMode.value = value
  settingsStore.darkMode = value
})

watch(
  () => outputDevices.value,
  () => {
    if (outputDevices.value[outputDevices.value.length - 1] !== null) {
      outputDevices.value.push(null)
    }
  },
  { immediate: true }
)
settingsStore.fetchAllOutputDevices()
settingsStore.fetchSettings().then(() => {
  darkMode.value = settingsStore.darkMode
  allowOverlappingSound.value = settingsStore.allowOverlappingSound
  outputDevices.value = settingsStore.outputDevices
  selectedHotkey.value = settingsStore.ptt_hotkey ?? undefined
})

async function deleteOutputDevice(index: number) {
  if (index === 0) return
  if (index < outputDevices.value.length - 1) {
    outputDevices.value.splice(index, 1) // remove the device from the array
  } else {
    outputDevices.value[index] = null // set the device to null
  }
  saveAndPlaySoundToOutputDevice(null)
}

async function optionSelected(payload: Event, outputIndex: number) {
  if (!(payload.target instanceof HTMLSelectElement)) {
    console.debug('payload.target', payload.target)
    throw new Error('Event target is not a select element.')
  }
  const deviceId = payload.target.value
  // ensure there is a blank option at the end of the array
  // note: we re-assign the array to trigger the watcher
  addOutputDevice(deviceId, outputIndex)
}

/**
 * Add an output device to the outputDevices array
 * @param deviceId - the device to add
 * @param outputIndex - the index to add the device to
 */
function addOutputDevice(deviceId: string, outputIndex: number = outputDevices.value.length - 1) {
  outputDevices.value = [
    ...outputDevices.value.slice(0, outputIndex),
    deviceId,
    ...outputDevices.value.slice(outputIndex + 1),
  ]
  saveAndPlaySoundToOutputDevice(deviceId)
}

/**
 * Save the output devices to the settings store
 * @param device - the device to play the sound to
 */
async function saveAndPlaySoundToOutputDevice(device: string | null = null) {
  // remove the null values from the array
  const filteredOutputDevices: string[] = outputDevices.value.filter((device): device is string => device !== null)
  if ((await settingsStore.saveSetting('outputDevices', filteredOutputDevices)) && device) {
    soundStore.populatePlayingAudio(outputDevices.value.filter((device): device is string => device !== null).length)
    soundStore.playSound(
      null,
      [device],
      outputDevices.value.map(device => device ?? null),
      true
    ) // play only to the selected device
  }
}

function updateDarkMode(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) {
    console.debug('payload.target', event.target)
    throw new Error('Event target is not an input element.')
  }
  settingsStore.saveSetting('darkMode', !!event.target.checked)
}

function updateAllowOverlappingSound(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) {
    console.debug('payload.target', event.target)
    throw new Error('Event target is not an input element.')
  }
  settingsStore.saveSetting('allowOverlappingSound', !!event.target.checked)
}
</script>

<style scoped>
.default-volume {
  margin: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}
.default-volume label {
  margin: 0;
  padding: 0;
}
.default-volume input[type='text'] {
  width: 3rem;
  text-align: center;
  padding: 0;
  outline: 1px solid var(--text-color);
  outline-offset: 1px;
}
.default-volume input[type='text']:focus-visible {
  outline-color: var(--active-color);
}
.default-volume input[type='range'] {
  margin: 0 0 0.1rem 0;
}

h1 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
  color: var(--active-color);
}

h2 {
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--active-color);
}

.audio-output-devices {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0.5rem auto 1rem;
  align-items: start;
  gap: 1rem;
}

.select-line {
  display: flex;
  gap: 0.5rem;
}
.select-option {
  height: 4rem;
}

.play-sound-button,
.delete-button {
  fill: var(--text-color);
  border-radius: 0.5rem;
  padding: 0.5rem;
  width: 3rem;
  height: 2.625rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.delete-button:focus-visible,
.play-sound-button:focus-visible {
  background-color: var(--active-color);
}
.play-sound-button:active {
  background-color: var(--alt-text-color);
  color: var(--background-color);
}
.play-sound-button:hover {
  background-color: var(--link-color);
  color: var(--background-color);
  fill: var(--background-color);
}
.play-sound-button:active:hover {
  background-color: green;
}
.playingAudio {
  background-color: lightgreen;
  color: var(--background-color);
  fill: var(--background-color);
}

label:has(input[type='checkbox']) {
  display: flex;
  width: max-content;
  margin: 0.25rem auto 0 auto;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}
label {
  display: flex;
  justify-content: center;
  /* set the ring color to green */
  margin-top: 1rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  border-radius: 0.25rem;
}

input[type='checkbox'] {
  border-radius: 0.4rem;
  padding: 0.75rem;
  cursor: pointer;
}
input[type='checkbox']:checked {
  background-color: var(--active-color);
}
input[type='checkbox']:active,
input[type='checkbox']:focus-visible {
  --tw-ring-shadow: none;
}

.bar {
  color: var(--active-color);
  display: flex;
  align-items: center;
  -webkit-app-region: drag;
  position: relative;
}

.main {
  width: 100%;
  overflow: hidden auto;
  display: flex;
  flex-direction: column;
  background: var(--background-color);
}

.main::-webkit-scrollbar {
  width: var(--scrollbar-width);
}

.main::-webkit-scrollbar-thumb {
  background: var(--text-color);
  border-radius: calc(var(--scrollbar-width) / 2);
  border: 4px solid var(--input-bg-color);
}

.main::-webkit-scrollbar-track {
  background: var(--input-bg-color);
}

.push-to-talk-hotkey {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
}

.downloadVBCableGroup {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}

.downloadVBCable {
  display: flex;
  justify-content: center;
  gap: 2rem;
  padding: 0.5rem 3rem;
  align-items: center;
  margin-top: 1rem;
  width: 100%;
}
.download-icon {
  width: 1.5rem;
}

@keyframes showMessage {
  0% {
    height: 0;
    transform: translateY(-100%);
  }
  10% {
    /* Start and hold the message for a bit after transitioning */
    transform: translateY(0%);
    height: 3.5rem;
  }
  90% {
    height: 3.5rem;
    transform: translateY(0%);
  }
  100% {
    height: 0;
    /* Start hiding the message after 3 seconds */
    transform: translateY(-100%);
  }
}

.vb-cable-status-message {
  --top-overlap: 1rem;
  --transition-length: 0.4s;
  --duration: 3s;
  width: 100%;
  margin-top: calc(var(--top-overlap) * -1);
  padding-top: calc(var(--top-overlap) + 0.5rem);
  height: 0;
  border-radius: 0.5rem;
  color: var(--background-color);
  background: var(--button-accent-color);
  z-index: -1;
  transform: translateY(-100%);
  font-weight: bold;
  overflow: hidden;
}

.showVBCableMessage {
  animation: showMessage calc(2 * var(--transition-length) + var(--duration)) ease forwards;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 0 0 0 10px;
  background-color: var(--button-accent-color);
  border-radius: 500rem;
  color: var(--input-bg-color);
}

.new-tag-select {
  display: flex;
  align-items: center;
  max-width: max-content;
  min-width: 0;
  margin-bottom: 2rem;
}

.remove-button {
  padding: 0.5rem;
  background-color: transparent;
  border: none;
  cursor: pointer;
}

.tag.dragging {
  opacity: 0.5;
}
</style>
