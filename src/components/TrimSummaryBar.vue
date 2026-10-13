<template>
  <div class="trim-summary-wrapper">
    <div class="trim-summary-bar">
      <!-- Left: Trim Duration Stats -->
      <div class="trim-stats">
        <button
          type="button"
          class="stat-pill clickable"
          title="Click to reset selection to full clip"
          @click.stop="onResetSelection"
          @keydown.enter.prevent="onResetSelection"
          @keydown.space.prevent="onResetSelection">
          <span class="stat-label">Selected:</span>
          <span class="stat-value">{{ formatSeconds(selectedDuration) }}</span>
        </button>
        <button
          type="button"
          class="stat-pill clickable"
          title="Click to reset start to clip start (0:00.0)"
          @click.stop="onResetStart"
          @keydown.enter.prevent="onResetStart"
          @keydown.space.prevent="onResetStart">
          <span class="stat-label">Start:</span>
          <span class="stat-value">{{ formatSeconds(trimStart) }}</span>
        </button>
        <button
          type="button"
          class="stat-pill clickable"
          title="Click to reset end to clip end"
          @click.stop="onResetEnd"
          @keydown.enter.prevent="onResetEnd"
          @keydown.space.prevent="onResetEnd">
          <span class="stat-label">End:</span>
          <span class="stat-value">{{ formatSeconds(trimEnd) }}</span>
        </button>
      </div>

      <!-- Center: Audio Gain & Auto-Level Controls -->
      <div v-if="showGainControls" class="audio-gain-controls">
        <!-- Gain Multiplier Input -->
        <div class="gain-input-wrapper" :title="`Volume multiplier for ${activeTargetLabel}`">
          <span class="gain-label">Gain:</span>
          <div class="gain-box">
            <input
              ref="gainInputRef"
              type="number"
              class="gain-input"
              step="0.1"
              min="0"
              :value="displayMultiplier"
              @change="onGainCommit"
              @blur="onGainCommit"
              @keydown.enter.prevent="onGainCommit" />
            <span class="gain-suffix">x</span>
          </div>
          <button
            v-if="isGainModified"
            type="button"
            class="gain-reset-icon-btn"
            title="Reset to 1.0x"
            @click="resetGain">
            ↺
          </button>
        </div>

        <!-- Auto Level Button -->
        <button
          type="button"
          class="auto-level-btn"
          :title="`Auto-level ${activeTargetLabel} to peak -0.5 dB`"
          @click="onAutoLevelClick">
          <svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span>Auto</span>
        </button>
      </div>

      <!-- Right: Quick Actions -->
      <div class="trim-quick-actions">
        <button
          v-if="showTrimToSelection && canTrimToSelection"
          type="button"
          class="secondary-btn"
          title="Discard audio outside In and Out points to refine selection"
          @click="$emit('trimToSelection')">
          <span>Trim to</span>
          <span>Selection</span>
        </button>
        <button type="button" class="secondary-btn" @click="$emit('reset')" title="Reset selection to full duration">
          <span>Reset</span>
          <span>Trim</span>
        </button>
        <button
          type="button"
          class="secondary-btn"
          :class="{ 'is-playing': isPlaying }"
          @click="$emit('playTrimmed')"
          title="Audition current trim selection">
          <span>{{ isPlaying ? 'Stop' : 'Play' }}</span>
          <span>Trimmed</span>
        </button>
      </div>
    </div>

    <!-- Active Gain Ranges Strip -->
    <div v-if="sortedGainRegions.length > 0" class="gain-ranges-strip" @contextmenu.prevent.stop="toggleMenu">
      <div class="gain-ranges-header-wrapper" ref="menuWrapperRef">
        <button
          type="button"
          ref="menuBtnRef"
          class="gain-ranges-menu-btn"
          title="Manage gain ranges (Click or right-click to open options)"
          aria-haspopup="true"
          :aria-expanded="isMenuOpen"
          @click.stop="toggleMenu"
          @contextmenu.prevent.stop="toggleMenu">
          <svg class="w-3.5 h-3.5 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          <span class="gain-ranges-title">Gain Ranges</span>
          <svg
            class="w-3 h-3 text-zinc-400 chevron-icon"
            :class="{ 'rotate-180': isMenuOpen }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <!-- Dropdown / Context Menu -->
        <transition name="menu-fade">
          <div v-if="isMenuOpen" ref="menuDropdownRef" class="gain-ranges-dropdown-menu" @click.stop>
            <button type="button" class="dropdown-menu-item danger-item" @click="onClearAllRanges">
              <svg
                class="w-3.5 h-3.5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Clear All Gain Ranges</span>
            </button>
            <button type="button" class="dropdown-menu-item" @click="onResetAllRangesTo1">
              <svg
                class="w-3.5 h-3.5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
              <span>Reset All Ranges to 1.0x</span>
            </button>
          </div>
        </transition>
      </div>

      <div class="gain-ranges-chips">
        <button
          v-for="region in sortedGainRegions"
          :key="getRegionKey(region)"
          type="button"
          class="gain-range-chip"
          :class="{
            'is-active': isRegionActive(region),
            'is-mic': region.channel === 0,
            'is-input': region.channel === 1,
            'is-both': region.channel === undefined,
          }"
          :title="`Click to rehighlight ${formatRegionLabel(region)} and adjust gain`"
          @click="onSelectRegion(region)">
          <span v-if="hasDualTracks" class="chip-track-badge">
            {{ region.channel === 0 ? '🎤 Mic' : region.channel === 1 ? '🔊 Input' : 'Both' }}
          </span>
          <span class="chip-range"> {{ formatSeconds(region.startSec) }} - {{ formatSeconds(region.endSec) }} </span>
          <span class="chip-multiplier"> {{ formatMultiplier(region.multiplier) }}x </span>
          <span
            class="chip-delete-btn"
            title="Delete this gain range"
            role="button"
            aria-label="Delete gain range"
            @click.stop="onDeleteRegion(region)">
            &times;
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { AudioGainRegion } from '../utils/audioGain'

