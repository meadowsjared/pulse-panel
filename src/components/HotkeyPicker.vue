<template>
  <div class="parent-div flex justify-center items-center gap-2">
    <p>Push-to-talk hotkey:</p>
    <button
      class="hotkey"
      ref="hotkeyRef"
      @keydown="handleKeyDown"
      title="this will be the button that pulse-panel with hold down any time sound is playing">
      {{ selectedHotkey ?? 'Press a key...' }}
    </button>
    <button class="clear-button" @click="selectedHotkey = null"><inline-svg :src="CloseIcon" /></button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CloseIcon from '../assets/images/close.svg'
import InlineSvg from 'vue-inline-svg'
import { useSettingsStore } from '../store/settings'

const settingsStore = useSettingsStore()
const selectedHotkey = ref<null | string>(settingsStore.ptt_hotkey ?? null)
/** this will hold the value, which we'll be able to send that key to the OS */
const hotkeyRef = ref<null | HTMLButtonElement>(null)
const displayInput = ref<null | HTMLInputElement>(null)

function handleKeyDown(event: KeyboardEvent) {
  selectedHotkey.value = event.code
  // save the value to the IndexedDB store
  settingsStore.saveString('ptt_hotkey', event.code)
}
</script>

<style scoped>
.hotkey {
  padding: 0 0.5rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 0.25rem;
  min-width: 8.75rem;
  height: 100%;
}

/** we specifically want to highlight this button, even if it's clicked */
.hotkey:focus {
  outline: var(--alt-text-color) 1px solid;
  border: var(--alt-text-color) 1px solid;
}

.parent-div {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
}

input {
  padding: 0.5rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 0.25rem;
}

.clear-button {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 0.25rem;
}
</style>
