<template>
  <div class="custom-select">
    <div class="select-parent">
      <div
        class="selected-option"
        tabindex="0"
        @click="toggleDropdown"
        @keydown.space="toggleDropdown"
        @keydown.enter="toggleDropdown"
        @blur="handleBlur"
        @focus="handleFocus">
        {{ displayValue ?? props.defaultText }}
        <inline-svg :src="SelectArrow" class="select-arrow" :class="{ flipped: isOpen }" />
      </div>
      <div class="sizing-div">
        <div v-for="option in options" :key="option.value">{{ option.label }}</div>
      </div>
      <ul v-if="isOpen" class="dropdown">
        <li
          v-for="option in options"
          :key="option.value"
          :class="{ selected: option.value === props.modelValue }"
          @click="selectOption(option)"
          @keydown.up="handleKeypressUp"
          @keydown.down="handleKeypressDown"
          @keydown.enter="selectOption(option)"
          @keydown.tab.prevent="toggleDropdown"
          @keydown.esc="isOpen = false"
          @focus="handleFocus"
          @blur="handleBlur"
          ref="optionRefs"
          tabindex="0">
          {{ option.label }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import InlineSvg from 'vue-inline-svg'
import SelectArrow from '../assets/images/select-arrow.svg'

interface LabelValue {
  label: string
  value: string
}

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
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

const displayValue = computed(() => {
  return props.options.find(option => option.value === props.modelValue)?.label ?? null
})

const isOpen = ref(false)
const selectedOption = ref<string | null>(props.modelValue)
const focusedOptionIndex = ref<null | number>(null)
const optionRefs = ref<HTMLElement[]>([])
const focused = ref(false)

function toggleDropdown() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    focusedOptionIndex.value = props.options.findIndex(option => option.value === props.modelValue)
    setTimeout(() => {
      if (focusedOptionIndex.value === null) return
      optionRefs.value[focusedOptionIndex.value]?.focus()
    }, 0)
  } else {
    const selectedElement: HTMLDivElement | null = document.querySelector<HTMLDivElement>('.selected-option')
    if (selectedElement) {
      selectedElement.focus()
      focusedOptionIndex.value = null
    }
  }
}

/**
 * Selects an option and emits the selected value
 * @param option - The selected option
 */
function selectOption(option: LabelValue) {
  // selParentRef.value?.focus()
  if (option.value !== props.modelValue) {
    selectedOption.value = option.value
    emit('update:modelValue', option.value)
    emitHTMLSelectChange(option)
  }
  isOpen.value = false
  setTimeout(() => {
    const selectedElement: HTMLDivElement | null = document.querySelector<HTMLDivElement>('.selected-option')
    selectedElement?.focus()
  }, 0)
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

function handleKeypressUp() {
  if (focusedOptionIndex.value === null) return
  if (focusedOptionIndex.value === 0) return
  focusedOptionIndex.value--
  optionRefs.value[focusedOptionIndex.value]?.focus()
}

function handleKeypressDown() {
  if (focusedOptionIndex.value === null) return
  if (focusedOptionIndex.value === optionRefs.value.length - 1) return
  focusedOptionIndex.value++
  optionRefs.value[focusedOptionIndex.value]?.focus()
}
</script>

<style scoped>
.custom-select {
  position: relative;
  display: flex;
  text-align: start;
  width: max-content;
}

.selected-option {
  padding: 0.5rem 2.5rem 0.5rem 0.75rem;
  background: var(--button-color);
  cursor: pointer;
  display: flex;
  border-radius: 0.5rem;
  width: inherit;
  position: relative;
  user-select: none;
}
.select-arrow {
  position: absolute;
  right: 0;
  transition: transform 0.3s;
}

.select-arrow.flipped {
  animation: rotateOpen 0.3s forwards;
}

.select-arrow {
  animation: rotateClose 0.3s forwards;
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
  background-color: var(--background-color);
  list-style: none;
  outline: 1px solid var(--button-color);
  margin: 0;
  z-index: 2;
  border-radius: 0.5rem;
  user-select: none;
}

.dropdown li {
  cursor: pointer;
  padding: 0 2.5rem 0 0.75rem;
  outline: none;
}

.dropdown li:focus-visible,
.dropdown li.selected:focus-visible {
  background-color: var(--button-color);
}

.dropdown li.selected {
  background-color: var(--alt-bg-color);
}

.dropdown li:hover {
  background-color: var(--button-color);
}
</style>
