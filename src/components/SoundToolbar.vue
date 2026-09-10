<template>
  <div class="toolbar select-none">
    <div class="left-buttons">
      <div class="search-input-wrapper" ref="searchContainerRef">
        <inline-svg class="search-icon" :src="SearchIcon" />
        <input
          ref="searchInputRef"
          type="text"
          class="search-input"
          v-model="settingsStore.searchText"
          placeholder="Search sounds (Ctrl+F)..."
          @focus="handleFocus"
          @keydown.esc="clearSearch(true)"
          @keydown.enter="handleEnter"
        />
        <div class="input-actions">
          <button
            v-if="settingsStore.searchText.length > 0"
            class="clear-button"
            @mousedown.prevent="clearSearch(false)"
            @click="clearSearch(false)"
            title="Clear search (Esc)"
            tabindex="-1">
            <inline-svg class="w-3 h-3" :src="CloseIcon" />
          </button>
          <button
            class="help-button"
            :class="{ active: showTips }"
            @mousedown.prevent="toggleTips"
            title="Search syntax guide"
            tabindex="-1">
            ?
          </button>
        </div>

        <!-- Floating Search Tips Dropdown -->
        <transition name="tips-fade">
          <div v-if="showTips" class="search-tips-dropdown" @mousedown.prevent>
            <div class="tips-header">
              <span class="tips-title">Search Syntax</span>
              <span class="tips-subtitle">Click a filter to insert</span>
            </div>

            <div class="tips-list">
              <div class="tip-row" @click="insertFilter('#')">
                <div class="tip-badges">
                  <span class="tip-badge">#tag</span>
                  <span class="tip-badge sub">tag:</span>
                </div>
                <div class="tip-info">
                  <span class="tip-text">Filter strictly by tag</span>
                  <span class="tip-example">e.g. <code>#meme</code></span>
                </div>
              </div>

              <div class="tip-row" @click="insertFilter('@')">
                <div class="tip-badges">
                  <span class="tip-badge">@segment</span>
                  <span class="tip-badge sub">seg:</span>
                </div>
                <div class="tip-info">
                  <span class="tip-text">Filter by segment label</span>
                  <span class="tip-example">e.g. <code>@drop</code></span>
                </div>
              </div>

              <div class="tip-row" @click="insertFilter('-')">
                <div class="tip-badges">
                  <span class="tip-badge">-word</span>
                </div>
                <div class="tip-info">
                  <span class="tip-text">Exclude matching sounds</span>
                  <span class="tip-example">e.g. <code>horn -loud</code></span>
                </div>
              </div>

              <div class="tip-row" @click="insertFilter('quotes')">
                <div class="tip-badges">
                  <span class="tip-badge">"phrase"</span>
                </div>
                <div class="tip-info">
                  <span class="tip-text">Exact phrase matching</span>
                  <span class="tip-example">e.g. <code>"game over"</code></span>
                </div>
              </div>
            </div>

            <div class="tips-footer">
              <span class="shortcut-item"><kbd class="tip-kbd">↵</kbd> Play top match</span>
              <span class="shortcut-item"><kbd class="tip-kbd">Esc</kbd> Clear</span>
              <span class="shortcut-item"><kbd class="tip-kbd">Ctrl</kbd>+<kbd class="tip-kbd">F</kbd> Focus</span>
            </div>
          </div>
        </transition>
      </div>

      <transition name="fade">
        <div v-if="settingsStore.searchText.trim().length > 0" class="search-stats">
          {{ matchCountText }}
        </div>
      </transition>
    </div>
    <div class="right-buttons">
      <!-- Quick Clip Button & Popover -->
      <div class="quick-clip-wrapper" ref="clipMenuRef">
        <button
          v-if="pulseBackStore.isLiveRecording"
          class="live-rec-btn"
          @click="pulseBackStore.stopLiveCapture()"
          title="Click to stop live recording">
          <span class="live-dot"></span>
          <span>Stop ({{ pulseBackStore.liveRecordSeconds }}s)</span>
        </button>

        <button
          v-else
          :class="['quick-clip-btn', { active: showClipMenu, disabled: !pulseBackStore.isBufferRunning }]"
          :disabled="!pulseBackStore.isBufferRunning"
          @click="toggleClipMenu"
          :title="pulseBackStore.isBufferRunning ? 'Pulse Back (Quick Clip)' : 'Turn on Pulse Back buffer to clip'">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l3 3" />
          </svg>
          <span class="btn-text">Clip</span>
        </button>

        <!-- Dropdown Menu -->
        <transition name="tips-fade">
          <div v-if="showClipMenu && pulseBackStore.isBufferRunning" class="clip-menu-dropdown" @mousedown.stop>
            <div class="clip-menu-header">
              <span class="font-semibold text-white">Pulse Back</span>
              <span class="text-xs text-zinc-400">Capture replay</span>
            </div>

            <div class="clip-presets">
              <button
                v-for="s in [15, 30, 60]"
                :key="s"
                :class="['preset-btn', { selected: selectedPresetSeconds === s }]"
                @click="selectDuration(s)">
                -{{ s }}s
              </button>
            </div>

            <label class="continue-checkbox">
              <input type="checkbox" v-model="continueRecordingLive" />
              <span>Continue recording live</span>
            </label>

            <button class="execute-clip-btn" @click="executeQuickClip">
              {{ continueRecordingLive ? 'Start Live Punch-In' : `Capture Last ${selectedPresetSeconds}s` }}
            </button>

            <div class="clip-menu-footer">
              <span>Hotkey: <kbd class="tip-kbd">F12</kbd></span>
            </div>
          </div>
        </transition>
      </div>

      <!-- Pulse Back Buffer Toggle -->
      <toggle
        class="pulseBackToggle"
        :modelValue="pulseBackStore.isBufferEnabled"
        @update:modelValue="pulseBackStore.toggleBuffer">
        <span class="flex items-center gap-1.5">
          <span :class="['status-dot', { online: pulseBackStore.isBufferRunning }]"></span>
          Pulse Back
        </span>
      </toggle>

      <!-- Play / Edit Mode Toggle -->
      <toggle class="displayMode" v-model="editMode" @update:modelValue="handleDisplayModeChange">{{
        editMode ? 'Play Mode' : 'Edit Mode'
      }}</toggle>
    </div>
  </div>
