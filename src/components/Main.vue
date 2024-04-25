<template>
  <div class="e-nuxt-container" :class="{ darkMode: settingsStore.darkMode }">
    <h1 class="title text-3xl font-semibold pt-5">Electron Test App</h1>
    <div class="e-nuxt-content">
      <div class="e-nuxt-logo">
        <img style="max-width: 100%" src="../assets/electron.png" alt="electron icon" />
      </div>
      <div class="e-nuxt-system-info">
        <Header msg="test" />
        <Counter />
        <router-view />
      </div>
    </div>
    <div class="e-nuxt-links">
      <div
        class="e-nuxt-button"
        @click="openURL('https://github.com/michalzaq12/electron-nuxt')"
      >
        Github
      </div>
      <div class="e-nuxt-button" @click="openURL('https://nuxtjs.org/guide')">
        Nuxt.js
      </div>
      <div class="e-nuxt-button" @click="openURL('https://electronjs.org/docs')">
        Electron.js
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useSettingsStore } from "../store/settings"

const outputDeviceId = ref<string | null>(null)
const darkMode = ref(true)
const settingsStore = useSettingsStore()

window.electron?.onDarkModeToggle((value: boolean) => {
  if (settingsStore.darkMode === value) return
  darkMode.value = value
  settingsStore.darkMode = value
})

settingsStore.fetchStringSetting("outputDeviceId").then((outputDevice) => {
  outputDeviceId.value = outputDevice
})
settingsStore.fetchBooleanSetting("darkMode", true).then((darkModeValue) => {
  darkMode.value = darkModeValue
})

function openURL(url: string) {
  window.open(url)
}
</script>

<style scoped>
.e-nuxt-container {
  min-height: calc(100vh - 50px);
  background: var(--background-color);
  font-family: Helvetica, sans-serif;
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
