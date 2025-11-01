<template>
  <div class="title-bar" :class="{ darkMode: settingsStore.darkMode }">
    <div class="title py-[7px]">
      <slot />
    </div>
    <div class="quick-tags">
      <quick-tag-buttons />
    </div>
    <div class="buttons">
      <button @click="minimize" tabindex="-1"><inline-svg :src="minimizeIcon" /></button>
      <button @click="maximize" tabindex="-1">
        <inline-svg v-if="settingsStore.windowIsMaximized" :src="restoreIcon" />
        <inline-svg v-else :src="stopIcon" />
      </button>
      <button @click="close" tabindex="-1">
        <inline-svg :src="closeIcon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../store/settings'
import InlineSvg from 'vue-inline-svg'
import stopIcon from '../assets/images/stop.svg'
import closeIcon from '../assets/images/close.svg'
import restoreIcon from '../assets/images/restore.svg'
import minimizeIcon from '../assets/images/minimize.svg'
const settingsStore = useSettingsStore()

const minimize = () => {
  window.electron?.minimizeWindow()
}

const maximize = () => {
  window.electron?.maximizeRestoreWindow()
}

const close = () => {
  window.electron?.closeWindow()
}
</script>

<style scoped>
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: start;
  background-color: var(--title-bar-bg-color);
  color: var(--alt-bright-text-color);
  padding: 0 0 0 1rem;
  -webkit-app-region: drag;
}

.title {
  display: flex;
  align-items: center;
  font-size: 16px;
  text-wrap: nowrap;
}

.buttons {
  display: flex;
  flex-shrink: 0;
}

.buttons button {
  padding: 0.75rem;
  border: none;
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.buttons button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.quick-tags {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