</template>

<script setup lang="ts">
import InlineSvg from 'vue-inline-svg'
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import SearchIcon from '../assets/images/search.svg'
import CloseIcon from '../assets/images/close.svg'
import { useSettingsStore } from '../store/settings'
import { useSoundStore } from '../store/sound'
import { usePulseBackStore } from '../store/pulseBack'

const settingsStore = useSettingsStore()
const soundStore = useSoundStore()
const pulseBackStore = usePulseBackStore()
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchContainerRef = ref<HTMLDivElement | null>(null)

const showClipMenu = ref(false)
const clipMenuRef = ref<HTMLDivElement | null>(null)
const selectedPresetSeconds = ref(settingsStore.pulse_back_default_duration || 30)
const continueRecordingLive = ref(false)

const isFocused = ref(false)
const manualTipsOpen = ref(false)

const showTips = computed(() => {
  if (manualTipsOpen.value) return true
  return isFocused.value && settingsStore.searchText.trim().length === 0
})

/**
 * This computed translates the displayMode from the settings store to a boolean
 * for the toggle component
 * @returns boolean
 */
const editMode = computed<boolean>({
  get: () => settingsStore.displayMode === 'play',
  set: value => {
    settingsStore.displayMode = value ? 'play' : 'edit'
  },
})

const matchCount = computed(() => {
  if (!settingsStore.searchText.trim()) return 0
  return settingsStore.soundsFiltered().filter(s => s.title !== undefined).length
})

