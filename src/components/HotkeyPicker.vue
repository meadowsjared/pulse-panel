<template>
  <div :class="{ dark: props.dark, 'gap-2': !props.dark }" class="parent-div flex justify-center items-center gap-2">
    <slot />
    <div class="button-group" :class="{ dark: props.dark }">
      <button
        ref="hotkeyButton"
        class="hotkey"
        :class="{ dark: props.dark, light: !props.dark }"
        @keydown.prevent="handleKeyDown"
        @keyup.prevent="handleKeyUp($event)"
        @focus="settingsStore.recordingHotkey = true"
        @blur="settingsStore.recordingHotkey = false"
        :title="props.title">
        {{ modelValue && modelValue?.length > 0 ? modelValue.join(' + ') : 'No Keybind Set' }}
      </button>
      <button
        :disabled="!modelValue"
        :class="{ hide: !modelValue || modelValue.length < 1, dark: props.dark, light: !props.dark }"
        class="clear-button light"
        @click="resetHotkey">
        <inline-svg :src="CloseIcon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import CloseIcon from '../assets/images/close.svg'
import InlineSvg from 'vue-inline-svg'
import { ref } from 'vue'
import { useSettingsStore } from '../store/settings'

const props = defineProps<{
  modelValue?: string[]
  dark?: boolean
  title: string
}>()

const settingsStore = useSettingsStore()
const hotkeyButton = ref<HTMLButtonElement | null>(null)
const buttons = ref<string[]>([])

const emit =
  defineEmits<(event: 'update:modelValue', value: string[] | undefined, previousValue: string[] | undefined) => void>()

function handleKeyDown(event: KeyboardEvent) {
  if (buttons.value.includes(event.code)) {
    return
  }
  buttons.value.push(event.code)
}

function handleKeyUp(event: KeyboardEvent) {
  setTimeout(() => {
    emit('update:modelValue', buttons.value, props.modelValue)
    buttons.value = [] // reset the buttons
    hotkeyButton.value?.blur()
  }, 100)
}

function resetHotkey() {
  emit('update:modelValue', undefined, props.modelValue)
}
</script>

<style scoped>
.hotkey {
  padding: 0 0.5rem;
  font-size: 1rem;
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
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  color: var(--text-color);
}

.button-group {
  display: flex;
  gap: 0.5rem;
}

.button-group.dark {
  width: 100%;
}

.hotkey.dark {
  flex-grow: 1;
}

.dark {
  border-radius: 0.5rem;
  justify-content: start;
}

input {
  padding: 0.5rem;
  font-size: 1rem;
  border-radius: 0.25rem;
}

.clear-button {
  padding: 0.5rem;
  border-radius: 0.25rem;
}

.clear-button.hide {
  /** make it invisible, but still take up space */
  visibility: hidden;
}
</style>
