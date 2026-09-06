<template>
  <div :class="{ main: true, darkMode: settingsStore.darkMode }">
    <div class="bar">
      <h1 class="mx-auto">Settings</h1>
    </div>
    <div class="virtual-cable-status-card" :class="{ active: !!settingsStore.virtualCableDeviceId }">
      <div class="virtual-cable-header">
        <div class="virtual-status-indicator" :class="{ online: !!settingsStore.virtualCableDeviceId }"></div>
        <span class="virtual-status-title">
          {{ settingsStore.virtualCableDeviceId ? 'Virtual Microphone: Connected & Ready' : 'Virtual Microphone: Driver Needed' }}
        </span>
      </div>
      <p class="virtual-status-desc" v-if="settingsStore.virtualCableDeviceId">
        Your voice and soundboard audio are combined automatically and routed into this device. In Discord, Zoom, or games, select <strong>CABLE Output (VB-Audio Virtual Cable)</strong> as your input device.
      </p>
      <div v-else class="virtual-status-install">
        <p class="virtual-status-desc">
          To broadcast both your microphone and soundboard clips into voice chats (Discord, Zoom, games) without echo, Pulse-Panel uses a virtual audio driver.
        </p>
        <button
          class="install-cable-btn"
          :disabled="isInstallingCable"
          @click="installVirtualCable">
          <inline-svg :src="Download" class="w-4 h-4" />
          {{ isInstallingCable ? 'Installing Driver...' : 'Install Virtual Audio Driver (One-Click)' }}
        </button>
        <div v-if="cableInstallMessage" class="cable-install-msg">{{ cableInstallMessage }}</div>
      </div>
    </div>

    <h2>Microphone Input:</h2>
    <p class="section-subtitle">Select your physical microphone. It will be mixed with soundboard clips and sent to Discord/games.</p>
    <div class="mx-auto mb-2">
      <div class="mic-controls-container">
        <div class="mic-select-line">
          <select-custom
            :modelValue="settingsStore.selectedMicrophoneId"
            @change="onMicSelected($event)"
            defaultText="Select your microphone"
            :options="
              settingsStore.allInputDevices.map(option => ({ label: option.label, value: option.deviceId }))
            " />
          <button
            :class="{
              'mic-mute-btn': true,
              muted: settingsStore.microphoneMuted,
            }"
            :title="settingsStore.microphoneMuted ? 'Unmute Microphone' : 'Mute Microphone'"
            @click="toggleMicMute">
            <inline-svg :src="settingsStore.microphoneMuted ? MicrophoneSlashIcon : MicrophoneIcon" class="w-5 h-5" />
          </button>
          <div class="device-volume-container" :title="`Microphone Volume: ${micVolumeDisplay}%`">
            <input-text-number
              class="device-volume-input"
              :min="0"
              :max="100"
              :bigStep="5"
              v-model="micVolumeDisplay"
              :title="`Microphone Volume: ${micVolumeDisplay}%`"
              aria-label="Microphone Volume" />
            <input-range-number
              class="device-volume-slider"
              :bigStep="5"
              v-model="micVolumeDisplay"
              :title="`Microphone Volume: ${micVolumeDisplay}%`"
              aria-label="Microphone Volume Slider" />
          </div>
        </div>
        <div class="mic-level-container" title="Live Microphone Input Level">
          <span class="mic-level-label">Mic Level:</span>
          <div class="mic-level-track">
            <div
              class="mic-level-fill"
              :class="{ muted: settingsStore.microphoneMuted }"
              :style="{ clipPath: `inset(0 ${100 - (settingsStore.microphoneMuted ? 0 : micLevel)}% 0 0)` }"></div>
          </div>
        </div>
      </div>
    </div>

    <h2>Headphones / Audio Monitoring:</h2>
    <p class="section-subtitle">Where you hear soundboard clips. Your physical voice is never echoed back to your headphones.</p>
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
            :modelValue="outputDevice ? outputDevice.deviceId : null"
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
            :tabindex="i === outputDevices.length - 1 ? -1 : 0"
            title="Test Audio Output"
            @click="outputDevice && soundStore.playSound(null, [outputDevice.deviceId], outputDevices.map(d => d?.deviceId ?? null), true, false, undefined, [i])">
            <inline-svg :src="SpeakerIcon" class="w-6 h-6" />
          </button>
          <div
            :class="{
              'device-volume-container': true,
              'opacity-0 pointer-events-none': i === outputDevices.length - 1,
            }"
            :title="`Device Volume: ${getDeviceVolumePercent(i)}%`">
            <input-text-number
              class="device-volume-input"
              :min="0"
              :max="100"
              :bigStep="5"
              :tabindex="i === outputDevices.length - 1 ? -1 : 0"
              :modelValue="getDeviceVolumePercent(i)"
              @update:modelValue="updateDeviceVolume(i, $event)"
              :title="`Device Volume: ${getDeviceVolumePercent(i)}%`"
              aria-label="Device Volume" />
            <input-range-number
              class="device-volume-slider"
              :bigStep="5"
              :tabindex="i === outputDevices.length - 1 ? -1 : 0"
              :modelValue="getDeviceVolumePercent(i)"
              @update:modelValue="updateDeviceVolume(i, $event)"
              :title="`Device Volume: ${getDeviceVolumePercent(i)}%`"
              aria-label="Device Volume Slider" />
          </div>
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
    <label>Close to tray<input type="checkbox" v-model="closeToTray" @input="updateCloseToTray" /></label>
    <hotkey-picker
      class="hotkey-picker"
      v-model="selectedHotkey"
      :dark="false"
      @update:modelValue="onPTTHotkeyChange"
      title="this will be the button that pulse-panel with hold down any time sound is playing"
      >Push-to-Talk Key:</hotkey-picker
    >
    <hotkey-picker
      class="hotkey-picker"
      v-model="stopHotkey"
      :dark="false"
      @update:modelValue="onStopHotkeyChange"
      title="this will be the button you can press to stop all sounds immediately"
      >Stop Sounds Key:</hotkey-picker
    >
    <div class="flex justify-center mt-4 flex-col">
      <h2>Quick Tags:</h2>
      <div class="flex justify-center gap-2 flex-wrap flex-col">
        <div v-if="settingsStore.quickTags.length === 0">No tags however,</div>
        <div>{{ allTags.length }} tags are available</div>
        <div class="flex justify-center flex-wrap gap-1 cursor-grab">
          <div
            v-for="(tag, index) in settingsStore.quickTags"
            :class="['tag select-none', { dragging: tag.isDragPreview }]"
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
            allTags.map((tag, index) => ({ label: `${tag.name} (${tag.count})`, value: tag.name ?? `tag-${index}` }))
          " />
      </div>
    </div>
    <div class="software-update-section">
      <h2>Software Update:</h2>
      <div class="update-card">
        <div class="version-row">
          <span>Current Version:</span>
          <span class="version-badge">v{{ currentAppVersion }}</span>
        </div>

        <div v-if="lastCheckedFormatted" class="last-checked-text">
          Last checked: {{ lastCheckedFormatted }}
        </div>

        <div v-if="updateStore.statusText" :class="['update-status-msg', { error: updateStore.errorMessage, available: updateStore.updateAvailable }]">
          {{ updateStore.statusText }}
        </div>

        <div v-if="updateStore.isDownloading" class="download-progress-container">
          <div class="download-progress-bar" :style="{ width: `${updateStore.downloadProgress}%` }"></div>
        </div>

        <div class="update-buttons-row">
          <button
            class="check-update-btn"
            :disabled="updateStore.isChecking || updateStore.isDownloading"
            @click="updateStore.checkForUpdates(true)">
            {{ updateStore.isChecking ? 'Checking...' : 'Check for Updates' }}
          </button>
          <button
            v-if="updateStore.updateAvailable"
            class="install-update-btn"
            :disabled="updateStore.isDownloading"
            @click="updateStore.startUpdate">
            <inline-svg :src="Download" class="w-5 h-5" />
            {{ updateStore.isDownloading ? updateStore.statusText || 'Downloading...' : `Update to ${updateStore.latestVersion}` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import InlineSvg from 'vue-inline-svg'
import { useSettingsStore } from '../store/settings'
import { useSoundStore } from '../store/sound'
import { useUpdateStore } from '../store/update'
import { audioMixer } from '../services/audioMixer'
import SpeakerIcon from '../assets/images/speaker.svg'
import MicrophoneIcon from '../assets/images/microphone.svg'
import MicrophoneSlashIcon from '../assets/images/microphone-slash.svg'
import Download from '../assets/images/download.svg'
import { throttle } from 'lodash'
import PlusIcon from '../assets/images/plus.svg'
import { LabelActive, OutputDeviceSetting } from '../@types/sound'

const settingsStore = useSettingsStore()
const soundStore = useSoundStore()
const updateStore = useUpdateStore()
const outputDevices = ref<(OutputDeviceSetting | null)[]>([])
const allowOverlappingSound = ref(false)
const darkMode = ref(true)
const closeToTray = ref(false)
const selectedHotkey = ref<string[] | undefined>(settingsStore.ptt_hotkey ?? undefined)
const stopHotkey = ref<string[] | undefined>(settingsStore.stop_hotkey ?? undefined)
const newTag = ref<string | null>(null)

const isInstallingCable = ref(false)
const cableInstallMessage = ref('')
const micLevel = ref(0)
let rafId: number | null = null

function updateMicLevelLoop() {
  micLevel.value = Math.min(100, Math.round(audioMixer.getMicLevel() * 100))
  rafId = requestAnimationFrame(updateMicLevelLoop)
}

onMounted(() => {
  audioMixer.resume().catch(() => {})
  rafId = requestAnimationFrame(updateMicLevelLoop)
})

onUnmounted(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
  }
})

