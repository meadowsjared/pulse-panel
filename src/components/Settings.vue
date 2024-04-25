<template>
  <div class="main" :class="{ darkMode: settingsStore.darkMode }">
    <div class="bar">
      <h1 class="mx-auto">Settings</h1>
      <inline-svg
        :src="CloseIcon"
        class="w-6 h-6 cursor-pointer close-button"
        @click="close"
      />
    </div>
    <div class="audio-output-devices">
      <h2>Audio Output Devices:</h2>
      <div class="select-line">
        <select @change="optionSelected" v-model="outputDeviceId">
          <option
            v-for="device in audioOutputDevices"
            :key="device.deviceId"
            :value="device.deviceId"
          >
            {{ device.label }}
          </option>
        </select>
        <button
          :class="{ playingAudio: soundStore.playingAudio }"
          class="play-sound-button"
          v-if="outputDeviceId"
          @click="soundStore.playSound(outputDeviceId)"
        >
          <inline-svg :src="SpeakerIcon" class="w-6 h-6" />
        </button>
      </div>
    </div>
    <div class="scroll-remaining">
      <label
        >Allow overlapping sounds<input
          type="checkbox"
          v-model="allowOverlappingSound"
          @input="updateAllowOverlappingSound"
      /></label>
      <label
        >Dark Mode<input type="checkbox" v-model="darkMode" @input="updateDarkMode"
      /></label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"
import InlineSvg from "vue-inline-svg"
import CloseIcon from "../assets/images/close.svg"
import { useSettingsStore } from "../store/settings"
import { useSoundStore } from "../store/sound"
import SpeakerIcon from "../assets/images/speaker.svg"

const settingsStore = useSettingsStore()
const soundStore = useSoundStore()
const outputDeviceId = ref<string | null>(null)
const audioOutputDevices = ref<MediaDeviceInfo[]>([])
const allowOverlappingSound = ref(false)
const darkMode = ref(true)

window.electron?.onDarkModeToggle((value: boolean) => {
  if (settingsStore.darkMode === value) return
  darkMode.value = value
  settingsStore.darkMode = value
})

onMounted(async () => {
  settingsStore.fetchStringSetting("outputDeviceId").then((outputDevice) => {
    outputDeviceId.value = outputDevice
  })
  settingsStore.getOutputDevices().then((devices) => {
    audioOutputDevices.value = devices
  })
  allowOverlappingSound.value = await settingsStore.fetchBooleanSetting(
    "allowOverlappingSound"
  )
  darkMode.value = await settingsStore.fetchBooleanSetting("darkMode", true) // initialize it to the saved value (default to true)
})

async function optionSelected(payload: Event) {
  if (!(payload.target instanceof HTMLSelectElement)) {
    console.debug("payload.target", payload.target)
    throw new Error("Event target is not a select element.")
  }
  const deviceId = payload.target?.value
  if (await settingsStore.saveString("outputDeviceId", deviceId)) {
    outputDeviceId.value = deviceId
    soundStore.playSound(deviceId)
  }
}

function updateDarkMode(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) {
    console.debug("payload.target", event.target)
    throw new Error("Event target is not an input element.")
  }
  settingsStore.saveBoolean("darkMode", !!event.target.checked)
}

function updateAllowOverlappingSound(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) {
    console.debug("payload.target", event.target)
    throw new Error("Event target is not an input element.")
  }
  settingsStore.saveBoolean("allowOverlappingSound", !!event.target.checked)
}

function close() {
  window.close()
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
  display: inline-block;
  width: max-content;
  margin: 0.5rem auto;
  flex-direction: column;
  overflow: hidden;
  max-height: 100%;
  align-items: start;
}

select {
  border-radius: 0.5rem;
}
select:focus {
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

.play-sound-button {
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  width: 3rem;
  padding-left: 0rem;
  height: 2.625rem;
  border: 1px solid var(--text-color);
  display: flex;
  justify-content: center;
  align-items: center;
}
.play-sound-button:focus {
  background-color: var(--alt-link-color);
}
.play-sound-button:active {
  background-color: var(--alt-text-color);
  color: var(--background-color);
}
.play-sound-button:hover {
  background-color: var(--link-color);
  color: var(--background-color);
}
.play-sound-button:active:hover {
  background-color: green;
}
.playingAudio {
  background-color: lightgreen;
  color: var(--background-color);
}

label:has(input[type="checkbox"]) {
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

input[type="checkbox"] {
  border-radius: 0.4rem;
  padding: 0.75rem;
  cursor: pointer;
}
input[type="checkbox"]:checked {
  background-color: var(--link-color);
}
input[type="checkbox"]:active,
input[type="checkbox"]:focus {
  --tw-ring-shadow: none;
}

.bar {
  background: var(--alt-bg-color);
  color: var(--accent-text-color);
  display: flex;
  align-items: center;
  -webkit-app-region: drag;
  position: relative;
}

.close-button {
  cursor: pointer;
  position: absolute;
  right: 0.5rem;
  -webkit-app-region: no-drag;
}

.scroll-remaining {
  overflow-y: auto;
  margin-top: 0.5rem;
  flex: 1;
}

.main {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--background-color);
}
</style>