const matchCountText = computed(() => {
  const count = matchCount.value
  return count === 1 ? '1 match' : `${count} matches`
})

function handleFocus() {
  isFocused.value = true
}

function toggleTips() {
  manualTipsOpen.value = !manualTipsOpen.value
  if (manualTipsOpen.value) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
}

function toggleClipMenu() {
  if (!pulseBackStore.isBufferRunning) return
  showClipMenu.value = !showClipMenu.value
}

function selectDuration(s: number) {
  selectedPresetSeconds.value = s
  settingsStore.saveSetting('pulse_back_default_duration', s)
}

async function executeQuickClip() {
  showClipMenu.value = false
  settingsStore.saveSetting('pulse_back_default_duration', selectedPresetSeconds.value)
  await pulseBackStore.triggerQuickClip(selectedPresetSeconds.value, continueRecordingLive.value)
}

function insertFilter(prefix: string) {
  const current = settingsStore.searchText.trim()
  let cursorPos = 0

  if (prefix === 'quotes') {
    const newText = current ? `${current} ""` : '""'
    settingsStore.searchText = newText
    cursorPos = newText.length - 1
  } else {
    const newText = current ? `${current} ${prefix}` : prefix
    settingsStore.searchText = newText
    cursorPos = newText.length
  }

  nextTick(() => {
    if (searchInputRef.value) {
      searchInputRef.value.focus()
      searchInputRef.value.setSelectionRange(cursorPos, cursorPos)
    }
  })
}

function handleDisplayModeChange() {
  settingsStore.displayMode = editMode.value ? 'play' : 'edit'
}

function clearSearch(blur = false) {
  settingsStore.searchText = ''
  manualTipsOpen.value = false
  if (blur) {
    isFocused.value = false
    searchInputRef.value?.blur()
  } else {
    searchInputRef.value?.focus()
  }
}

function handleEnter() {
  const filtered = settingsStore.soundsFiltered()
  if (filtered.length === 0) return

  const topSound = filtered.find(s => s.title !== undefined)
  if (!topSound) return

  if (settingsStore.displayMode === 'play') {
    soundStore.playSound(topSound, null, null, undefined, true)
  } else {
    settingsStore.currentEditingSound = topSound
    settingsStore.soundEditorOpen = true
  }
}

function handleGlobalKeyDown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
  }
}

function handleClickOutside(event: MouseEvent) {
  if (searchContainerRef.value && !searchContainerRef.value.contains(event.target as Node)) {
    isFocused.value = false
    manualTipsOpen.value = false
  }
  if (clipMenuRef.value && !clipMenuRef.value.contains(event.target as Node)) {
    showClipMenu.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeyDown)
  document.addEventListener('pointerdown', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown)
  document.removeEventListener('pointerdown', handleClickOutside)
})
</script>

<style scoped>
.left-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.65rem;
  width: 1rem;
  height: 1rem;
  color: var(--text-placeholder-color, #888);
  pointer-events: none;
  z-index: 1;
}

.search-input {
  height: 2.25rem;
  width: 15.5rem;
  padding-left: 2.15rem;
  padding-right: 3.5rem;
  font-size: 0.875rem;
  border-radius: 0.5rem;
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-input:focus,
.search-input:not(:placeholder-shown) {
  width: 19.5rem;
}

.input-actions {
  position: absolute;
  right: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  z-index: 2;
}

.clear-button,
.help-button {
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(128, 128, 128, 0.25);
  color: var(--text-color);
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: 0.75rem;
  font-weight: 600;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.clear-button:hover,
.help-button:hover,
.help-button.active {
  background: var(--active-color);
  color: #fff;
  transform: scale(1.08);
}

/* Floating Search Tips Dropdown */
.search-tips-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 22.5rem;
  background: var(--input-bg-color);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0.6rem;
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.45), 0 10px 10px rgba(0, 0, 0, 0.25);
  padding: 0.75rem 0.85rem;
  z-index: 60;
  backdrop-filter: blur(12px);
}

