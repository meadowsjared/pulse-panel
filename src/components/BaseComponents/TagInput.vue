<template>
  <div ref="containerRef" class="tag-input" @click="handleContainerClick">
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
      <button class="remove-button" @click.stop="removeTag(index)">
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
      @focus="handleFocus"
      @blur="handleBlur"
      v-bind="$attrs" />

    <!-- Tag Autocomplete Dropdown -->
    <transition name="autocomplete-fade">
      <div v-if="showSuggestions"
           ref="dropdownRef"
           class="tag-autocomplete-dropdown"
           @mousedown.prevent>
        <div class="autocomplete-list">
          <button v-for="(item, index) in filteredSuggestions"
                  :key="item.name"
                  type="button"
                  class="suggestion-item"
                  :class="{ 'is-selected': index === selectedIndex, 'is-top-match': selectedIndex === -1 && index === 0 }"
                  @mouseenter="selectedIndex = index"
                  @click="selectSuggestion(item.name)">
            <img v-if="settingsStore.getTagImageUrl(item.name)"
                 :src="settingsStore.getTagImageUrl(item.name)"
                 alt=""
                 class="suggestion-avatar" />
            <span v-else class="suggestion-hash">#</span>

            <span class="suggestion-label truncate">
              <template v-for="(part, pIdx) in getHighlightParts(item.name, newTag.trim())" :key="pIdx">
                <strong v-if="part.match" class="matched-text">{{ part.text }}</strong>
                <span v-else>{{ part.text }}</span>
              </template>
            </span>

            <span v-if="item.count > 0" class="suggestion-count" :title="`${item.count} sound${item.count === 1 ? '' : 's'}`">
              {{ item.count }}
            </span>

            <span v-if="index === selectedIndex || (selectedIndex === -1 && index === 0)" class="tab-badge">
              ↵ Enter
            </span>
          </button>
        </div>
        <div class="autocomplete-footer">
          <span><kbd>Tab</kbd> or <kbd>↵</kbd> select</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </transition>

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

const props = withDefaults(
  defineProps<{
    modelValue: string[] | undefined
    placeholder?: string | undefined
    id?: string
    suggestions?: string[] | { name: string; count?: number }[]
  }>(),
  {
    placeholder: undefined,
    id: undefined,
    suggestions: undefined,
  }
)

const emit = defineEmits<(event: 'update:modelValue', value: string[] | undefined) => void>()

const settingsStore = useSettingsStore()
const pulseBackStore = usePulseBackStore()

const containerRef = ref<HTMLDivElement | null>(null)
const textInputRef = ref<HTMLDivElement | null>(null)
const dropdownRef = ref<HTMLDivElement | null>(null)
defineExpose<TagInputRef>({ textInputRef })

const newTag = ref('')
const isFocused = ref(false)
const isDismissed = ref(false)
const selectedIndex = ref(-1)

const showTagMenu = ref(false)
const selectedTag = ref('')
const tagMenuPosition = ref({ x: 0, y: 0 })
const tagMenuRef = ref<HTMLElement | null>(null)

const canPasteImage = ref(false)
const selectedTagHasImage = computed(() => !!(selectedTag.value && settingsStore.getTagImageUrl(selectedTag.value)))

/**
 * Source list of tags available for autocomplete suggestions
 */
const candidateTags = computed<{ name: string; count: number }[]>(() => {
  if (props.suggestions && props.suggestions.length > 0) {
    return props.suggestions.map(s => {
      if (typeof s === 'string') return { name: s, count: 0 }
      return { name: s.name, count: s.count ?? 0 }
    })
  }
  return settingsStore.allKnownTags
})

/**
 * Filtered suggestions based on user input, excluding tags already selected
 */
const filteredSuggestions = computed(() => {
  const query = newTag.value.trim().toLowerCase()
  if (!query) return []
  const currentTags = (props.modelValue ?? []).map(t => t.trim().toLowerCase())

  const matches: { name: string; count: number; startsWith: boolean }[] = []

  for (const tag of candidateTags.value) {
    const lower = tag.name.toLowerCase()
    // Do not suggest tags already in modelValue
    if (currentTags.includes(lower)) continue

    if (lower.startsWith(query)) {
      matches.push({ ...tag, startsWith: true })
    } else if (lower.includes(query)) {
      matches.push({ ...tag, startsWith: false })
    }
  }

  matches.sort((a, b) => {
    if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1
    if (b.count !== a.count) return b.count - a.count
    return a.name.localeCompare(b.name)
  })

  // Keep suggestions compact and non-intrusive
  return matches.slice(0, 6)
})

