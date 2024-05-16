<template>
  <div :class="{ dark: props.dark, 'gap-2': !props.dark }" class="parent-div flex justify-center items-center gap-2">
    <slot />
    <div class="button-group" :class="{ dark: props.dark }">
      <button
        ref="hotkeyButton"
        class="hotkey"
        :class="{ dark: props.dark }"
        @keydown="handleKeyDown"
        title="this will be the button that pulse-panel with hold down any time sound is playing">
        {{ modelValue ?? 'No Keybind Set' }}
      </button>
      <button
        :disabled="!modelValue"
        :class="{ dark: props.dark, hide: !modelValue }"
        class="clear-button"
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

const props = defineProps<{
  modelValue: string | undefined
  dark?: boolean
}>()

const hotkeyButton = ref<HTMLButtonElement | null>(null)

const emit =
  defineEmits<(event: 'update:modelValue', value: string | undefined, previousValue: string | undefined) => void>()

function handleKeyDown(event: KeyboardEvent) {
  console.log('event.code', event.code)
  emit('update:modelValue', event.code, props.modelValue)
  hotkeyButton.value?.blur()
}

function resetHotkey() {
  emit('update:modelValue', undefined, props.modelValue)
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
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
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
