<template>
  <title-bar
    >{{ settingsStore.appName
    }}<img
      class="pulse-panel-icon"
      @click="openLink"
      :src="PulsePanelIcon"
      :title="appVersion"
      :alt="`${settingsStore.appName} icon`"
  /></title-bar>
  <div :class="['e-nuxt-container', { darkMode: settingsStore.darkMode }]">
    <side-bar>
      <div class="top-buttons">
        <router-link
          ref="routerLinks"
          @keydown.space.enter="activateRouterLink(0, true)"
          @keyup.space.enter="activateRouterLink(0, false)"
          @keypress.space.prevent="navigateTo('/soundboard')"
          to="/soundboard"
          title="Soundboard"
          :class="['menu', { keyActive: routerLinkActive[0] }]">
          <inline-svg :src="Speaker" />Soundbar
        </router-link>
        <router-link
          ref="routerLinks"
          @keydown.space.enter="activateRouterLink(1, true)"
          @keyup.space.enter="activateRouterLink(1, false)"
          @keypress.space.prevent="navigateTo('/settings')"
          to="/settings"
          title="Settings"
          :class="['menu', { keyActive: routerLinkActive[1] }]">
          <inline-svg :src="SettingsGear" />Settings
        </router-link>
      </div>
      <div class="bottom-buttons">
        <button
          :class="[
            'menu',
            'stop-button',
            { active: soundStore.playingSoundIds.length > 0, keyActive: stopAllSoundsActive },
          ]"
          @keydown.space.enter.prevent="stopAllSoundsActive = true"
          @keyup.space.enter="stopAllSoundsActive = false"
          @click="soundStore.stopAllSounds"
          title="Click to stop the current sound">
          <inline-svg :src="StopIcon" />
          Stop
        </button>
        <button
          :class="['menu', 'mute-button', { muted: settingsStore.muted, keyActive: muteButtonActive }]"
          @keydown.space.enter.prevent="muteButtonActive = true"
          @keyup.space.enter=";(muteButtonActive = false) || settingsStore.toggleMute()"
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
import Router from '../router'

const darkMode = ref(true)
const settingsStore = useSettingsStore()
const soundStore = useSoundStore()
const appVersion = `v${window.electron?.versions.app}`
const routerLinks = ref<HTMLElement[]>([])
const routerLinkActive = ref([false, false])
const stopAllSoundsActive = ref(false)
const muteButtonActive = ref(false)

function activateRouterLink(index: number, activate: boolean) {
  routerLinkActive.value[index] = activate
}

/**
 * Navigates to the given path
 * @param path path to navigate to
 */
function navigateTo(path: string) {
  Router.push(path)
}

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
settingsStore.fetchAllOutputDevices()
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
  width: calc(var(--menu-width) - var(--padding-width) * 2);
  align-items: center;
  gap: 1rem;
  color: var(--text-color);
  font-weight: bold;
}
.menu:focus-visible {
  outline: 2px solid var(--active-color);
  outline-offset: 4px;
}
.menu:active {
  color: var(--link-color);
}
.menu:active > svg {
  fill: var(--link-color);
}
.menu.keyActive {
  color: var(--link-color);
}
.menu.keyActive > svg {
  fill: var(--link-color);
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
