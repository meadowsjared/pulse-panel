<template>
  <div class="tag-input">
    <div v-if="(!modelValue || modelValue.length === 0) && newTag.trim() === ''" class="placeholder-text">
      {{ placeholder }}
    </div>
    <div v-for="(tag, index) in modelValue" :key="index" class="tag">
      {{ tag }}
      <button class="remove-button" @click="removeTag(index)">
        <inline-svg :src="PlusIcon" class="rotate-45" />
      </button>
    </div>
    <div
      ref="textInputRef"
      class="text-input"
      contenteditable="plaintext-only"
      @input="handleInput"
      @paste="handlePaste"
      @keydown="handleKeyDown"
      v-bind="$attrs" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import InlineSvg from 'vue-inline-svg'
import PlusIcon from '../../assets/images/plus.svg'
import { TagInputRef } from './TagInputTypes'

const props = defineProps<{
  modelValue: string[] | undefined
  placeholder?: string | undefined
  id?: string
}>()

const emit = defineEmits<(event: 'update:modelValue', value: string[] | undefined) => void>()

const textInputRef = ref<HTMLDivElement | null>(null)
defineExpose<TagInputRef>({ textInputRef })
const newTag = ref('')

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === ',' || event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    if (newTag.value.trim() !== '') {
      const newTagValue = [...(props.modelValue ?? [])]
      newTagValue.push(newTag.value.trim())
      emit('update:modelValue', newTagValue)
      newTag.value = ''
      textInputRef.value?.replaceChildren()
    }
  } else if (event.key === 'Backspace' && newTag.value.trim() === '') {
    emit('update:modelValue', (props.modelValue ?? []).slice(0, -1))
  }
}

function removeTag(index: number) {
  const newTagValue = [...(props.modelValue ?? [])]
  if (newTagValue.length > 0) {
    newTagValue.splice(index, 1)
    emit('update:modelValue', newTagValue)
  } else {
    emit('update:modelValue', undefined)
  }
}

function handleInput() {
  if (!textInputRef.value) return
  newTag.value = textInputRef.value.innerHTML.trim()
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain')
  if (!text) return
  // convert the text to an array of tags
  const newTags = text
    .split(/[,\s]+/)
    .map(tag => tag.trim())
    .filter(tag => tag !== '')
  const newTagValue = [...(props.modelValue ?? [])]
  emit('update:modelValue', newTagValue.concat(newTags))
  newTag.value = ''
  textInputRef.value?.replaceChildren()
}
</script>

<style scoped>
.tag-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 4px;
  width: 100%;
  position: relative;
}
.tag-input:focus-within {
  outline: 1px solid var(--button-color);
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 0 0 0 10px;
  margin: 4px 0 4px 4px;
  background-color: var(--button-accent-color);
  border-radius: 500rem;
  color: var(--input-bg-color);
}

.remove-button {
  padding: 0.5rem;
  background-color: transparent;
  border: none;
  cursor: pointer;
}

.text-input {
  border: none;
  outline: none;
  background: tr;
  padding: 4px;
  margin: 4px 4px 4px 0;
  min-width: 25%;
  max-width: 100%;
  width: auto;
  flex-grow: 1;
  text-align: left;
  display: block;
}
/* note: we represent focus using the parent element */
.text-input:focus {
  box-shadow: none;
}

.placeholder-text {
  display: flex;
  align-items: center;
  white-space: nowrap;
  padding: 8px;
  color: var(--text-placeholder-color);
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
</style>