interface Props {
  trimStart: number
  trimEnd: number
  duration?: number
  isPlaying?: boolean
  showTrimToSelection?: boolean
  canTrimToSelection?: boolean
  hasDualTracks?: boolean
  gain?: number
  micGain?: number
  inputGain?: number
  showGainControls?: boolean
  hasPartialGains?: boolean
  gainRegions?: AudioGainRegion[]
  activeTrackTarget?: 'both' | 'mic' | 'input'
}

const props = withDefaults(defineProps<Props>(), {
  duration: 0,
  isPlaying: false,
  showTrimToSelection: false,
  canTrimToSelection: false,
  hasDualTracks: false,
  gain: 1.0,
  micGain: 1.0,
  inputGain: 1.0,
  showGainControls: true,
  hasPartialGains: false,
  gainRegions: () => [],
  activeTrackTarget: 'both',
})

const emit = defineEmits<{
  (e: 'reset'): void
  (e: 'playTrimmed'): void
  (e: 'trimToSelection'): void
  (e: 'update:trimStart', val: number): void
  (e: 'update:trimEnd', val: number): void
  (e: 'update:activeTrackTarget', val: 'both' | 'mic' | 'input'): void
  (e: 'resetStart'): void
  (e: 'resetEnd'): void
  (e: 'resetSelection'): void
  (e: 'update:gain', val: number): void
  (e: 'update:micGain', val: number): void
  (e: 'update:inputGain', val: number): void
  (e: 'changeGain', payload: { target: 'both' | 'mic' | 'input'; multiplier: number }): void
  (e: 'autoLevel', target: 'both' | 'mic' | 'input'): void
  (e: 'resetGain', target: 'both' | 'mic' | 'input'): void
  (e: 'selectRegion', region: AudioGainRegion): void
  (e: 'deleteRegion', region: AudioGainRegion): void
  (e: 'clearAllGainRegions'): void
  (e: 'resetAllGainRegions'): void
}>()

const activeTrackTarget = computed({
  get: () => {
    if (!props.hasDualTracks) return 'both'
    return props.activeTrackTarget ?? 'both'
  },
  set: (val: 'both' | 'mic' | 'input') => {
    emit('update:activeTrackTarget', val)
  },
})

const selectedDuration = computed(() => {
  return Math.max(0, props.trimEnd - props.trimStart)
})

const activeTargetLabel = computed(() => {
  if (!props.hasDualTracks) return 'audio clip'
  if (activeTrackTarget.value === 'mic') return 'Microphone track'
  if (activeTrackTarget.value === 'input') return 'Input Device track'
  return 'all audio tracks'
})

const currentEffectiveMultiplier = computed(() => {
  if (!props.hasDualTracks) {
    return props.gain ?? 1.0
  }
  if (activeTrackTarget.value === 'mic') {
    return props.micGain ?? 1.0
  }
  if (activeTrackTarget.value === 'input') {
    return props.inputGain ?? 1.0
  }
  // 'both' target: if both identical show value, otherwise micGain
  return props.micGain ?? 1.0
})

