<template>
  <title-bar
    >Pulse Panel<img
      class="pulse-panel-icon"
      @click="openLink"
      :src="PulsePanelIcon"
      :title="appVersion"
      alt="pulse panel icon"
  /></title-bar>
  <div class="e-nuxt-container" :class="{ darkMode: settingsStore.darkMode }">
    <side-bar>
      <div class="top-buttons">
        <router-link to="/soundboard" title="Soundboard" class="menu">
          <inline-svg :src="Speaker" />Soundbar
        </router-link>
        <router-link to="/settings" title="Settings" class="menu">
          <inline-svg :src="SettingsGear" />Settings
        </router-link>
      </div>
      <div class="bottom-buttons">
        <button
          class="menu stop-button"
          :class="{ active: soundStore.playingSoundIds.length > 0 }"
          @click="soundStore.stopAllSounds"
          title="Click to stop the current sound">
          <inline-svg :src="StopIcon" />
          Stop
        </button>
        <button
          class="menu mute-button"
          :class="{ muted: settingsStore.muted }"
          @click="settingsStore.toggleMute"
          :title="settingsStore.muted ? 'Click to unmute soundboard' : 'Click to mute soundboard'">
          <inline-svg :src="Headphones" />
          {{ settingsStore.muted ? 'Muted' : 'Unmuted' }}
        </button>
      </div>
    </side-bar>
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../store/settings'
import InlineSvg from 'vue-inline-svg'
import SettingsGear from '../assets/images/settings-gear.svg'
import Speaker from '../assets/images/speaker.svg'
import StopIcon from '../assets/images/stop.svg'
import Headphones from '../assets/images/headphones.svg'
import { useSoundStore } from '../store/sound'
import PulsePanelIcon from '../assets/pulse-panel_icon_center.webp'

const darkMode = ref(true)
const settingsStore = useSettingsStore()
const soundStore = useSoundStore()
const appVersion = `v${window.electron?.versions.app}`

function openLink() {
  window.electron?.openExternalLink('https://github.com/counsel-of-Big-Brains/pulse-panel')
}

window.electron?.onDarkModeToggle((value: boolean) => {
  if (settingsStore.darkMode === value) return
  darkMode.value = value
  settingsStore.darkMode = value
})

settingsStore.fetchStringArray('ptt_hotkey')
settingsStore.fetchMute()
settingsStore.fetchStringArray('outputDevices')
settingsStore.fetchBooleanSetting('darkMode', true).then(darkModeValue => {
  darkMode.value = darkModeValue
})
settingsStore.fetchBooleanSetting('allowOverlappingSound')
settingsStore.fetchSoundSetting('sounds')
settingsStore.fetchDefaultVolume()
</script>

<style scoped>
.pulse-panel-icon {
  width: 20px;
  aspect-ratio: 1;
  margin-left: 0.5rem;
  -webkit-app-region: no-drag;
  cursor: pointer;
}

.menu {
  display: flex;
  width: var(--menu-width);
  align-items: center;
  gap: 1rem;
  color: var(--text-color);
  font-weight: bold;
}
.menu > svg {
  fill: var(--text-color);
}

.change-mode.edit > svg {
  stroke: var(--text-color);
}

.menu.edit > svg {
  fill: transparent;
}
.menu svg {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
}

.top-buttons,
.bottom-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.bottom-buttons svg {
  stroke: none;
}

.router-link-active {
  color: var(--active-color);
}
.router-link-active > svg {
  fill: var(--active-color);
}

.stop-button.active {
  color: var(--active-color);
}

.stop-button.active > svg {
  fill: var(--active-color);
  color: var(--active-color);
}

.mute-button {
  position: relative;
  overflow: hidden;
}

.mute-button > svg {
  fill: var(--text-color);
  transition: fill 300ms ease-in-out;
}

.mute-button.muted > svg {
  fill: red; /* sets the color of the headphones */
}

.mute-button::after {
  content: '';
  position: absolute;
  left: -0.4rem;
  width: 2.8rem;
  height: 0.25rem;
  transform: translate(2.2rem, -2.2rem) rotate(135deg);
  background: var(--text-color);
  transition: transform 300ms ease-in-out, background 300ms ease-in-out 300ms;
}

.mute-button.muted::after {
  background: red; /* sets the color of the slash */
  transform: translate(0, 0) rotate(135deg);
}

.e-nuxt-container {
  height: calc(100vh - 38px);
  background: var(--background-color);
  font-family: Helvetica, sans-serif;
  display: flex;
}

.e-nuxt-content {
  display: flex;
  justify-content: space-around;
  padding-top: 50px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.e-nuxt-logo {
  width: 400px;
}

.e-nuxt-system-info {
  background: var(--background-color);
  padding: 20px;
  border-top: 1px solid #397c6d;
  border-bottom: 1px solid #397c6d;
}

.e-nuxt-links {
  padding: 25px 0;
  display: flex;
  justify-content: center;
}

.e-nuxt-button {
  color: var(--link-color);
  padding: 5px 20px;
  border: 1px solid #397c6d;
  margin: 0 20px;
  border-radius: 15px;
  font-size: 1rem;
}

.e-nuxt-button:hover {
  cursor: pointer;
  color: white;
  background-color: #397c6d;
}
</style>
