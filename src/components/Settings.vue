<template>
  <div class="main" :class="{ darkMode: settingsStore.darkMode }">
    <div class="bar">
      <h1 class="mx-auto">Settings</h1>
    </div>
    <h2>Audio Output Devices:</h2>
    <div class="audio-output-devices">
      <div
        v-for="(outputDeviceId, i) in outputDevices"
        :key="(outputDeviceId ?? 'null') + i"
        :jared="(outputDeviceId ?? 'null') + i"
        class="select-line">
        <button
          class="delete-button"
          :class="{
            'opacity-0 cursor-default': i === outputDevices.length - 1 || i === 0,
            'cursor-pointer': i !== outputDevices.length - 1,
          }"
          @click="deleteOutputDevice(i)"
          title="Remove Output Device">
          <inline-svg class="w-full h-full rotate-45" :src="Plus" />
        </button>
        <select @change="optionSelected($event, i)" v-model="outputDevices[i]">
          <option v-for="device in audioOutputDevices" :key="device.deviceId" :value="device.deviceId">
            {{ device.label }}
          </option>
        </select>
        <button
          :class="{ playingAudio: soundStore.outputDeviceData[i]?.playingAudio }"
          class="play-sound-button"
          v-if="outputDeviceId"
          @click="soundStore.playSound(null, [outputDeviceId], outputDevices, true)">
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
        @update:modelValue="selectedHotkeyUpdated"
        title="this will be the button that pulse-panel with hold down any time sound is playing"
        >Push-to-Talk Key:</hotkey-picker
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import InlineSvg from 'vue-inline-svg'
import { useSettingsStore } from '../store/settings'
import { useSoundStore } from '../store/sound'
import SpeakerIcon from '../assets/images/speaker.svg'
import Plus from '../assets/images/plus.svg'

const settingsStore = useSettingsStore()
const soundStore = useSoundStore()
const outputDevices = ref<(string | null)[]>([])
const audioOutputDevices = ref<MediaDeviceInfo[]>([])
const allowOverlappingSound = ref(false)
const darkMode = ref(true)

settingsStore.fetchStringArray('ptt_hotkey').then(hotkey => {
  selectedHotkey.value = hotkey ?? undefined
})
const selectedHotkey = ref<string[] | undefined>(settingsStore.ptt_hotkey ?? undefined)

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

onMounted(async () => {
  settingsStore.fetchStringArray('outputDevices').then(outputDevice => {
    outputDevices.value = outputDevice
  })
  settingsStore.getOutputDevices().then(devices => {
    audioOutputDevices.value = devices
  })
  allowOverlappingSound.value = await settingsStore.fetchBooleanSetting('allowOverlappingSound')
  darkMode.value = await settingsStore.fetchBooleanSetting('darkMode', true) // initialize it to the saved value (default to true)
})

async function deleteOutputDevice(index: number) {
  if (index === 0) return
  if (index < outputDevices.value.length - 1) {
    outputDevices.value.splice(index, 1) // remove the device from the array
  } else {
    outputDevices.value[index] = null // set the device to null
  }
  saveOutputDevices(null)
}

async function optionSelected(payload: Event, outputIndex: number) {
  if (!(payload.target instanceof HTMLSelectElement)) {
    console.debug('payload.target', payload.target)
    throw new Error('Event target is not a select element.')
  }
  const device = payload.target?.value
  // ensure there is a blank option at the end of the array
  // note: we re-assign the array to trigger the watcher
  outputDevices.value = [
    ...outputDevices.value.slice(0, outputIndex),
    device,
    ...outputDevices.value.slice(outputIndex + 1),
  ]

  saveOutputDevices(device)
}

/**
 * Save the output devices to the settings store
 * @param device - the device to play the sound to
 */
async function saveOutputDevices(device: string | null = null) {
  // remove the null values from the array
  const filteredOutputDevices: string[] = outputDevices.value.filter((device): device is string => device !== null)
  if ((await settingsStore.saveStringArray('outputDevices', filteredOutputDevices)) && device) {
    soundStore.populatePlayingAudio(outputDevices.value.filter((device): device is string => device !== null).length)
    soundStore.playSound(null, [device], outputDevices.value) // play only to the selected device
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
  font-size: 1.5rem;
  color: var(--alt-light-text-color);
}

h2 {
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}

.audio-output-devices {
  display: flex;
  flex-direction: column;
  width: max-content;
  margin: 0.5rem auto 1rem;
  align-items: start;
  gap: 1rem;
}

select {
  border-radius: 0.5rem;
  border-color: var(--text-color);
}
select:focus-visible {
  --tw-border-opacity: 1;
  border-color: var(--link-color);
  --tw-ring-opacity: 1;
  --tw-ring-color: var(--link-color);
}
select > * {
  border-radius: 0.5rem;
}

option:checked {
  background-color: var(--accent-text-color);
  color: var(--background-color);
}
option {
  cursor: pointer;
  background-color: var(--background-color);
  color: var(--text-color);
}

.select-line {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  width: min-content;
}

.play-sound-button,
.delete-button {
  fill: var(--text-color);
  border-radius: 0.5rem;
  padding: 0.5rem;
  width: 3rem;
  height: 2.625rem;
  border: 1px solid var(--text-color);
  display: flex;
  justify-content: center;
  align-items: center;
}
.play-sound-button:focus-visible {
  background-color: var(--alt-link-color);
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
  outline: 1px dashed var(--link-color);
  outline-offset: 2px;
}

input[type='checkbox'] {
  border-radius: 0.4rem;
  padding: 0.75rem;
  cursor: pointer;
}
input[type='checkbox']:checked {
  background-color: var(--link-color);
}
input[type='checkbox']:active,
input[type='checkbox']:focus-visible {
  --tw-ring-shadow: none;
}

.bar {
  background: var(--alt-bg-color);
  color: var(--alt-light-text-color);
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
  justify-content: center;
  align-items: baseline;
  gap: 0.5ch;
  margin-top: 1rem;
}
</style>