const displayMultiplier = computed(() => {
  const val = currentEffectiveMultiplier.value
  return Number.isInteger(val) ? val.toFixed(1) : String(Math.round(val * 100) / 100)
})

const isGainModified = computed(() => {
  if (props.hasPartialGains) {
    return true
  }
  if (!props.hasDualTracks) {
    return Math.abs((props.gain ?? 1.0) - 1.0) >= 0.01
  }
  if (activeTrackTarget.value === 'mic') {
    return Math.abs((props.micGain ?? 1.0) - 1.0) >= 0.01
  }
  if (activeTrackTarget.value === 'input') {
    return Math.abs((props.inputGain ?? 1.0) - 1.0) >= 0.01
  }
  return Math.abs((props.micGain ?? 1.0) - 1.0) >= 0.01 || Math.abs((props.inputGain ?? 1.0) - 1.0) >= 0.01
})

function onGainCommit(e: Event) {
  if (!(e.target instanceof HTMLInputElement)) return
  const el = e.target
  let parsed = parseFloat(el.value)
  if (isNaN(parsed) || parsed < 0) {
    parsed = 1.0
  }
  // Allow any non-negative number (minimum 0x, no upper ceiling)
  parsed = Math.round(Math.max(0, parsed) * 100) / 100
  el.value = Number.isInteger(parsed) ? parsed.toFixed(1) : String(parsed)

  if (!props.hasDualTracks) {
    emit('update:gain', parsed)
    emit('changeGain', { target: 'both', multiplier: parsed })
  } else if (activeTrackTarget.value === 'mic') {
    emit('update:micGain', parsed)
    emit('changeGain', { target: 'mic', multiplier: parsed })
  } else if (activeTrackTarget.value === 'input') {
    emit('update:inputGain', parsed)
    emit('changeGain', { target: 'input', multiplier: parsed })
  } else {
    emit('update:micGain', parsed)
    emit('update:inputGain', parsed)
    emit('changeGain', { target: 'both', multiplier: parsed })
  }
}

function resetGain() {
  if (!props.hasDualTracks) {
    emit('update:gain', 1.0)
    emit('resetGain', 'both')
  } else if (activeTrackTarget.value === 'mic') {
    emit('update:micGain', 1.0)
    emit('resetGain', 'mic')
  } else if (activeTrackTarget.value === 'input') {
    emit('update:inputGain', 1.0)
    emit('resetGain', 'input')
  } else {
    emit('update:micGain', 1.0)
    emit('update:inputGain', 1.0)
    emit('resetGain', 'both')
  }
}

function onAutoLevelClick() {
  const target = props.hasDualTracks ? activeTrackTarget.value : 'both'
  emit('autoLevel', target)
}

