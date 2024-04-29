<template>
  <div class="e-nuxt-container" :class="{ darkMode: settingsStore.darkMode }">
    <side-bar>
      <router-link to="/settings" class="menu"> <inline-svg :src="SettingsGear" /> Settings</router-link>
      <router-link to="/soundboard" class="menu"> <inline-svg :src="Speaker" /> Soundbar </router-link>
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

const outputDeviceId = ref<string | null>(null)
const darkMode = ref(true)
const settingsStore = useSettingsStore()

window.electron?.onDarkModeToggle((value: boolean) => {
  if (settingsStore.darkMode === value) return
  darkMode.value = value
  settingsStore.darkMode = value
})

settingsStore.fetchStringSetting('outputDeviceId').then(outputDevice => {
  outputDeviceId.value = outputDevice
})
settingsStore.fetchBooleanSetting('darkMode', true).then(darkModeValue => {
  darkMode.value = darkModeValue
})

function openURL(url: string) {
  window.open(url)
}
</script>

<style scoped>
.menu {
  display: flex;
  width: var(--menu-width);
  align-items: center;
  gap: 1rem;
  color: var(--alt-bg-color);
}
.menu > svg {
  width: 40px;
  aspect-ratio: 1;
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