const saveMicVolumeDebounced = throttle((value: number) => {
  const newValue = Math.max(0, Math.min(100, Math.round(value))) / 100
  settingsStore.saveMicrophoneVolume(newValue)
}, 100)

const micVolumeDisplay = computed({
  get: () => Math.round(settingsStore.microphoneVolume * 100),
  set: (value: number) => {
    saveMicVolumeDebounced(value)
  },
})

async function onMicSelected(payload: Event | string) {
  let deviceId: string | null = null
  if (typeof payload === 'string') {
    deviceId = payload
  } else if (payload && (payload as any).target) {
    deviceId = (payload as any).target.value
  }
  if (deviceId) {
    await settingsStore.saveMicrophoneDevice(deviceId)
  }
}

async function toggleMicMute() {
  await settingsStore.toggleMicrophoneMute()
}

async function installVirtualCable() {
  isInstallingCable.value = true
  cableInstallMessage.value = 'Installing driver in background...'
  try {
    const res = await window.electron?.downloadVBCable(settingsStore.appName)
    if (res?.vbCableInstallerRan) {
      cableInstallMessage.value = 'Driver installed! Detecting device...'
      setTimeout(async () => {
        await settingsStore.fetchAllOutputDevices()
        await settingsStore.fetchAllInputDevices()
        await settingsStore.checkVirtualCableStatus()
        isInstallingCable.value = false
        cableInstallMessage.value = ''
      }, 3000)
    } else if (res?.vbCableAlreadyInstalled) {
      cableInstallMessage.value = 'Driver already installed. Refreshing...'
      await settingsStore.fetchAllOutputDevices()
      await settingsStore.fetchAllInputDevices()
      await settingsStore.checkVirtualCableStatus()
      isInstallingCable.value = false
      setTimeout(() => {
        cableInstallMessage.value = ''
      }, 2500)
    } else {
      cableInstallMessage.value = 'Installation completed.'
      isInstallingCable.value = false
    }
  } catch {
    cableInstallMessage.value = 'Failed to run installer.'
    isInstallingCable.value = false
  }
}