const showSuggestions = computed(() => {
  return isFocused.value && !isDismissed.value && filteredSuggestions.value.length > 0
})

function getHighlightParts(name: string, query: string) {
  if (!query) return [{ text: name, match: false }]
  const idx = name.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return [{ text: name, match: false }]
  const before = name.slice(0, idx)
  const match = name.slice(idx, idx + query.length)
  const after = name.slice(idx + query.length)
  const parts: { text: string; match: boolean }[] = []
  if (before) parts.push({ text: before, match: false })
  parts.push({ text: match, match: true })
  if (after) parts.push({ text: after, match: false })
  return parts
}

function scrollToSelected() {
  requestAnimationFrame(() => {
    if (!dropdownRef.value || selectedIndex.value < 0) return
    const items = dropdownRef.value.querySelectorAll('.suggestion-item')
    const item = items[selectedIndex.value] as HTMLElement | undefined
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  })
}

function addTag(tagName: string) {
  const clean = tagName.trim()
  if (!clean) return
  const currentTags = [...(props.modelValue ?? [])]
  if (!currentTags.some(t => t.toLowerCase() === clean.toLowerCase())) {
    currentTags.push(clean)
    emit('update:modelValue', currentTags)
  }
  newTag.value = ''
  if (textInputRef.value) {
    textInputRef.value.textContent = ''
  }
  selectedIndex.value = -1
  isDismissed.value = false
}

function selectSuggestion(tagName: string) {
  addTag(tagName)
  textInputRef.value?.focus()
}

function handleInput() {
  if (!textInputRef.value) return
  newTag.value = (textInputRef.value.textContent ?? '').trim()
  isDismissed.value = false
  selectedIndex.value = -1
}

function handleFocus() {
  isFocused.value = true
  isDismissed.value = false
}

function handleBlur(event: FocusEvent) {
  const related = event.relatedTarget as Node | null
  if (containerRef.value && related && containerRef.value.contains(related)) {
    return
  }
  // Delay slightly so click handlers on suggestions can complete
  setTimeout(() => {
    isFocused.value = false
  }, 120)
}

function handleContainerClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.tag') && !target.closest('.tag-context-menu') && !target.closest('.tag-autocomplete-dropdown')) {
    textInputRef.value?.focus()
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    if (showSuggestions.value && filteredSuggestions.value.length > 0) {
      event.preventDefault()
      if (selectedIndex.value < filteredSuggestions.value.length - 1) {
        selectedIndex.value++
      } else {
        selectedIndex.value = 0
      }
      scrollToSelected()
    }
  } else if (event.key === 'ArrowUp') {
    if (showSuggestions.value && filteredSuggestions.value.length > 0) {
      event.preventDefault()
      if (selectedIndex.value > 0) {
        selectedIndex.value--
      } else {
        selectedIndex.value = filteredSuggestions.value.length - 1
      }
      scrollToSelected()
    }
  } else if (event.key === 'Tab') {
    if (showSuggestions.value && filteredSuggestions.value.length > 0) {
      event.preventDefault()
      const target = selectedIndex.value >= 0
        ? filteredSuggestions.value[selectedIndex.value]
        : filteredSuggestions.value[0]
      if (target) {
        selectSuggestion(target.name)
      }
    } else if (newTag.value.trim() !== '') {
      event.preventDefault()
      addTag(newTag.value)
    }
    // If empty text and no suggestions, allow normal Tab order navigation
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (showSuggestions.value && filteredSuggestions.value.length > 0) {
      const target = selectedIndex.value >= 0
        ? filteredSuggestions.value[selectedIndex.value]
        : filteredSuggestions.value[0]
      if (target) {
        selectSuggestion(target.name)
      }
    } else if (newTag.value.trim() !== '') {
      addTag(newTag.value)
    }
  } else if (event.key === ',' || event.key === ' ') {
    event.preventDefault()
    if (newTag.value.trim() !== '') {
      addTag(newTag.value)
    }
  } else if (event.key === 'Escape') {
    if (showSuggestions.value) {
      event.preventDefault()
      event.stopPropagation()
      isDismissed.value = true
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

function handlePaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain')
  if (!text) return
  const newTags = text
    .split(/[,\s]+/)
    .map(tag => tag.trim())
    .filter(tag => tag !== '')
  const newTagValue = [...(props.modelValue ?? [])]
  for (const tag of newTags) {
    if (!newTagValue.some(t => t.toLowerCase() === tag.toLowerCase())) {
      newTagValue.push(tag)
    }
  }
  emit('update:modelValue', newTagValue)
  newTag.value = ''
  if (textInputRef.value) {
    textInputRef.value.textContent = ''
  }
  selectedIndex.value = -1
  isDismissed.value = false
}

async function openTagMenu(event: MouseEvent, tag: string) {
  selectedTag.value = tag
  canPasteImage.value = await settingsStore.hasClipboardImage()
  const hasImg = !!settingsStore.getTagImageUrl(tag)
  const canPaste = canPasteImage.value
  if (!hasImg && !canPaste) {
    pulseBackStore.showToast('Copy an image first to paste onto a tag')
    return
  }

  const menuWidth = 180
  const menuHeight = hasImg ? 110 : 60
  let x = event.clientX
  let y = event.clientY

  if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8
  if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8

  tagMenuPosition.value = { x: Math.max(8, x), y: Math.max(8, y) }
  showTagMenu.value = true
}

function handleDocumentClick(event: MouseEvent) {
  if (showTagMenu.value && tagMenuRef.value && !tagMenuRef.value.contains(event.target as Node)) {
    showTagMenu.value = false
  }
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isFocused.value = false
  }
}

function handleMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showTagMenu.value) {
    showTagMenu.value = false
  }
}

async function handlePasteImageToTag() {
  showTagMenu.value = false
  if (!selectedTag.value) return
  const copied = await settingsStore.readClipboardImage()
  if (!copied || !copied.imageKey) return
  await settingsStore.setTagImage(selectedTag.value, copied.imageKey, copied.imageUrl)
  pulseBackStore.showToast(`Set image for tag #${selectedTag.value}`)
}

async function handleCopyTagImage() {
  showTagMenu.value = false
  if (!selectedTag.value) return
  const key = settingsStore.getTagImageKey(selectedTag.value)
  const url = settingsStore.getTagImageUrl(selectedTag.value)
  if (!key) return
  await settingsStore.copySoundImage(key, url)
  pulseBackStore.showToast(`Copied image from #${selectedTag.value}`)
}

async function handleRemoveTagImage() {
  showTagMenu.value = false
  if (!selectedTag.value) return
  await settingsStore.removeTagImage(selectedTag.value)
  pulseBackStore.showToast(`Cleared image for tag #${selectedTag.value}`)
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('contextmenu', handleDocumentClick)
  document.addEventListener('keydown', handleMenuKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('contextmenu', handleDocumentClick)
  document.removeEventListener('keydown', handleMenuKeydown)
})
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

.tag-autocomplete-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 230px;
  max-width: 100%;
  background-color: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.95), 0 4px 12px rgba(0, 0, 0, 0.7);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

.autocomplete-list {
  display: flex;
  flex-direction: column;
  padding: 4px;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: #d4d4d8;
  font-size: 0.825rem;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.1s ease, color 0.1s ease;
}

.suggestion-item:hover,
.suggestion-item.is-selected {
  background-color: #27272a;
  color: #ffffff;
}

.suggestion-item.is-top-match:not(.is-selected) {
  background-color: rgba(39, 39, 42, 0.5);
  color: #ffffff;
}

.suggestion-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.suggestion-hash {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #71717a;
  font-weight: 700;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.suggestion-label {
  flex-grow: 1;
}

.matched-text {
  color: #34d399;
  font-weight: 700;
}

.suggestion-count {
  font-size: 0.68rem;
  padding: 1px 6px;
  background: #27272a;
  border-radius: 10px;
  color: #a1a1aa;
  margin-left: 4px;
  flex-shrink: 0;
}

.tab-badge {
  font-size: 0.65rem;
  padding: 1px 5px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #6ee7b7;
  border-radius: 4px;
  margin-left: 4px;
  flex-shrink: 0;
  font-family: monospace;
}

.autocomplete-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: #141416;
  border-top: 1px solid #27272a;
  font-size: 0.68rem;
  color: #71717a;
}

.autocomplete-footer kbd {
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 3px;
  padding: 0.5px 3.5px;
  font-size: 0.65rem;
  color: #a1a1aa;
  font-family: monospace;
}

.autocomplete-fade-enter-active,
.autocomplete-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.autocomplete-fade-enter-from,
.autocomplete-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
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
  background: transparent;
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