.tips-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 0.5rem;
  margin-bottom: 0.4rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.tips-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent-text-color, var(--active-color));
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tips-subtitle {
  font-size: 0.7rem;
  color: var(--text-placeholder-color, #888);
}

.tips-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.tip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.5rem;
  border-radius: 0.35rem;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.tip-row:hover {
  background: rgba(255, 255, 255, 0.07);
}

.tip-badges {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.tip-badge {
  font-family: monospace;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  background: rgba(35, 164, 89, 0.16);
  color: var(--active-color);
  border: 1px solid rgba(35, 164, 89, 0.35);
  border-radius: 4px;
}

.tip-badge.sub {
  opacity: 0.75;
}

.tip-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 0.75rem;
  line-height: 1.2;
}

.tip-text {
  color: var(--text-color);
}

.tip-example {
  color: var(--text-placeholder-color, #888);
  font-size: 0.7rem;
}

.tip-example code {
  font-family: monospace;
  color: var(--accent-text-color, #fff);
}

.tips-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.6rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.7rem;
  color: var(--text-placeholder-color, #888);
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.tip-kbd {
  font-family: monospace;
  font-size: 0.65rem;
  padding: 0.1rem 0.3rem;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  color: var(--text-color);
}

/* Transitions */
.tips-fade-enter-active,
.tips-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tips-fade-enter-from,
.tips-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.search-stats {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-placeholder-color, #888);
  padding: 0.25rem 0.55rem;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 9999px;
  white-space: nowrap;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.toolbar {
  padding: 0.5rem 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--top-toolbar-color);
  flex-wrap: wrap;
  gap: 0.5rem;
  position: relative;
  z-index: 30;
}

.toggle-group.displayMode {
  width: 15.5ch;
}

.right-buttons {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.quick-clip-wrapper {
  position: relative;
}

.quick-clip-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.65rem;
  background: var(--input-bg-color, #27272a);
  border: 1px solid var(--border-color, #3f3f46);
  border-radius: 8px;
  color: #e4e4e7;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-clip-btn:hover:not(:disabled) {
  background: #3f3f46;
  border-color: #71717a;
  transform: translateY(-1px);
}

.quick-clip-btn.active {
  background: #3b82f6;
  border-color: #60a5fa;
  color: white;
}

.quick-clip-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.live-rec-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.75rem;
  background: #dc2626;
  border: 1px solid #ef4444;
  border-radius: 8px;
  color: white;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  animation: pulse-border 1.5s infinite;
}

.live-dot {
  width: 8px;
  height: 8px;
  background-color: white;
  border-radius: 50%;
  display: inline-block;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #71717a;
  transition: background-color 0.3s;
}

.status-dot.online {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}

.clip-menu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 220px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 10px;
  padding: 0.85rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  flex-col: column;
  flex-direction: column;
  gap: 0.75rem;
}

.clip-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 1px solid #27272a;
  padding-bottom: 0.4rem;
}

.clip-presets {
  display: flex;
  gap: 0.4rem;
}

.preset-btn {
  flex: 1;
  padding: 0.35rem 0.2rem;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  color: #d4d4d8;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-btn:hover {
  background: #3f3f46;
  color: white;
}

.preset-btn.selected {
  background: #2563eb;
  border-color: #3b82f6;
  color: white;
  font-weight: 600;
}

.continue-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: #a1a1aa;
  cursor: pointer;
  user-select: none;
}

.continue-checkbox input {
  cursor: pointer;
}

.execute-clip-btn {
  width: 100%;
  padding: 0.5rem;
  background: #10b981;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.execute-clip-btn:hover {
  background: #059669;
}

.clip-menu-footer {
  display: flex;
  justify-content: flex-end;
  font-size: 0.7rem;
  color: #71717a;
}

</style>
