<template>
  <div class="parent-div flex justify-center items-center gap-2">
    <p>Push-to-talk hotkey:</p>
    <button
      class="hotkey"
      @keydown="handleKeyDown"
      title="this will be the button that pulse-panel with hold down any time sound is playing">
      {{ selectedHotkey ?? 'Press a key...' }}
    </button>
    <button :disabled="!selectedHotkey" :class="{ hide: !selectedHotkey }" class="clear-button" @click="resetHotkey">
      <inline-svg :src="CloseIcon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CloseIcon from '../assets/images/close.svg'
import InlineSvg from 'vue-inline-svg'
import { useSettingsStore } from '../store/settings'

const settingsStore = useSettingsStore()
settingsStore.fetchString('ptt_hotkey').then(hotkey => {
  selectedHotkey.value = hotkey
})
const selectedHotkey = ref<null | string>(settingsStore.ptt_hotkey ?? null)

function handleKeyDown(event: KeyboardEvent) {
  selectedHotkey.value = event.code
  // save the value to the IndexedDB store
  settingsStore.saveString('ptt_hotkey', event.code)
}

function resetHotkey() {
  selectedHotkey.value = null
  settingsStore.saveString('ptt_hotkey', null)
}
</script>

<style scoped>
.hotkey {
  padding: 0 0.5rem;
  font-size: 1rem;
  border: 1px solid var(--text-color);
  border-radius: 0.25rem;
  min-width: 8.75rem;
  height: 100%;
  min-height: 2rem;
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

.clear-button.hide {
  /** make it invisible, but still take up space */
  visibility: hidden;
}
</style>
