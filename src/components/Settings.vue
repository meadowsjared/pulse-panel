<template>
  <div class="main" :class="{ darkMode: settingsStore.darkMode }">
    <div class="bar">
      <h1 class="mx-auto">Settings</h1>
    </div>
    <h2>Audio Output Devices:</h2>
    <div class="audio-output-devices">
      <div v-for="(outputDevice, i) in outputDevices" :key="i" class="select-line">
        <button
          class="delete-button light"
          :class="{
            'opacity-0 cursor-default': i === outputDevices.length - 1 || i === 0,
            'cursor-pointer': i !== outputDevices.length - 1,
          }"
          :tabindex="i === outputDevices.length - 1 || i === 0 ? -1 : 0"
          @click="deleteOutputDevice(i)"
          title="Remove Output Device">
          <inline-svg class="w-full h-full rotate-45" :src="Plus" />
        </button>
        <select-custom
          v-model="outputDevices[i]"
          @change="optionSelected($event, i)"
          defaultText="Select an output device"
          :options="audioOutputDevices.map(option => ({ label: option.label, value: option.deviceId }))" />
        <button
          :class="{ playingAudio: soundStore.outputDeviceData[i]?.playingAudio }"
          class="play-sound-button light"
          v-if="outputDevice"
          @click="soundStore.playSound(null, [outputDevice], outputDevices, true)">
          <inline-svg :src="SpeakerIcon" class="w-6 h-6" />
        </button>
      </div>
    </div>
    <label
      >Allow overlapping sounds<input
        type="checkbox"
        v-model="allowOverlappingSound"
        @input="updateAllowOverlappingSound"
    /></label>
    <label>Dark Mode<input type="checkbox" v-model="darkMode" @input="updateDarkMode" /></label>
    <div class="push-to-talk-hotkey">
      <hotkey-picker
        v-model="selectedHotkey"
        :dark="false"
        @update:modelValue="selectedHotkeyUpdated"
        title="this will be the button that pulse-panel with hold down any time sound is playing"
        >Push-to-Talk Key:</hotkey-picker
      >
      <div class="downloadVBCableGroup">
        <button @click="downloadVBCable" class="light downloadVBCable">
          Get VB-Cable<inline-svg :src="Download" class="download-icon" />
        </button>
        <div class="vb-cable-status-message" :class="{ vbCableInstalled }">VB-Cable already Installed</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import InlineSvg from 'vue-inline-svg'
import { useSettingsStore } from '../store/settings'
import { useSoundStore } from '../store/sound'
import SpeakerIcon from '../assets/images/speaker.svg'
import Plus from '../assets/images/plus.svg'
import Download from '../assets/images/download.svg'

const settingsStore = useSettingsStore()
const soundStore = useSoundStore()
const outputDevices = ref<(string | null)[]>([])
const audioOutputDevices = ref<MediaDeviceInfo[]>([])
const allowOverlappingSound = ref(false)
const darkMode = ref(true)
const selectedHotkey = ref<string[] | undefined>(settingsStore.ptt_hotkey ?? undefined)
const vbCableInstalled = ref(false)

settingsStore.fetchStringArray('ptt_hotkey').then(hotkey => {
  selectedHotkey.value = hotkey ?? undefined
})

async function downloadVBCable() {
  // set it to false to reset the animation
  vbCableInstalled.value = false
  const installed = await window.electron?.downloadVBCable()
  if (installed) {
    return
  }

  // set it to true to trigger the animation
  vbCableInstalled.value = true
  setTimeout(() => {
    vbCableInstalled.value = false
  }, 3000)
}

function selectedHotkeyUpdated(event: string[] | undefined) {
  selectedHotkey.value = event
  // save the value to the IndexedDB store
  settingsStore.saveStringArray('ptt_hotkey', event ?? [])
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

settingsStore.fetchStringArray('outputDevices').then(outputDevice => {
  outputDevices.value = outputDevice
})
settingsStore.getOutputDevices().then(devices => {
  audioOutputDevices.value = devices
})
settingsStore.fetchBooleanSetting('allowOverlappingSound').then(value => {
  allowOverlappingSound.value = value
})
settingsStore.fetchBooleanSetting('darkMode', true).then(value => {
  darkMode.value = value
}) // initialize it to the saved value (default to true)

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
  const device = payload.target.value
  // ensure there is a blank option at the end of the array
  // note: we re-assign the array to trigger the watcher
  if (outputDevices.value[outputDevices.value.length - 1] !== null) {
    outputDevices.value = [
      ...outputDevices.value.slice(0, outputIndex),
      device,
      ...outputDevices.value.slice(outputIndex + 1),
    ]
  }
  saveAndPlaySoundToOutputDevice(device)
}

/**
 * Save the output devices to the settings store
 * @param device - the device to play the sound to
 */
async function saveAndPlaySoundToOutputDevice(device: string | null = null) {
  // remove the null values from the array
  const filteredOutputDevices: string[] = outputDevices.value.filter((device): device is string => device !== null)
  if ((await settingsStore.saveStringArray('outputDevices', filteredOutputDevices)) && device) {
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
  settingsStore.saveBoolean('darkMode', !!event.target.checked)
}

function updateAllowOverlappingSound(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) {
    console.debug('payload.target', event.target)
    throw new Error('Event target is not an input element.')
  }
  settingsStore.saveBoolean('allowOverlappingSound', !!event.target.checked)
}
</script>

<style scoped>
h1 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
  color: var(--active-color);
}

h2 {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  color: var(--active-color);
}

.audio-output-devices {
  display: flex;
  flex-direction: column;
  width: max-content;
  margin: 0.5rem auto 1rem;
  align-items: start;
  gap: 1rem;
}

.select-line {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  width: min-content;
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
label:focus-within {
  outline: 1px dashed var(--active-color);
  outline-offset: 2px;
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
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--background-color);
  padding-bottom: 1rem;
}

.push-to-talk-hotkey {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.5ch;
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
  padding: 0.5rem 2rem;
  align-items: center;
  margin-top: 1rem;
  width: 100%;
}
.download-icon {
  width: 1.5rem;
}

.vb-cable-status-message {
  --top-overlap: 1rem;
  width: 100%;
  margin-top: calc(var(--top-overlap) * -1);
  padding-top: calc(var(--top-overlap) + 0.5rem);
  height: 0;
  border-radius: 0.5rem;
  color: var(--background-color);
  background: var(--active-color);
  z-index: -1;
  transition: transform 0.4s, height 0.4s;
  transform: translateY(-100%);
  font-weight: bold;
}

.vbCableInstalled {
  height: 3.5rem;
  transform: translateY(0);
}
</style>
