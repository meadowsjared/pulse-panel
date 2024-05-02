<template>
  <div class="e-nuxt-container" :class="{ darkMode: settingsStore.darkMode }">
    <side-bar>
      <div class="top-buttons">
        <router-link to="/soundboard" title="Soundboard" class="menu">
          <inline-svg :src="Speaker" /> Soundbar
        </router-link>
        <router-link to="/settings" title="Settings" class="menu">
          <inline-svg :src="SettingsGear" /> Settings</router-link
        >
      </div>
      <button
        class="menu"
        :class="{ edit: settingsStore.displayMode === 'edit' }"
        @click="changeMode"
        :title="settingsStore.displayMode === 'edit' ? 'click to go back to playing' : 'click to start editing'">
        <inline-svg :src="settingsStore.displayMode === 'edit' ? EditIcon : PlayIcon" />
        {{ settingsStore.displayMode === 'edit' ? 'Editing' : 'Playing' }}
      </button>
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
import EditIcon from '../assets/images/edit.svg'
import PlayIcon from '../assets/images/play.svg'

const outputDeviceId = ref<string[]>([])
const darkMode = ref(true)
const settingsStore = useSettingsStore()

window.electron?.onDarkModeToggle((value: boolean) => {
  if (settingsStore.darkMode === value) return
  darkMode.value = value
  settingsStore.darkMode = value
})

settingsStore.fetchStringArray('outputDevices').then(outputDevice => {
  outputDeviceId.value = outputDevice
})
settingsStore.fetchBooleanSetting('darkMode', true).then(darkModeValue => {
  darkMode.value = darkModeValue
})
settingsStore.fetchBooleanSetting('allowOverlappingSound')

function changeMode() {
  settingsStore.toggleDisplayMode()
}
</script>

<style scoped>
.menu {
  display: flex;
  width: var(--menu-width);
  align-items: center;
  gap: 1rem;
  color: var(--alt-bg-color);
  font-weight: bold;
}
.menu > svg {
  fill: var(--alt-bg-color);
}
.menu.edit > svg {
  fill: transparent;
}
.menu svg {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
}

.top-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.e-nuxt-container {
  min-height: calc(100vh - 50px);
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