function formatSeconds(secs: number): string {
  if (Number.isNaN(secs) || secs < 0) secs = 0
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  const ms = Math.floor((secs % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

const sortedGainRegions = computed(() => {
  if (!props.gainRegions || props.gainRegions.length === 0) return []
  return [...props.gainRegions].sort((a, b) => {
    if (Math.abs(a.startSec - b.startSec) > 0.001) {
      return a.startSec - b.startSec
    }
    if (Math.abs(a.endSec - b.endSec) > 0.001) {
      return a.endSec - b.endSec
    }
    return (a.channel ?? -1) - (b.channel ?? -1)
  })
})

function getRegionKey(region: AudioGainRegion): string {
  return region.id || `${region.channel ?? 'all'}-${region.startSec.toFixed(2)}-${region.endSec.toFixed(2)}`
}

function formatMultiplier(val: number): string {
  return Number.isInteger(val) ? val.toFixed(1) : String(Math.round(val * 100) / 100)
}

function formatRegionLabel(region: AudioGainRegion): string {
  const track = props.hasDualTracks ? (region.channel === 0 ? 'Mic' : region.channel === 1 ? 'Input' : 'Both') : ''
  const trackPrefix = track ? `[${track}] ` : ''
  return `${trackPrefix}${formatSeconds(region.startSec)} - ${formatSeconds(region.endSec)}`
}

function isRegionActive(region: AudioGainRegion): boolean {
  const startMatch = Math.abs(props.trimStart - region.startSec) < 0.08
  const endMatch = Math.abs(props.trimEnd - region.endSec) < 0.08
  if (!startMatch || !endMatch) return false
  if (!props.hasDualTracks) return true
  if (region.channel === 0) return activeTrackTarget.value === 'mic'
  if (region.channel === 1) return activeTrackTarget.value === 'input'
  return activeTrackTarget.value === 'both'
}

function onSelectRegion(region: AudioGainRegion) {
  if (props.hasDualTracks) {
    if (region.channel === 0) activeTrackTarget.value = 'mic'
    else if (region.channel === 1) activeTrackTarget.value = 'input'
    else activeTrackTarget.value = 'both'
  }
  emit('selectRegion', region)
}

function onResetStart() {
  emit('update:trimStart', 0)
  emit('resetStart')
}

function onResetEnd() {
  const dur = props.duration || 0
  emit('update:trimEnd', dur)
  emit('resetEnd')
}

function onResetSelection() {
  const dur = props.duration || 0
  emit('update:trimStart', 0)
  emit('update:trimEnd', dur)
  emit('resetSelection')
}

function onDeleteRegion(region: AudioGainRegion) {
  emit('deleteRegion', region)
}

const isMenuOpen = ref(false)
const menuBtnRef = ref<HTMLButtonElement | null>(null)
const menuDropdownRef = ref<HTMLDivElement | null>(null)

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
}

function onClearAllRanges() {
  isMenuOpen.value = false
  emit('clearAllGainRegions')
}

function onResetAllRangesTo1() {
  isMenuOpen.value = false
  emit('resetAllGainRegions')
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target instanceof Node ? e.target : null
  if (
    isMenuOpen.value &&
    menuDropdownRef.value &&
    target &&
    !menuDropdownRef.value.contains(target) &&
    !menuBtnRef.value?.contains(target)
  ) {
    isMenuOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  window.removeEventListener('click', onDocumentClick)
})
</script>

<style scoped>
.trim-summary-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  width: 100%;
}

.trim-summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1c1c20;
  padding: 0.55rem 1rem;
  border-radius: 8px;
  border: 1px solid #2e2e34;
  user-select: none;
  gap: 1rem;
  flex-wrap: wrap;
  min-width: min-content;
}

.trim-stats {
  display: flex;
  gap: 1.25rem;
  align-items: center;
}

button.stat-pill {
  background: transparent;
  border: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  padding: 0;
  margin: 0;
}

.stat-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  text-align: center;
}

.stat-pill.clickable {
  cursor: pointer;
  padding: 0.2rem 0.45rem;
  margin: -0.2rem -0.45rem;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.stat-pill.clickable * {
  pointer-events: none;
}

.stat-pill.clickable:hover {
  background: rgba(255, 255, 255, 0.08);
}

.stat-pill.clickable:hover .stat-label {
  color: #38bdf8;
}

.stat-pill.clickable:hover .stat-value {
  color: #ffffff;
}

.stat-pill.clickable:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

.stat-pill.clickable:active {
  transform: scale(0.96);
  background: rgba(255, 255, 255, 0.14);
}

.stat-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.01em;
}

.stat-value {
  font-size: 0.8rem;
  color: #a1a1aa;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Audio Gain & Leveling Section */
.audio-gain-controls {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  background: #141417;
  padding: 0.3rem 0.55rem;
  border-radius: 7px;
  border: 1px solid #27272a;
  flex-wrap: wrap;
}

.track-segmented-group {
  display: flex;
  align-items: center;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 5px;
  padding: 2px;
  gap: 2px;
}

.segment-btn {
  padding: 0.2rem 0.5rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #a1a1aa;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.segment-btn:hover:not(.active) {
  color: #ffffff;
  background: #27272a;
  border: 1px solid transparent;
}

.segment-btn.active {
  background: #3f3f46;
  color: #ffffff;
  border: 1px solid transparent;
}

.segment-btn.mic-segment.active {
  background: rgba(56, 189, 248, 0.18);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.segment-btn.input-segment.active {
  background: rgba(52, 211, 153, 0.18);
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.4);
}

.gain-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: nowrap;
}

.gain-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #d4d4d8;
}

.gain-box {
  display: flex;
  align-items: center;
  background: #09090b;
  border: 1px solid #3f3f46;
  border-radius: 5px;
  padding: 0.15rem 0.35rem;
  transition: border-color 0.15s ease;
}

.gain-box:focus-within {
  outline: 1px solid var(--primary-color);
}