const currentAppVersion = computed(() => window.electron?.versions?.app || 'Unknown')

const lastCheckedFormatted = computed(() => {
  if (!updateStore.lastCheckedTime) return null
  const date = new Date(updateStore.lastCheckedTime)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

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

function getDeviceVolumePercent(index: number): number {
  return Math.round(settingsStore.getDeviceVolume(index) * 100)
}

const saveDeviceVolumesDebounced = throttle(() => {
  settingsStore.saveOutputDevices()
}, 100)

function updateDeviceVolume(index: number, percent: number) {
  const vol = Math.max(0, Math.min(100, percent)) / 100
  if (outputDevices.value[index]) {
    outputDevices.value[index]!.volume = vol
  }
  settingsStore.setDeviceVolumeLive(index, vol)
  saveDeviceVolumesDebounced()
}

/**
 * list of unique tags from all sounds with their usage counts
 */
const allTags = computed(() => {
  const tagCounts = new Map<string, number>()
  settingsStore.sounds.forEach(sound => {
    if (sound.tags) {
      sound.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
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

function onPTTHotkeyChange(event: string[] | undefined) {
  selectedHotkey.value = event
  // save the value to the IndexedDB store
  settingsStore.saveSetting('ptt_hotkey', [...(event ?? [])])
}

function onStopHotkeyChange(event: string[] | undefined) {
  stopHotkey.value = event
  // save the value to the IndexedDB store
  settingsStore.saveSetting('stop_hotkey', [...(event ?? [])])
}

function dragStart(pTag: LabelActive, index: number) {
  draggedIndexStart = index
  pTag.isDragPreview = true
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
  delete draggedQuickTag.isDragPreview
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
settingsStore.fetchAllInputDevices()
settingsStore.checkVirtualCableStatus()
settingsStore.fetchSettings().then(() => {
  darkMode.value = settingsStore.darkMode
  closeToTray.value = settingsStore.closeToTray
  allowOverlappingSound.value = settingsStore.allowOverlappingSound
  outputDevices.value = settingsStore.outputDevices.map(d => ({ ...d }))
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
  const existing = outputDevices.value[outputIndex]
  const newSetting: OutputDeviceSetting = {
    deviceId,
    volume: existing?.volume ?? 1,
  }
  outputDevices.value = [
    ...outputDevices.value.slice(0, outputIndex),
    newSetting,
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
  const filteredOutputDevices: OutputDeviceSetting[] = outputDevices.value.filter(
    (device): device is OutputDeviceSetting => device !== null
  )
  if ((await settingsStore.saveSetting('outputDevices', filteredOutputDevices)) && device) {
    soundStore.populatePlayingAudio(filteredOutputDevices.length)
    soundStore.playSound(
      null,
      [device],
      outputDevices.value.map(d => d?.deviceId ?? null),
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

function updateCloseToTray(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) {
    console.debug('payload.target', event.target)
    throw new Error('Event target is not an input element.')
  }
  window.electron?.setCloseToTray(!!event.target.checked)
  settingsStore.saveSetting('closeToTray', !!event.target.checked)
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
  align-items: center;
}

.device-volume-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-left: 0.25rem;
  gap: 0.25rem;
}

.device-volume-input {
  width: 2.75rem;
  text-align: center;
  padding: 0;
  font-size: 0.85rem;
  outline: 1px solid var(--text-color);
  outline-offset: 1px;
  margin-bottom: 0.25rem;
}

.device-volume-input:focus-visible {
  outline-color: var(--active-color);
}

.device-volume-slider {
  width: 5.5rem;
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

.hotkey-picker {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
}

.section-subtitle {
  font-size: 0.85rem;
  opacity: 0.75;
  margin: -0.25rem 0 0.75rem 0;
  text-align: center;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.virtual-cable-status-card {
  margin: 1rem auto;
  max-width: 540px;
  width: 90%;
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  background-color: var(--input-bg-color, rgba(0, 0, 0, 0.05));
  border: 1px solid rgba(128, 128, 128, 0.2);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.virtual-cable-status-card.active {
  border-color: rgba(46, 204, 113, 0.4);
  box-shadow: 0 0 12px rgba(46, 204, 113, 0.1);
}

.virtual-cable-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
  font-size: 1rem;
}

.virtual-status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #f39c12;
  box-shadow: 0 0 6px #f39c12;
  flex-shrink: 0;
}

.virtual-status-indicator.online {
  background-color: #2ecc71;
  box-shadow: 0 0 6px #2ecc71;
}

.virtual-status-title {
  color: var(--text-color);
}

.virtual-status-desc {
  font-size: 0.85rem;
  margin-top: 0.5rem;
  margin-bottom: 0;
  line-height: 1.4;
  opacity: 0.85;
}

.virtual-status-install {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.install-cable-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: var(--active-color);
  color: white;
  border: none;
  border-radius: 0.4rem;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: opacity 0.2s, filter 0.2s;
}

.install-cable-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}

.install-cable-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.cable-install-msg {
  font-size: 0.85rem;
  color: var(--active-color);
  font-weight: 500;
}

.mic-controls-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.mic-select-line {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.mic-mute-btn {
  fill: var(--text-color);
  border-radius: 0.5rem;
  padding: 0.5rem;
  width: 3rem;
  height: 2.625rem;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--input-bg-color);
  border: 1px solid rgba(128, 128, 128, 0.2);
  cursor: pointer;
  transition: background-color 0.2s;
}

.mic-mute-btn:hover {
  background-color: var(--link-color);
  color: var(--background-color);
}

.mic-mute-btn.muted {
  background-color: #e74c3c;
  color: white;
  border-color: #e74c3c;
}

.mic-level-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
  padding: 0 0.25rem;
}

.mic-level-label {
  font-size: 0.8rem;
  opacity: 0.7;
  width: 4.5rem;
  text-align: right;
}

.mic-level-track {
  flex: 1;
  height: 8px;
  background: var(--input-bg-color, rgba(128, 128, 128, 0.2));
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(128, 128, 128, 0.15);
  position: relative;
}

.mic-level-fill {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #2ecc71 0%, #2ecc71 15%, #f1c40f 50%, #e74c3c 85%, #e74c3c 100%);
  border-radius: 4px;
  transition: clip-path 0.05s ease-out;
}

.mic-level-fill.muted {
  background: #7f8c8d;
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

.software-update-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1.5rem;
  margin-bottom: 2.5rem;
}

.update-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  padding: 1.25rem 1.75rem;
  border-radius: 0.5rem;
  background-color: var(--input-bg-color, rgba(0, 0, 0, 0.05));
  border: 1px solid rgba(128, 128, 128, 0.2);
  min-width: 320px;
  max-width: 460px;
  width: 100%;
}

.version-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
}

.version-badge {
  font-weight: bold;
  color: var(--active-color);
}

.last-checked-text {
  font-size: 0.85rem;
  opacity: 0.7;
}

.update-status-msg {
  font-size: 0.95rem;
  padding: 0.35rem 0.75rem;
  border-radius: 0.35rem;
  background-color: rgba(128, 128, 128, 0.1);
  color: var(--text-color);
  text-align: center;
}

.update-status-msg.available {
  color: var(--active-color);
  font-weight: bold;
}

.update-status-msg.error {
  color: #ff6b6b;
}

.download-progress-container {
  width: 100%;
  height: 8px;
  background-color: rgba(128, 128, 128, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.download-progress-bar {
  height: 100%;
  background-color: var(--active-color);
  transition: width 0.2s ease-in-out;
}

.update-buttons-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 0.25rem;
}

.check-update-btn,
.install-update-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.45rem 1.25rem;
  border-radius: 0.4rem;
  font-weight: bold;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s, filter 0.2s;
  border: none;
}

.check-update-btn {
  background-color: var(--button-accent-color);
  color: var(--background-color, #fff);
}

.check-update-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.check-update-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.install-update-btn {
  background-color: var(--active-color);
  color: white;
}

.install-update-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}

.install-update-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>
