<template>
  <div class="tag-input">
    <div v-if="(!modelValue || modelValue.length === 0) && newTag.trim() === ''" class="placeholder-text">
      {{ placeholder }}
    </div>
    <div v-for="(tag, index) in modelValue"
         :key="index"
         class="tag"
         @contextmenu.prevent.stop="openTagMenu($event, tag)">
      <img v-if="settingsStore.getTagImageUrl(tag)"
           :src="settingsStore.getTagImageUrl(tag)"
           alt=""
           class="tag-image-avatar" />
      <span>{{ tag }}</span>
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

    <!-- Tag Context Menu -->
    <teleport to="body">
      <transition name="tag-menu-fade">
        <div v-if="showTagMenu && selectedTag"
             ref="tagMenuRef"
             class="tag-context-menu"
             :style="{ top: `${tagMenuPosition.y}px`, left: `${tagMenuPosition.x}px` }">
          <div class="tag-menu-header">
            <span class="truncate">#{{ selectedTag }}</span>
          </div>
          <button v-if="canPasteImage"
                  @click="handlePasteImageToTag"
                  type="button"
                  class="tag-menu-item text-emerald-400 hover:text-emerald-300">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            <span>Paste Image to Tag</span>
          </button>
          <button v-if="selectedTagHasImage"
                  @click="handleCopyTagImage"
                  type="button"
                  class="tag-menu-item">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy Tag Image</span>
          </button>
          <button v-if="selectedTagHasImage"
                  @click="handleRemoveTagImage"
                  type="button"
                  class="tag-menu-item text-red-400 hover:text-red-300">
            <inline-svg :src="PlusIcon" class="w-3.5 h-3.5 rotate-45 text-red-400" />
            <span>Clear Tag Image</span>
          </button>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import InlineSvg from 'vue-inline-svg'
import PlusIcon from '../../assets/images/plus.svg'
import { TagInputRef } from './TagInputTypes'
import { useSettingsStore } from '../../store/settings'
import { usePulseBackStore } from '../../store/pulseBack'

const props = defineProps<{
  modelValue: string[] | undefined
  placeholder?: string | undefined
  id?: string
}>()

const emit = defineEmits<(event: 'update:modelValue', value: string[] | undefined) => void>()

const settingsStore = useSettingsStore()
const pulseBackStore = usePulseBackStore()

const textInputRef = ref<HTMLDivElement | null>(null)
defineExpose<TagInputRef>({ textInputRef })
const newTag = ref('')

const showTagMenu = ref(false)
const selectedTag = ref('')
const tagMenuPosition = ref({ x: 0, y: 0 })
const tagMenuRef = ref<HTMLElement | null>(null)

const canPasteImage = computed(() => !!settingsStore.copiedSoundImage)
const selectedTagHasImage = computed(() => !!(selectedTag.value && settingsStore.getTagImageUrl(selectedTag.value)))

function openTagMenu(event: MouseEvent, tag: string) {
  selectedTag.value = tag
  const hasImg = !!settingsStore.getTagImageUrl(tag)
  const canPaste = canPasteImage.value
  if (!hasImg && !canPaste) return

  const menuWidth = 180
  const menuHeight = hasImg ? 110 : 60
  let x = event.clientX
  let y = event.clientY

  if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8
  if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8

  tagMenuPosition.value = { x: Math.max(8, x), y: Math.max(8, y) }
  showTagMenu.value = true
}

function handleMenuClickOutside(event: MouseEvent) {
  if (showTagMenu.value && tagMenuRef.value && !tagMenuRef.value.contains(event.target as Node)) {
    showTagMenu.value = false
  }
}

function handleMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showTagMenu.value) {
    showTagMenu.value = false
  }
}

async function handlePasteImageToTag() {
  showTagMenu.value = false
  const copied = settingsStore.copiedSoundImage
  if (!copied || !copied.imageKey || !selectedTag.value) return
  await settingsStore.setTagImage(selectedTag.value, copied.imageKey, copied.imageUrl)
  pulseBackStore.showToast(`Set image for tag #${selectedTag.value}`)
}

async function handleCopyTagImage() {
  showTagMenu.value = false
  if (!selectedTag.value) return
  const key = settingsStore.getTagImageKey(selectedTag.value)
  const url = settingsStore.getTagImageUrl(selectedTag.value)
  if (!key) return
  settingsStore.copySoundImage(key, url)
  pulseBackStore.showToast(`Copied image from #${selectedTag.value}`)
}

async function handleRemoveTagImage() {
  showTagMenu.value = false
  if (!selectedTag.value) return
  await settingsStore.removeTagImage(selectedTag.value)
  pulseBackStore.showToast(`Cleared image for tag #${selectedTag.value}`)
}

onMounted(() => {
  document.addEventListener('click', handleMenuClickOutside)
  document.addEventListener('contextmenu', handleMenuClickOutside)
  document.addEventListener('keydown', handleMenuKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleMenuClickOutside)
  document.removeEventListener('contextmenu', handleMenuClickOutside)
  document.removeEventListener('keydown', handleMenuKeydown)
})

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
  padding: 0 0 0 8px;
  margin: 4px 0 4px 4px;
  background-color: var(--button-accent-color);
  border-radius: 500rem;
  color: var(--input-bg-color);
  cursor: pointer;
}

.tag-image-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 5px;
  margin-left: -2px;
}

.tag-context-menu {
  position: fixed;
  background-color: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  padding: 0.35rem;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.95), 0 4px 12px rgba(0, 0, 0, 0.7);
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 160px;
  user-select: none;
}

.tag-menu-header {
  padding: 0.25rem 0.5rem 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #a1a1aa;
  border-bottom: 1px solid #27272a;
  margin-bottom: 0.2rem;
}

.tag-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.4rem 0.6rem;
  background: transparent;
  border: none;
  border-radius: 5px;
  color: #f4f4f5;
  font-size: 0.8rem;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.tag-menu-item:hover {
  background-color: #27272a;
  color: #ffffff;
}

.tag-menu-item:active {
  background-color: #23a459;
  color: #ffffff;
}

.tag-menu-fade-enter-active,
.tag-menu-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.tag-menu-fade-enter-from,
.tag-menu-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
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