.gain-input {
  width: 3.5rem;
  background: transparent;
  border: none;
  color: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
  font-weight: 600;
  text-align: right;
  padding: 0;
  outline: none;
  appearance: textfield;
}

.gain-input::-webkit-outer-spin-button,
.gain-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.gain-suffix {
  font-size: 0.72rem;
  color: #71717a;
  margin-left: 2px;
  font-weight: 600;
}

.gain-reset-icon-btn {
  background: transparent;
  border: none;
  color: #a1a1aa;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0 0.15rem;
  line-height: 1;
  transition:
    color 0.15s ease,
    transform 0.2s ease;
}

.gain-reset-icon-btn:hover {
  color: #38bdf8;
  transform: rotate(-45deg);
}

.auto-level-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.28rem 0.55rem;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 5px;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.auto-level-btn:hover {
  background: #3f3f46;
  color: var(--primary-color);
}

.auto-level-btn:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

/* Quick Actions */
.trim-quick-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.secondary-btn {
  padding: 0.35rem 0.85rem;
  min-width: 4.6rem;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  color: #e4e4e7;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.25;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition: all 0.15s ease;
}

.secondary-btn:hover:not(:disabled) {
  background: #3f3f46;
  color: #ffffff;
  border-color: #52525b;
}

.secondary-btn:focus-visible:not(:disabled) {
  outline: 2px solid var(--active-color, #38bdf8);
  outline-offset: 2px;
  background: #3f3f46;
  color: #ffffff;
  border-color: #52525b;
}

.secondary-btn.is-playing {
  background: #ef4444;
  border-color: #f87171;
  color: #ffffff;
}

.secondary-btn.is-playing:focus-visible:not(:disabled) {
  outline-color: #f87171;
}

.secondary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Active Gain Ranges Section */
.gain-ranges-strip {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  background: #141417;
  padding: 0.35rem 0.75rem;
  border-radius: 7px;
  border: 1px solid #27272a;
  user-select: none;
  flex-wrap: wrap;
}

.gain-ranges-header-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.gain-ranges-menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: 1px solid transparent;
  padding: 0.2rem 0.45rem;
  border-radius: 5px;
  color: #a1a1aa;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}

.gain-ranges-menu-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.1);
}

.gain-ranges-menu-btn:focus-visible {
  outline: 2px solid #38bdf8;
  outline-offset: 1px;
}

.chevron-icon {
  transition: transform 0.15s ease;
}

.gain-ranges-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 100;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  padding: 0.25rem;
  box-shadow:
    0 10px 25px -5px rgba(0, 0, 0, 0.6),
    0 8px 10px -6px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 185px;
  user-select: none;
}

.dropdown-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.65rem;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: #d4d4d8;
  font-size: 0.75rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all 0.12s ease;
}

.dropdown-menu-item:hover {
  background: #27272a;
  color: #ffffff;
}

.dropdown-menu-item.danger-item {
  color: #f87171;
}

.dropdown-menu-item.danger-item:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

.gain-ranges-header {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #a1a1aa;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.gain-ranges-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: #a1a1aa;
}

.gain-ranges-chips {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.gain-range-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: #1c1c20;
  border: 1px solid #323238;
  border-radius: 5px;
  padding: 0.2rem 0.5rem;
  font-size: 0.72rem;
  color: #e4e4e7;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.gain-range-chip:hover {
  background: #27272a;
  border-color: #52525b;
}

.gain-range-chip.is-active {
  background: rgba(56, 189, 248, 0.12);
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35);
}

.gain-range-chip.is-active.is-input {
  background: rgba(52, 211, 153, 0.12);
  border-color: #34d399;
  box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.35);
}

.chip-track-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.05rem 0.25rem;
  border-radius: 3px;
  background: #09090b;
}

.gain-range-chip.is-mic .chip-track-badge {
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.gain-range-chip.is-input .chip-track-badge {
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.3);
}

.gain-range-chip.is-both .chip-track-badge {
  color: #e4e4e7;
  border: 1px solid #3f3f46;
}

.chip-range {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
  font-weight: 600;
  color: #d4d4d8;
}

.chip-multiplier {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--negated-color);
  background: rgba(245, 158, 11, 0.12);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.chip-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 3px;
  font-size: 0.95rem;
  line-height: 1;
  color: #71717a;
  margin-left: 0.1rem;
  transition: all 0.15s ease;
}

.chip-delete-btn:hover {
  color: #ffffff;
  background: #ef4444;
}
</style>
