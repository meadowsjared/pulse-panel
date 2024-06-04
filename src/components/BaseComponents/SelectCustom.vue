<template>
  <div class="select-parent">
    <button
      ref="selectedOption"
      class="selected-option"
      :class="{ focused: focused }"
      @click="toggleDropdown"
      @focus="handleFocus"
      @blur="handleBlur"
      v-bind="$attrs">
      {{ localValue?.label ?? props.defaultText }}
      <inline-svg :src="SelectArrow" class="select-arrow" :class="{ flipped: isOpen }" />
    </button>
    <div class="sizing-div">
      <div v-for="option in options" :key="option.value">{{ option.label }}</div>
    </div>
    <ul v-if="isOpen" class="dropdown">
      <button
        ref="optionRefs"
        v-for="option in options"
        :key="option.value"
        class="option-value"
        :class="{ selected: option.value === props.modelValue }"
        @click="selectOption(option)"
        @keydown.prevent="handleKeypress"
        @focus="handleFocus"
        @blur="handleBlur">
        {{ option.label }}
      </button>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import InlineSvg from 'vue-inline-svg'
import SelectArrow from '../../assets/images/select-arrow.svg'

interface LabelValue {
  label: string
  value: string
}

const emit = defineEmits<{
  (event: 'update:modelValue', value: string | null): void
  (change: 'change', value: Event): void
}>()

const props = withDefaults(
  defineProps<{
    modelValue: string | null
    options: LabelValue[]
    defaultText?: string
  }>(),
  {
    defaultText: 'Select an option',
  }
)

const isOpen = ref(false)
const focusedOptionIndex = ref<null | number>(null)
const optionRefs = ref<HTMLElement[]>([])
const focused = ref(false)
const selectedOption = ref<HTMLDivElement | null>(null)
const localValue = ref<LabelValue | null>(findOptionFromValue(props.modelValue))

// update our local value any time the modelValue changes
watch(
  () => [props.modelValue, props.options],
  () => {
    if (props.modelValue === localValue.value?.value) return
    localValue.value = findOptionFromValue(props.modelValue)
  }
)

function toggleDropdown() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    focusedOptionIndex.value = props.options.findIndex(option => option.value === props.modelValue)
    // allow the options to open before focusing the current value
    nextTick(() => {
      if (focusedOptionIndex.value === null) return
      optionRefs.value[focusedOptionIndex.value]?.focus()
    })
  }
}

/**
 * Selects an option and emits the selected value
 * @param option - The selected option
 */
function selectOption(option: LabelValue) {
  // selParentRef.value?.focus()
  if (option.value !== props.modelValue) {
    localValue.value = option
    emit('update:modelValue', option.value)
    emitHTMLSelectChange(option)
  }
  isOpen.value = false
  selectedOption.value?.focus()
}

/**
 * Finds a match in prop.options from a value
 * @param value - The value to search for
 * @returns The option if found, otherwise null
 */
function findOptionFromValue(value: string | null) {
  if (value === null) return null
  return props.options.find(option => option.value === value) ?? null
}

/**
 * Emits a change event on the select element
 * @param option - The selected option
 */
function emitHTMLSelectChange(option: LabelValue) {
  const selectElement = document.createElement('select')
  const optionElement = document.createElement('option')
  optionElement.value = option.value
  optionElement.selected = true
  selectElement.appendChild(optionElement)
  const event = new CustomEvent('change')
  const payload = { ...event, target: selectElement }
  emit('change', payload)
}

function handleFocus() {
  focused.value = true
}

function handleBlur() {
  focused.value = false
  setTimeout(() => {
    if (!focused.value) {
      isOpen.value = false
    }
  }, 200)
}

/**
 * Handles keypress events on the dropdown
 *
 * This function is responsible for handling navigation and selection
 * of options in the dropdown
 *
 * @param event - The keypress event
 * @returns void
 */
function handleKeypress(event: KeyboardEvent) {
  // use a switch case on event.key
  if (focusedOptionIndex.value === null) return
  switch (event.key) {
    case 'Enter':
      selectOption(props.options[focusedOptionIndex.value])
      return
    case 'Escape':
    case 'Tab':
      isOpen.value = false
      selectedOption.value?.focus()
      focusedOptionIndex.value = null
      return
  }
  switch (event.key) {
    case 'ArrowUp':
      focusedOptionIndex.value = getKeypressUp(focusedOptionIndex.value)
      optionRefs.value[focusedOptionIndex.value]?.focus()
      break
    case 'ArrowDown':
      focusedOptionIndex.value = getKeypressDown(focusedOptionIndex.value)
      optionRefs.value[focusedOptionIndex.value]?.focus()
      break
    case 'PageUp':
      focusedOptionIndex.value = getPageUp(focusedOptionIndex.value)
      optionRefs.value[focusedOptionIndex.value]?.focus()
      break
    case 'PageDown':
      focusedOptionIndex.value = getPageDown(focusedOptionIndex.value)
      optionRefs.value[focusedOptionIndex.value]?.focus()
      break
    case 'Home':
      focusedOptionIndex.value = 0
      optionRefs.value[focusedOptionIndex.value]?.focus()
      break
    case 'End':
      focusedOptionIndex.value = optionRefs.value.length - 1
      optionRefs.value[focusedOptionIndex.value]?.focus()
      break
  }
}

function getPageUp(index: number) {
  index -= 5
  index = Math.max(index, 0)
  return index
}

function getPageDown(index: number) {
  index += 5
  index = Math.min(index, optionRefs.value.length - 1)
  return index
}

function getKeypressUp(index: number) {
  index--
  index = Math.max(index, 0)
  return index
}

function getKeypressDown(index: number) {
  index++
  index = Math.min(index, optionRefs.value.length - 1)
  return index
}
</script>

<style scoped>
.select-parent {
  position: relative;
  display: flex;
  text-align: start;
  flex-direction: column;
  width: max-content;
}

.selected-option {
  padding: 0.5rem 2.5rem 0.5rem 0.75rem;
  background: var(--input-bg-color);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  border-radius: 0.5rem;
  flex-wrap: nowrap;
  width: 100%;
  position: relative;
  user-select: none;
}

.selected-option.focused {
  outline: 1px solid var(--active-color);
}

.selected-option:focus-visible {
  outline: 1px solid var(--active-color);
}

.select-arrow {
  position: absolute;
  right: 0;
  transition: transform 0.3s;
  animation: rotateClose 0.3s forwards;
}

.select-arrow.flipped {
  animation: rotateOpen 0.3s forwards;
}

@keyframes rotateOpen {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(180deg);
  }
}

@keyframes rotateClose {
  0% {
    transform: rotate(180deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.sizing-div {
  height: 0px;
  padding: 0 2.5rem 0 0.75rem;
  overflow: hidden;
}

.dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  width: max-content;
  overflow-y: auto;
  background-color: var(--alt-bg-color);
  list-style: none;
  outline: 1px solid var(--button-color);
  margin: 0;
  z-index: 2;
  border-radius: 0.5rem;
  user-select: none;
}

.dropdown button {
  cursor: pointer;
  padding: 0 2.5rem 0 0.75rem;
  outline: none;
  width: 100%;
}

.dropdown button:focus-visible,
.dropdown button.selected:focus-visible {
  background-color: var(--top-toolbar-color);
}

.dropdown button.selected {
  background-color: var(--top-toolbar-color-light);
}

.dropdown button:hover {
  background-color: var(--top-toolbar-color);
}

.option-value {
  display: flex;
  flex-direction: column;
}
</style>
