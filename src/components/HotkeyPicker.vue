<template>
  <div :class="{ dark: props.dark, 'gap-2': !props.dark }" class="parent-div flex justify-center items-center gap-2">
    <slot />
    <div class="button-group" :class="{ dark: props.dark }">
      <button
        ref="hotkeyButton"
        class="hotkey"
        :class="{ dark: props.dark, light: !props.dark, focused: recordingHotkey }"
        @keydown="handleKeyDown"
        @keyup="handleKeyUp"
        @click="handleFocus"
        @blur="handleBlur"
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

const props = defineProps<{
  modelValue?: string[]
  dark?: boolean
  title: string
}>()

const hotkeyButton = ref<HTMLButtonElement | null>(null)
const recordingHotkey = ref(false)
const buttons = ref<string[]>([])

const emit = defineEmits<{
  (event: 'update:modelValue', newKey: string[] | undefined, oldKey: string[] | undefined): void
}>()

function handleKeyDown(event: KeyboardEvent) {
  if (!recordingHotkey.value) return
  event.preventDefault()
  const code = event.code || event.key
  if (buttons.value.includes(code)) {
    return
  }
  buttons.value.push(code)
}

function handleKeyUp(event: KeyboardEvent) {
  if (!recordingHotkey.value) return
  /**
   * if event.code isn't already in buttons, then ignore it
   * because we want to ignore keyup events for keys that weren't pressed down
   * (e.g. if the user triggers the ptt_hotkey by hitting the stop_all_hotkeys key, we don't want to record that keyup event)
   */
  if (!buttons.value.includes(event.code) && !buttons.value.includes(event.key)) return

  event.preventDefault()
  setTimeout(() => {
    emit('update:modelValue', toRaw(buttons.value), props.modelValue)
    recordingHotkey.value = false
    buttons.value = [] // reset the buttons
    hotkeyButton.value?.blur()
  }, 100)
}

function handleFocus() {
  recordingHotkey.value = true
  buttons.value = []
}

function handleBlur() {
  recordingHotkey.value = false
  buttons.value = []
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

/** handle focusing if they keyboard-navigated */
.hotkey:focus-visible {
  outline: var(--active-color) 2px solid;
}

/** handle focusing if they clicked */
.hotkey.focused {
  outline: var(--active-color) 2px solid;
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
  flex-wrap: wrap;
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

.clear-button > svg {
  stroke: currentColor;
}
</style>
