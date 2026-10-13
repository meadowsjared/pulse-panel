<template>
  <div class="waveform-editor-root">
    <!-- Waveform Visualizer & Trimmer Container -->
    <div class="waveform-container"
         ref="waveformContainerRef">
      <div class="waveform-labels">
        <span class="playback-controls">
          <!-- Play / Pause Preview Button -->
          <button type="button"
                  class="play-btn menu"
                  :class="{ playing: isPlaying }"
                  :disabled="!effectiveAudioBuffer || isLoading"
                  @click="togglePlayPreview"
                  title="Preview trimmed region">
            <svg v-if="!isPlaying"
                 class="w-5 h-5 ml-0.5"
                 viewBox="0 0 24 24"
                 fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <svg v-else
                 class="w-5 h-5"
                 viewBox="0 0 24 24"
                 fill="currentColor">
              <rect x="6"
                    y="4"
                    width="4"
                    height="16"></rect>
              <rect x="14"
                    y="4"
                    width="4"
                    height="16"></rect>
            </svg>
          </button>

          <!-- Stop Preview Button -->
          <button type="button"
                  class="stop-btn menu"
                  :disabled="!effectiveAudioBuffer || isLoading"
                  @click="onStopBtnClick"
                  title="Stop">
            <svg class="w-4 h-4"
                 viewBox="0 0 24 24"
                 fill="currentColor">
              <rect x="6"
                    y="6"
                    width="12"
                    height="12"></rect>
            </svg>
          </button>

          <!-- Time Readout (Clickable to Reset Selection to Full Extents) -->
          <span class="time-readout clickable"
                role="button"
                tabindex="0"
                title="Click to reset selection to full waveform extents"
                @click="resetSelectionToExtents"
                @keydown.enter.prevent="resetSelectionToExtents"
                @keydown.space.prevent="resetSelectionToExtents">
            {{ formatSeconds(relativeCurrentTime) }} / {{ formatSeconds(trimmedDuration) }}
          </span>

          <!-- Audio Clipboard & Edit Actions Group -->
          <audio-clipboard-group :can-undo="canUndo"
                                 :can-redo="canRedo"
                                 :can-cut="canCut"
                                 :can-copy="canCopy"
                                 :can-paste="canPaste"
                                 :paste-tooltip="pasteTooltip"
                                 @undo="onUndo"
                                 @redo="onRedo"
                                 @cut="onCutAudio"
                                 @copy="onCopyAudio"
                                 @paste="onPasteAudio"
                                 @delete="onDeleteAudio"
                                 @set-in="setInToCurrentTime"
                                 @set-out="setOutToCurrentTime" />
        </span>

        <!-- Audio Tracks Selector & Target Mode (Dual Tracks Mode Only) -->
        <div v-if="isDualTrackActive"
             class="audio-tracks-bar">
          <div class="track-selector-wrapper">
            <span class="track-selector-label">Selection</span>
            <div class="track-segmented-group"
                 ref="segmentedGroupRef"
                 :class="['target-' + activeTrackTarget, { 'is-resizing': isResizing }]"
                 role="group"
                 aria-label="Track audio selection target">
              <!-- Sliding Animated Indicator Pill -->
              <div class="segment-indicator"
                   :style="segmentIndicatorStyle"></div>

              <button ref="btnBothRef"
                      type="button"
                      class="segment-btn"
                      :class="{ active: activeTrackTarget === 'both' }"
                      title="Select both tracks"
                      @click="activeTrackTarget = 'both'">
                Both
              </button>
              <button ref="btnMicRef"
                      type="button"
                      class="segment-btn mic-segment"
                      :class="{ active: activeTrackTarget === 'mic' }"
                      title="Select Microphone track only"
                      @click="activeTrackTarget = 'mic'">
                🎤 Mic
              </button>
              <button ref="btnInputRef"
                      type="button"
                      class="segment-btn input-segment"
                      :class="{ active: activeTrackTarget === 'input' }"
                      title="Select Input Device track only"
                      @click="activeTrackTarget = 'input'">
                🔊 Input
              </button>
            </div>
          </div>
        </div>

        <!-- Optional Header Title / Slot (Single Track Mode) -->
        <div v-else-if="$slots['header-right'] || title"
             class="waveform-title">
          <slot name="header-right">
            <svg class="w-4 h-4 text-emerald-400"
                 viewBox="0 0 24 24"
                 fill="none"
                 stroke="currentColor"
                 stroke-width="2">
              <path d="M2 10v4M6 6v12M10 3v18M14 8v8M18 5v14M22 10v4" />
            </svg>
            <span>{{ title }}</span>
          </slot>
        </div>
      </div>

      <!-- Waveform Row with Left Track Controls Gutter -->
      <div class="waveform-body-row">
        <!-- Left Track Controls Gutter (aligned with each track lane, Dual Track Mode Only) -->
        <div v-if="isDualTrackActive"
             class="waveform-track-gutter"
             role="toolbar"
             aria-label="Audio track mute controls">
          <!-- Top Track: Microphone (Channel 1) -->
          <div class="track-gutter-slot top-slot">
            <button type="button"
                    :class="['track-icon-btn', 'menu', 'mic-icon-btn', { active: includeMic, muted: !includeMic }]"
                    @click="toggleMicTrack"
                    :title="includeMic ? 'Mute Microphone track in this clip' : 'Unmute Microphone track in this clip'"
                    :aria-label="includeMic ? 'Mute Microphone track' : 'Unmute Microphone track'">
              <svg class="w-4 h-4"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2"
                   stroke-linecap="round"
                   stroke-linejoin="round">
                <path class="mic-capsule"
                      d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path class="mic-cradle"
                      d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12"
                      y1="19"
                      x2="12"
                      y2="23"></line>
                <line x1="8"
                      y1="23"
                      x2="16"
                      y2="23"></line>
              </svg>
            </button>
          </div>

          <!-- Track Gutter Center Divider Line -->
          <div class="track-gutter-divider"></div>

          <!-- Bottom Track: Input Device (Channel 2) -->
          <div class="track-gutter-slot bottom-slot">
            <button type="button"
                    :class="[
                      'track-icon-btn', 'menu', 'input-icon-btn',
                      { active: includeInput, muted: !includeInput },
                    ]"
                    @click="toggleInputTrack"
                    :title="includeInput
                      ? 'Mute Input Device track in this clip'
                      : 'Unmute Input Device track in this clip'"
                    :aria-label="includeInput ? 'Mute Input Device track' : 'Unmute Input Device track'">
              <svg class="w-4 h-4"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2"
                   stroke-linecap="round"
                   stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path class="speaker-sound-waves"
                      d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Waveform Loading State -->
        <div v-if="isLoading"
             class="waveform-loading-state"
             :style="{ height: typeof height === 'number' ? `${height}px` : height }">
          <svg class="w-5 h-5 animate-spin text-emerald-400"
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               stroke-width="2">
            <circle cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                    class="opacity-25"></circle>
            <path fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                  class="opacity-75"></path>
          </svg>
          <span>{{ loadStatus || 'Loading audio for waveform...' }}</span>
          <div class="waveform-progress-bar-bg"
               v-if="loadProgress > 0">
            <div class="waveform-progress-bar-fill"
                 :style="{ width: `${loadProgress}%` }"></div>
          </div>
        </div>

        <!-- Waveform Error State -->
        <div v-else-if="loadError && !effectiveAudioBuffer"
             class="waveform-error-state"
             :style="{ height: typeof height === 'number' ? `${height}px` : height }">
          <span>{{ loadError }}</span>
          <button type="button"
                  class="waveform-retry-btn"
                  @click="$emit('retry')">
            Retry
          </button>
        </div>

        <!-- Waveform Graph Component -->
        <waveform-graph v-else
                        class="waveform-graph-main"
                        :audio-buffer="effectiveAudioBuffer"
                        :duration="effectiveDuration"
                        :tracks="waveformTracks"
                        :active-track="activeTrackTarget"
                        :segment-boundaries="segmentBoundaries"
                        :include-mic="includeMic"
                        :include-input="includeInput"
                        v-model:current-time="currentTime"
                        v-model:trim-start="trimStart"
                        v-model:trim-end="trimEnd"
                        :height="height"
                        :show-trim-handles="true"
                        :show-trim-labels="true"
                        :show-trim-instructions="showTrimInstructions"
                        :show-time-ticks="true"
                        :show-playhead="true"
                        :is-playing="isPlaying"
                        :can-paste="canPaste"
                        @scrub-start="onScrubStart"
                        @scrub-move="onScrubMove"
                        @scrub-end="onScrubEnd"
                        @trim-change="onTrimChange"
                        @trim-end-change="onTrimEndChange"
                        @split-at="onSplitAt"
                        @join-at="onJoinAt"
                        @play-from-cursor="onPlayFromCursor"
                        @paste-at-cursor="onPasteAudio" />
      </div>
    </div>

    <!-- Native Audio Elements for 1:1 hardware clock preview playback -->
    <!-- Single Track Audio Player -->
    <audio v-if="!isDualTrackActive"
           ref="mainAudioElRef"
           :src="mainPreviewUrl"
           preload="auto"
           style="display: none"
           @ended="onAudioEnded"
           @timeupdate="onAudioTimeUpdate"
           @loadedmetadata="onAudioMetadataLoaded"></audio>

    <!-- Dual Track Audio Players -->
    <template v-else>
      <audio ref="micAudioElRef"
             :src="micPreviewUrl"
             preload="auto"
             style="display: none"
             @ended="onAudioEnded"
             @timeupdate="onAudioTimeUpdate"
             @loadedmetadata="onAudioMetadataLoaded"></audio>
      <audio ref="inputAudioElRef"
             :src="inputPreviewUrl"
             preload="auto"
             style="display: none"></audio>
    </template>

    <!-- Trim Summary Bar with Audio Gain, Reset, and Quick Actions -->
    <trim-summary-bar v-model:trim-start="trimStart"
                      v-model:trim-end="trimEnd"
                      :duration="effectiveDuration"
                      :is-playing="isPlaying"
                      :show-trim-to-selection="true"
                      :can-trim-to-selection="canTrimToSelection"
                      :has-dual-tracks="isDualTrackActive"
                      v-model:active-track-target="activeTrackTarget"
                      :gain="singleGainMultiplier"
                      :mic-gain="micGainMultiplier"
                      :input-gain="inputGainMultiplier"
                      :has-partial-gains="appliedGainRegions.length > 0"
                      :gain-regions="appliedGainRegions"
                      @update:gain="onSingleGainChange"
                      @change-gain="onDualGainChange"
                      @auto-level="onAutoLevel"
                      @reset-gain="onResetGain"
                      @select-region="onSelectGainRegion"
                      @delete-region="onDeleteGainRegion"
                      @clear-all-gain-regions="onClearAllGainRegions"
                      @reset-all-gain-regions="onResetAllGainRegions"
                      @resetStart="resetTrimStart"
                      @resetEnd="resetTrimEnd"
                      @resetSelection="resetSelectionToExtents"
                      @reset="resetTrim"
                      @play-trimmed="playTrimmedOnly"
                      @trim-to-selection="trimToSelection" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef, watch, onMounted, onUnmounted, nextTick } from 'vue'
import WaveformGraph, { WaveformTrack } from './WaveformGraph.vue'
import TrimSummaryBar from './TrimSummaryBar.vue'
import AudioClipboardGroup from './AudioClipboardGroup.vue'
import { usePulseBackStore } from '../store/pulseBack'
import {
  calculateAutoGainMultiplier,
  calculateChannelPeak,
  applyGainToAudioBuffer,
  AudioGainRegion,
} from '../utils/audioGain'
import {
  AudioTimelineSegment,
  sharedAudioClipboard,
  createInitialSegments,
  getSegmentBoundaries,
  compositeSegments,
  copyAudioSelection,
  splitTimelineAt,
  joinTimelineAt,
  spliceTimelineSegments,
  cutTimelineSegments,
  deleteTimelineSegments,
  calculateSoundSegments,
} from '../utils/audioSegments'
import { SoundSegment } from '../@types/sound'
import { encodeWAV, encodeMP3, encodeOGG } from '../services/pulseBackBuffer'

interface Props {
  audioBuffer?: AudioBuffer | null;
  blob?: Blob | null;
  originalBlob?: Blob | null;
  duration?: number;
  clipId?: string;
  trimStart?: number;
  trimEnd?: number;
  currentTime?: number;
  enableDualTracks?: boolean;
  activeTrackTarget?: 'both' | 'mic' | 'input';
  includeMic?: boolean;
  includeInput?: boolean;
  gain?: number;
  micGain?: number;
  inputGain?: number;
  appliedGainRegions?: AudioGainRegion[];
  segmentBoundaries?: number[];
  volume?: number;
  height?: number | string;
  showTrimInstructions?: boolean;
  title?: string;
  isLoading?: boolean;
  loadProgress?: number;
  loadStatus?: string;
  loadError?: string;
}

const props = withDefaults(defineProps<Props>(), {
  audioBuffer: null,
  blob: null,
  originalBlob: null,
  duration: 0,
  clipId: '',
  trimStart: 0,
  trimEnd: 0,
  currentTime: 0,
  enableDualTracks: false,
  activeTrackTarget: 'both',
  includeMic: true,
  includeInput: true,
  gain: 1.0,
  micGain: 1.0,
  inputGain: 1.0,
  appliedGainRegions: () => [],
  segmentBoundaries: () => [],
  volume: 100,
  height: 140,
  showTrimInstructions: false,
  title: '',
  isLoading: false,
  loadProgress: 0,
  loadStatus: '',
  loadError: '',
})

const emit = defineEmits<{
  (e: 'update:trimStart', val: number): void;
  (e: 'update:trimEnd', val: number): void;
  (e: 'update:currentTime', val: number): void;
  (e: 'update:audioBuffer', buf: AudioBuffer | null): void;
  (e: 'update:activeTrackTarget', val: 'both' | 'mic' | 'input'): void;
  (e: 'update:includeMic', val: boolean): void;
  (e: 'update:includeInput', val: boolean): void;
  (e: 'update:gain', val: number): void;
  (e: 'update:micGain', val: number): void;
  (e: 'update:inputGain', val: number): void;
  (e: 'update:appliedGainRegions', val: AudioGainRegion[]): void;
  (e: 'update:segmentBoundaries', val: number[]): void;
  (e: 'timelineChange', payload: {
    buffer: AudioBuffer;
    blob: Blob;
    duration: number;
    segments: AudioTimelineSegment[];
    boundaries: number[];
  }): void;
  (e: 'change'): void;
  (e: 'retry'): void;
}>()

const pulseBackStore = usePulseBackStore()

// Internal Audio Buffer State
const cleanBaseAudioBuffer = shallowRef<AudioBuffer | null>(null)
const effectiveAudioBuffer = shallowRef<AudioBuffer | null>(null)
const originalAudioBuffer = shallowRef<AudioBuffer | null>(null)

// Audio Elements & Preview URLs
const mainAudioElRef = ref<HTMLAudioElement | null>(null)
const micAudioElRef = ref<HTMLAudioElement | null>(null)
const inputAudioElRef = ref<HTMLAudioElement | null>(null)
const mainPreviewUrl = ref<string>('')
const micPreviewUrl = ref<string>('')
const inputPreviewUrl = ref<string>('')
let audioContext: AudioContext | null = null

// Multi-Segment Audio Timeline State
const timelineSegments = ref<AudioTimelineSegment[]>([])
const segmentBoundaries = computed(() => getSegmentBoundaries(timelineSegments.value))

// Dual Track State
const hasDualChannels = ref(false)
const isDualTrackActive = computed(() => props.enableDualTracks && hasDualChannels.value)

const activeTrackTarget = computed({
  get: () => (isDualTrackActive.value ? props.activeTrackTarget : 'both'),
  set: (val: 'both' | 'mic' | 'input') => emit('update:activeTrackTarget', val),
})

const includeMic = computed({
  get: () => props.includeMic,
  set: (val: boolean) => emit('update:includeMic', val),
})

const includeInput = computed({
  get: () => props.includeInput,
  set: (val: boolean) => emit('update:includeInput', val),
})

// Gain State
const globalSingleGain = ref(props.gain || 1.0)
const singleGainMultiplier = ref(props.gain || 1.0)
const globalMicGain = ref(props.micGain || 1.0)
const globalInputGain = ref(props.inputGain || 1.0)
const micGainMultiplier = ref(props.micGain || 1.0)
const inputGainMultiplier = ref(props.inputGain || 1.0)
const appliedGainRegions = ref<AudioGainRegion[]>([...(props.appliedGainRegions || [])])

// Trimming & Playhead State
const trimStart = ref(props.trimStart || 0)
const trimEnd = ref(props.trimEnd || 0)
const currentTime = ref(props.currentTime || 0)
const isPlaying = ref(false)

let playbackEndSec = 0
let playbackAnimationId: number | null = null

// Durations
const effectiveDuration = computed(() => {
  return effectiveAudioBuffer.value?.duration || props.duration || 1
})

const trimmedDuration = computed(() => Math.max(0, trimEnd.value - trimStart.value))

const relativeCurrentTime = computed(() => {
  if (trimmedDuration.value <= 0) return 0
  return Math.max(0, Math.min(trimmedDuration.value, currentTime.value - trimStart.value))
})

const canTrimToSelection = computed(() => {
  if (!effectiveAudioBuffer.value) return false
  const dur = effectiveDuration.value
  return trimEnd.value > trimStart.value && (trimStart.value > 0.01 || trimEnd.value < dur - 0.01)
})

// Segmented Indicator Animation Ref
const segmentedGroupRef = ref<HTMLElement | null>(null)
const btnBothRef = ref<HTMLButtonElement | null>(null)
const btnMicRef = ref<HTMLButtonElement | null>(null)
const btnInputRef = ref<HTMLButtonElement | null>(null)

const indicatorPos = ref<{ x: number; y: number; width: number; height: number; visible: boolean; }>({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  visible: false,
})

function updateSegmentIndicator() {
  const container = segmentedGroupRef.value
  const activeBtn = activeTrackTarget.value === 'both'
    ? btnBothRef.value
    : activeTrackTarget.value === 'mic'
      ? btnMicRef.value
      : btnInputRef.value

  if (!container || !activeBtn) return

  const containerRect = container.getBoundingClientRect()
  const btnRect = activeBtn.getBoundingClientRect()

  if (btnRect.width > 0 && btnRect.height > 0) {
    indicatorPos.value = {
      x: btnRect.left - containerRect.left - container.clientLeft,
      y: btnRect.top - containerRect.top - container.clientTop,
      width: btnRect.width,
      height: btnRect.height,
      visible: true,
    }
  }
}

const segmentIndicatorStyle = computed(() => {
  if (!indicatorPos.value.visible) {
    return { opacity: 0 }
  }
  return {
    transform: `translate3d(${indicatorPos.value.x}px, ${indicatorPos.value.y}px, 0)`,
    width: `${indicatorPos.value.width}px`,
    height: `${indicatorPos.value.height}px`,
    opacity: 1,
  }
})

let segmentedResizeObserver: ResizeObserver | null = null
let resizeTimer: number | null = null
const isResizing = ref(false)

function attachSegmentedResizeObserver() {
  segmentedResizeObserver?.disconnect()
  if (typeof ResizeObserver === 'undefined') return
  segmentedResizeObserver = new ResizeObserver(() => {
    updateSegmentIndicator()
  })
  if (segmentedGroupRef.value) segmentedResizeObserver.observe(segmentedGroupRef.value)
  if (btnBothRef.value) segmentedResizeObserver.observe(btnBothRef.value)
  if (btnMicRef.value) segmentedResizeObserver.observe(btnMicRef.value)
  if (btnInputRef.value) segmentedResizeObserver.observe(btnInputRef.value)
}

// Waveform Track Configuration
const waveformTracks = computed<WaveformTrack[]>(() => {
  if (!isDualTrackActive.value) {
    return [
      {
        label: '',
        channelIndex: 0,
        enabled: true,
      },
    ]
  }
  return [
    {
      label: '🎤 MIC (VOICE)',
      channelIndex: 0,
      enabled: includeMic.value,
    },
    {
      label: '🔊 INPUT DEVICE (AUDIO)',
      channelIndex: 1,
      enabled: includeInput.value,
    },
  ]
})

// Audio History Stack
interface TimelineHistoryItem {
  segments: AudioTimelineSegment[];
  cleanBaseBuffer: AudioBuffer;
  gainRegions: AudioGainRegion[];
  trimStart: number;
  trimEnd: number;
  currentTime: number;
}

const undoStack = ref<TimelineHistoryItem[]>([])
const redoStack = ref<TimelineHistoryItem[]>([])
const canUndo = computed(() => undoStack.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)
const canCopy = computed(() => effectiveDuration.value > 0)
const canCut = computed(() => {
  if (effectiveDuration.value <= 0) return false
  const totalDur = effectiveDuration.value
  const isTrimmed = trimStart.value > 0.05 || (trimEnd.value > 0 && trimEnd.value < totalDur - 0.05)
  const selDuration = (trimEnd.value > 0 ? trimEnd.value : totalDur) - trimStart.value
  return isTrimmed && selDuration > 0.05
})
const canPaste = computed(() => sharedAudioClipboard.value !== null)
const pasteTooltip = computed(() => {
  if (!canPaste.value) return 'Paste audio (Ctrl+V) - Clipboard empty'
  const totalDur = effectiveDuration.value
  const hasSubSelection = (trimEnd.value > 0 && trimEnd.value < totalDur - 0.05) || trimStart.value > 0.05
  const isCursorInside = hasSubSelection &&
    (currentTime.value >= trimStart.value - 0.05 && currentTime.value <= trimEnd.value + 0.05)
  if (hasSubSelection && isCursorInside) {
    return `Paste (Replace selection ${formatSeconds(trimStart.value)} - ${formatSeconds(trimEnd.value)}) (Ctrl+V)`
  }
  return `Paste at cursor (${formatSeconds(currentTime.value)}) (Ctrl+V)`
})

let lastEmittedBlob: Blob | null = null
let lastEmittedBuffer: AudioBuffer | null = null

function pushUndoState() {
  if (!cleanBaseAudioBuffer.value) return
  undoStack.value.push({
    segments: [...timelineSegments.value],
    cleanBaseBuffer: cleanBaseAudioBuffer.value,
    gainRegions: JSON.parse(JSON.stringify(appliedGainRegions.value)),
    trimStart: trimStart.value,
    trimEnd: trimEnd.value,
    currentTime: currentTime.value,
  })
  if (undoStack.value.length > 30) {
    undoStack.value.shift()
  }
  redoStack.value = []
}

// Audio Context Helper
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

function getAudioContext(): AudioContext {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported in this browser environment')
  }
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextClass()
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => { })
  }
  return audioContext
}

function clearPreviewUrls() {
  if (mainPreviewUrl.value) {
    try { URL.revokeObjectURL(mainPreviewUrl.value) } catch { }
    mainPreviewUrl.value = ''
  }
  if (micPreviewUrl.value) {
    try { URL.revokeObjectURL(micPreviewUrl.value) } catch { }
    micPreviewUrl.value = ''
  }
  if (inputPreviewUrl.value) {
    try { URL.revokeObjectURL(inputPreviewUrl.value) } catch { }
    inputPreviewUrl.value = ''
  }
}

function updatePreviewUrls() {
  const buf = effectiveAudioBuffer.value
  if (!buf) return
  const numChannels = buf.numberOfChannels
  const sampleRate = buf.sampleRate

  if (!isDualTrackActive.value) {
    const ch0 = buf.getChannelData(0)
    const ch1 = numChannels >= 2 ? buf.getChannelData(1) : undefined
    const blob = encodeWAV(ch0, sampleRate, ch1)
    if (mainPreviewUrl.value) {
      try { URL.revokeObjectURL(mainPreviewUrl.value) } catch { }
    }
    mainPreviewUrl.value = URL.createObjectURL(blob)
  } else {
    const micData = buf.getChannelData(0)
    const micBlob = encodeWAV(micData, sampleRate)
    if (micPreviewUrl.value) {
      try { URL.revokeObjectURL(micPreviewUrl.value) } catch { }
    }
    micPreviewUrl.value = URL.createObjectURL(micBlob)

    if (numChannels >= 2) {
      const inputData = buf.getChannelData(1)
      const inputBlob = encodeWAV(inputData, sampleRate)
      if (inputPreviewUrl.value) {
        try { URL.revokeObjectURL(inputPreviewUrl.value) } catch { }
      }
      inputPreviewUrl.value = URL.createObjectURL(inputBlob)
    } else {
      if (inputPreviewUrl.value) {
        try { URL.revokeObjectURL(inputPreviewUrl.value) } catch { }
      }
      inputPreviewUrl.value = ''
    }
  }
}

function syncAudioCurrentTime(sec: number) {
  if (mainAudioElRef.value && mainAudioElRef.value.readyState >= 1) {
    mainAudioElRef.value.currentTime = sec
  }
  if (micAudioElRef.value && micAudioElRef.value.readyState >= 1) {
    micAudioElRef.value.currentTime = sec
  }
  if (inputAudioElRef.value && inputAudioElRef.value.readyState >= 1) {
    inputAudioElRef.value.currentTime = sec
  }
}

function updateTrackVolumes() {
  const masterVol = (props.volume ?? 100) / 100

  if (!isDualTrackActive.value) {
    if (mainAudioElRef.value) {
      mainAudioElRef.value.volume = Math.max(0, Math.min(1, masterVol))
    }
    return
  }

  const bothActive = includeMic.value && includeInput.value && hasDualChannels.value
  const factor = bothActive ? 0.75 : 1.0

  if (micAudioElRef.value) {
    micAudioElRef.value.muted = !includeMic.value
    micAudioElRef.value.volume = includeMic.value ? masterVol * factor : 0
    if (isPlaying.value && includeMic.value && micAudioElRef.value.paused) {
      micAudioElRef.value.currentTime = currentTime.value
      micAudioElRef.value.play().catch(() => { })
    }
  }
  if (inputAudioElRef.value) {
    inputAudioElRef.value.muted = !includeInput.value
    inputAudioElRef.value.volume = includeInput.value ? masterVol * factor : 0
    if (isPlaying.value && includeInput.value && inputAudioElRef.value.paused) {
      inputAudioElRef.value.currentTime = currentTime.value
      inputAudioElRef.value.play().catch(() => { })
    }
  }
}

function updateActiveGainDisplay() {
  const totalDur = effectiveDuration.value
  const startSec = trimStart.value
  const endSec = trimEnd.value > 0 ? trimEnd.value : totalDur
  const isPartial = startSec > 0.05 || (endSec < totalDur - 0.05 && endSec > 0)

  if (isDualTrackActive.value) {
    if (isPartial) {
      const micRegion = appliedGainRegions.value.find(
        r => (r.channel === undefined || r.channel === 0) &&
          ((Math.abs(r.startSec - startSec) < 0.25 && Math.abs(r.endSec - endSec) < 0.25) ||
            (startSec >= r.startSec - 0.08 && endSec <= r.endSec + 0.08))
      )
      micGainMultiplier.value = micRegion && micRegion.multiplier !== undefined
        ? micRegion.multiplier
        : globalMicGain.value

      const inputRegion = appliedGainRegions.value.find(
        r => (r.channel === undefined || r.channel === 1) &&
          ((Math.abs(r.startSec - startSec) < 0.25 && Math.abs(r.endSec - endSec) < 0.25) ||
            (startSec >= r.startSec - 0.08 && endSec <= r.endSec + 0.08))
      )
      inputGainMultiplier.value = inputRegion && inputRegion.multiplier !== undefined
        ? inputRegion.multiplier
        : globalInputGain.value
    } else {
      const fullMicRegion = appliedGainRegions.value.find(
        r => (r.channel === undefined || r.channel === 0) &&
          r.startSec <= startSec + 0.1 && r.endSec >= endSec - 0.1
      )
      micGainMultiplier.value = fullMicRegion && fullMicRegion.multiplier !== undefined
        ? fullMicRegion.multiplier
        : globalMicGain.value

      const fullInputRegion = appliedGainRegions.value.find(
        r => (r.channel === undefined || r.channel === 1) &&
          r.startSec <= startSec + 0.1 && r.endSec >= endSec - 0.1
      )
      inputGainMultiplier.value = fullInputRegion && fullInputRegion.multiplier !== undefined
        ? fullInputRegion.multiplier
        : globalInputGain.value
    }
    emit('update:micGain', micGainMultiplier.value)
    emit('update:inputGain', inputGainMultiplier.value)
  } else {
    if (isPartial) {
      const reg = appliedGainRegions.value.find(
        r => ((Math.abs(r.startSec - startSec) < 0.25 && Math.abs(r.endSec - endSec) < 0.25) ||
          (startSec >= r.startSec - 0.08 && endSec <= r.endSec + 0.08))
      )
      singleGainMultiplier.value = reg && reg.multiplier !== undefined ? reg.multiplier : globalSingleGain.value
    } else {
      const fullReg = appliedGainRegions.value.find(
        r => r.startSec <= startSec + 0.1 && r.endSec >= endSec - 0.1
      )
      singleGainMultiplier.value = fullReg && fullReg.multiplier !== undefined
        ? fullReg.multiplier
        : globalSingleGain.value
    }
    emit('update:gain', singleGainMultiplier.value)
  }
}

function applyGain() {
  const base = cleanBaseAudioBuffer.value
  if (!base) return
  const ctx = getAudioContext()
  const hasDual = isDualTrackActive.value

  effectiveAudioBuffer.value = applyGainToAudioBuffer(
    ctx,
    base,
    hasDual ? [globalMicGain.value, globalInputGain.value] : globalSingleGain.value,
    appliedGainRegions.value
  )

  lastEmittedBuffer = effectiveAudioBuffer.value
  emit('update:audioBuffer', effectiveAudioBuffer.value)
  updatePreviewUrls()
  updateTrackVolumes()
  syncAudioCurrentTime(currentTime.value)
  emit('change')
}

// Gain Change Handlers
function onSingleGainChange(val: number) {
  const totalDur = effectiveDuration.value
  const startSec = Math.max(0, trimStart.value)
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur)
  const isPartial = startSec > 0.05 || (endSec < totalDur - 0.05 && endSec > 0)

  singleGainMultiplier.value = val
  if (isPartial) {
    appliedGainRegions.value = appliedGainRegions.value.filter(
      r => !(Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
    )
    appliedGainRegions.value.push({
      id: 'gain-yt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      startSec,
      endSec,
      multiplier: val,
    })
  } else {
    appliedGainRegions.value = []
    globalSingleGain.value = val
  }
  emit('update:appliedGainRegions', appliedGainRegions.value)
  applyGain()
  updateActiveGainDisplay()
}

function onDualGainChange(payload: { target: 'both' | 'mic' | 'input'; multiplier: number; }) {
  if (!isDualTrackActive.value) {
    onSingleGainChange(payload.multiplier)
    return
  }

  const totalDur = effectiveDuration.value
  const startSec = Math.max(0, trimStart.value)
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur)
  const isPartial = startSec > 0.05 || (endSec < totalDur - 0.05 && endSec > 0)

  if (payload.target === 'mic' || payload.target === 'both') {
    micGainMultiplier.value = payload.multiplier
    if (isPartial) {
      appliedGainRegions.value = appliedGainRegions.value.filter(
        r => !(r.channel === 0 && Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
      )
      appliedGainRegions.value.push({
        id: 'gain-pb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        startSec,
        endSec,
        channel: 0,
        multiplier: payload.multiplier,
      })
    } else {
      appliedGainRegions.value = appliedGainRegions.value.filter(r => r.channel !== 0)
      globalMicGain.value = payload.multiplier
    }
  }

  if (payload.target === 'input' || payload.target === 'both') {
    inputGainMultiplier.value = payload.multiplier
    if (isPartial) {
      appliedGainRegions.value = appliedGainRegions.value.filter(
        r => !(r.channel === 1 && Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
      )
      appliedGainRegions.value.push({
        id: 'gain-pb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        startSec,
        endSec,
        channel: 1,
        multiplier: payload.multiplier,
      })
    } else {
      appliedGainRegions.value = appliedGainRegions.value.filter(r => r.channel !== 1)
      globalInputGain.value = payload.multiplier
    }
  }

  emit('update:appliedGainRegions', appliedGainRegions.value)
  applyGain()
  updateActiveGainDisplay()
}

function onAutoLevel(target: 'both' | 'mic' | 'input') {
  const base = cleanBaseAudioBuffer.value
  if (!base) return

  pushUndoState()

  const sampleRate = base.sampleRate
  const totalDur = effectiveDuration.value
  const startSec = Math.max(0, trimStart.value)
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur)
  const isPartial = startSec > 0.05 || (endSec < totalDur - 0.05 && endSec > 0)

  const startSample = Math.max(0, Math.floor(startSec * sampleRate))
  const endSample = Math.min(base.length, Math.floor(endSec * sampleRate))

  if (!isDualTrackActive.value) {
    const ch0 = base.getChannelData(0)
    const ch1 = base.numberOfChannels >= 2 ? base.getChannelData(1) : null
    const peak0 = calculateChannelPeak(ch0, startSample, endSample)
    const peak1 = ch1 ? calculateChannelPeak(ch1, startSample, endSample) : 0
    const maxPeak = Math.max(peak0, peak1)
    if (maxPeak <= 0.0001) return
    const targetChannel = peak0 >= peak1 ? ch0 : ch1!
    const mult = calculateAutoGainMultiplier(targetChannel, 0.944, undefined, startSample, endSample)
    singleGainMultiplier.value = mult

    if (isPartial) {
      appliedGainRegions.value = appliedGainRegions.value.filter(
        r => !(Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
      )
      appliedGainRegions.value.push({
        id: 'gain-yt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        startSec,
        endSec,
        multiplier: mult,
      })
    } else {
      appliedGainRegions.value = []
      globalSingleGain.value = mult
    }
  } else {
    if (target === 'mic' || target === 'both') {
      const ch0 = base.getChannelData(0)
      const mult0 = calculateAutoGainMultiplier(ch0, 0.944, undefined, startSample, endSample)
      micGainMultiplier.value = mult0

      if (isPartial) {
        appliedGainRegions.value = appliedGainRegions.value.filter(
          r => !(r.channel === 0 && Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
        )
        appliedGainRegions.value.push({
          id: 'gain-pb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          startSec,
          endSec,
          channel: 0,
          multiplier: mult0,
        })
      } else {
        appliedGainRegions.value = appliedGainRegions.value.filter(r => r.channel !== 0)
        globalMicGain.value = mult0
      }
    }

    if ((target === 'input' || target === 'both') && base.numberOfChannels >= 2) {
      const ch1 = base.getChannelData(1)
      const mult1 = calculateAutoGainMultiplier(ch1, 0.944, undefined, startSample, endSample)
      inputGainMultiplier.value = mult1

      if (isPartial) {
        appliedGainRegions.value = appliedGainRegions.value.filter(
          r => !(r.channel === 1 && Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
        )
        appliedGainRegions.value.push({
          id: 'gain-pb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          startSec,
          endSec,
          channel: 1,
          multiplier: mult1,
        })
      } else {
        appliedGainRegions.value = appliedGainRegions.value.filter(r => r.channel !== 1)
        globalInputGain.value = mult1
      }
    }
  }

  emit('update:appliedGainRegions', appliedGainRegions.value)
  applyGain()
  updateActiveGainDisplay()
}

function onResetGain(target: 'both' | 'mic' | 'input') {
  pushUndoState()
  const totalDur = effectiveDuration.value
  const startSec = Math.max(0, trimStart.value)
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur)

  if (!isDualTrackActive.value) {
    singleGainMultiplier.value = 1.0
    appliedGainRegions.value = []
    globalSingleGain.value = 1.0
  } else {
    if (target === 'mic' || target === 'both') {
      micGainMultiplier.value = 1.0
      appliedGainRegions.value = appliedGainRegions.value.filter(
        r => !((r.channel === 0 || r.channel === undefined) && r.startSec < endSec && r.endSec > startSec)
      )
      globalMicGain.value = 1.0
    }

    if (target === 'input' || target === 'both') {
      inputGainMultiplier.value = 1.0
      appliedGainRegions.value = appliedGainRegions.value.filter(
        r => !((r.channel === 1 || r.channel === undefined) && r.startSec < endSec && r.endSec > startSec)
      )
      globalInputGain.value = 1.0
    }
  }

  emit('update:appliedGainRegions', appliedGainRegions.value)
  applyGain()
  updateActiveGainDisplay()
}

function onSelectGainRegion(region: AudioGainRegion) {
  trimStart.value = region.startSec
  trimEnd.value = region.endSec
  currentTime.value = region.startSec
  emit('update:trimStart', trimStart.value)
  emit('update:trimEnd', trimEnd.value)
  emit('update:currentTime', currentTime.value)
  syncAudioCurrentTime(region.startSec)

  if (isDualTrackActive.value) {
    if (region.channel === 0) {
      micGainMultiplier.value = region.multiplier
    } else if (region.channel === 1) {
      inputGainMultiplier.value = region.multiplier
    } else {
      micGainMultiplier.value = region.multiplier
      inputGainMultiplier.value = region.multiplier
    }
  } else {
    singleGainMultiplier.value = region.multiplier
  }
}

function onDeleteGainRegion(region: AudioGainRegion) {
  pushUndoState()
  appliedGainRegions.value = appliedGainRegions.value.filter(r => {
    if (region.id && r.id) return r.id !== region.id
    return !(
      (r.channel === region.channel || r.channel === undefined || region.channel === undefined) &&
      Math.abs(r.startSec - region.startSec) < 0.1 &&
      Math.abs(r.endSec - region.endSec) < 0.1
    )
  })
  emit('update:appliedGainRegions', appliedGainRegions.value)
  applyGain()
  updateActiveGainDisplay()
}

function onClearAllGainRegions() {
  pushUndoState()
  appliedGainRegions.value = []
  emit('update:appliedGainRegions', appliedGainRegions.value)
  applyGain()
  updateActiveGainDisplay()
}

function onResetAllGainRegions() {
  pushUndoState()
  appliedGainRegions.value = appliedGainRegions.value.map(r => ({ ...r, multiplier: 1.0 }))
  emit('update:appliedGainRegions', appliedGainRegions.value)
  applyGain()
  updateActiveGainDisplay()
}

// Reset Helpers
function resetTrimStart() {
  trimStart.value = 0
  currentTime.value = 0
  emit('update:trimStart', 0)
  emit('update:currentTime', 0)
  syncAudioCurrentTime(0)
  updateActiveGainDisplay()
  emit('change')
}

function resetTrimEnd() {
  const dur = effectiveDuration.value
  trimEnd.value = dur
  emit('update:trimEnd', dur)
  if (currentTime.value > dur) {
    currentTime.value = dur
    emit('update:currentTime', dur)
    syncAudioCurrentTime(dur)
  }
  updateActiveGainDisplay()
  emit('change')
}

function resetSelectionToExtents() {
  const dur = effectiveDuration.value
  trimStart.value = 0
  trimEnd.value = dur
  currentTime.value = 0
  emit('update:trimStart', 0)
  emit('update:trimEnd', dur)
  emit('update:currentTime', 0)
  syncAudioCurrentTime(0)
  updateActiveGainDisplay()
  emit('change')
}

async function resetTrim() {
  stopPreview()
  stopScrubSnippet()
  if (props.originalBlob) {
    pushUndoState()
    await loadAudioData(props.originalBlob)
  } else if (originalAudioBuffer.value) {
    pushUndoState()
    cleanBaseAudioBuffer.value = originalAudioBuffer.value
    timelineSegments.value = createInitialSegments(originalAudioBuffer.value)
    applyGain()
  }
  resetSelectionToExtents()
}

// Trimming to Selection
function trimToSelection() {
  const buf = cleanBaseAudioBuffer.value || effectiveAudioBuffer.value
  if (!buf || !canTrimToSelection.value) return

  pushUndoState()
  stopPreview()
  stopScrubSnippet()

  const startSec = trimStart.value
  const endSec = trimEnd.value
  const sampleRate = buf.sampleRate
  const startSample = Math.max(0, Math.floor(startSec * sampleRate))
  const endSample = Math.min(buf.length, Math.floor(endSec * sampleRate))
  const newLength = Math.max(0, endSample - startSample)
  if (newLength <= 0) return

  const newDuration = newLength / sampleRate
  const ctx = getAudioContext()
  const numChannels = buf.numberOfChannels
  const newBuf = ctx.createBuffer(numChannels, newLength, sampleRate)

  for (let ch = 0; ch < numChannels; ch++) {
    newBuf.getChannelData(ch).set(buf.getChannelData(ch).subarray(startSample, endSample))
  }

  cleanBaseAudioBuffer.value = newBuf
  timelineSegments.value = createInitialSegments(newBuf)

  // Shift partial gain regions
  const newGainRegions: AudioGainRegion[] = []
  for (const reg of appliedGainRegions.value) {
    const overlapStart = Math.max(reg.startSec, startSec)
    const overlapEnd = Math.min(reg.endSec, endSec)
    if (overlapEnd - overlapStart > 0.02) {
      newGainRegions.push({
        ...reg,
        startSec: Math.max(0, overlapStart - startSec),
        endSec: Math.min(newDuration, overlapEnd - startSec),
      })
    }
  }
  appliedGainRegions.value = newGainRegions
  emit('update:appliedGainRegions', newGainRegions)

  applyGain()

  trimStart.value = 0
  trimEnd.value = newDuration
  currentTime.value = 0
  emit('update:trimStart', 0)
  emit('update:trimEnd', newDuration)
  emit('update:currentTime', 0)

  const newBlob = isDualTrackActive.value && numChannels >= 2
    ? encodeWAV(newBuf.getChannelData(0), sampleRate, newBuf.getChannelData(1))
    : encodeWAV(newBuf.getChannelData(0), sampleRate, numChannels >= 2 ? newBuf.getChannelData(1) : undefined)

  lastEmittedBlob = newBlob
  lastEmittedBuffer = newBuf

  emit('timelineChange', {
    buffer: newBuf,
    blob: newBlob,
    duration: newDuration,
    segments: timelineSegments.value,
    boundaries: segmentBoundaries.value,
  })
}

// Timeline Commit (for Cut, Delete, Paste, Splice)
async function commitTimelineChange(
  newSegments: AudioTimelineSegment[],
  newTrimStart?: number,
  newTrimEnd?: number,
  newCurrentTime?: number
) {
  stopPreview()
  stopScrubSnippet()
  const ctx = getAudioContext()
  timelineSegments.value = newSegments
  const composite = compositeSegments(ctx, newSegments)
  cleanBaseAudioBuffer.value = composite
  hasDualChannels.value = composite.numberOfChannels >= 2

  const dur = composite.duration
  trimStart.value = newTrimStart !== undefined ? Math.max(0, Math.min(newTrimStart, dur)) : 0
  trimEnd.value = newTrimEnd !== undefined ? Math.max(trimStart.value, Math.min(newTrimEnd, dur)) : dur
  currentTime.value = newCurrentTime !== undefined
    ? Math.max(0, Math.min(newCurrentTime, dur))
    : Math.max(0, Math.min(currentTime.value, dur))

  emit('update:trimStart', trimStart.value)
  emit('update:trimEnd', trimEnd.value)
  emit('update:currentTime', currentTime.value)

  applyGain()

  const sampleRate = composite.sampleRate
  const newBlob = isDualTrackActive.value && composite.numberOfChannels >= 2
    ? encodeWAV(composite.getChannelData(0), sampleRate, composite.getChannelData(1))
    : encodeWAV(
      composite.getChannelData(0),
      sampleRate,
      composite.numberOfChannels >= 2 ? composite.getChannelData(1) : undefined
    )

  lastEmittedBlob = newBlob
  lastEmittedBuffer = composite

  emit('update:segmentBoundaries', segmentBoundaries.value)
  emit('timelineChange', {
    buffer: composite,
    blob: newBlob,
    duration: dur,
    segments: timelineSegments.value,
    boundaries: segmentBoundaries.value,
  })
  emit('change')
}

// Clipboard Actions
function onCopyAudio() {
  const base = cleanBaseAudioBuffer.value
  if (!base) return
  const ctx = getAudioContext()
  const totalDur = effectiveDuration.value
  const startSec = Math.max(0, trimStart.value)
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur)

  sharedAudioClipboard.value = copyAudioSelection(
    ctx,
    timelineSegments.value,
    startSec,
    endSec,
    activeTrackTarget.value
  )

  const numSegs = sharedAudioClipboard.value.segments?.length || 1
  const segsLabel = numSegs > 1 ? ` (${numSegs} segments)` : ''
  const trackLabel = isDualTrackActive.value
    ? (activeTrackTarget.value === 'both'
      ? 'Both tracks'
      : activeTrackTarget.value === 'mic'
        ? 'Mic track'
        : 'Input track')
    : 'Audio'
  pulseBackStore.showToast(`Copied ${trackLabel} ${(endSec - startSec).toFixed(2)}s${segsLabel}`)
}

function onCutAudio() {
  if (!canCut.value) {
    pulseBackStore.showToast('Please select a region with trim handles to cut')
    return
  }
  const base = cleanBaseAudioBuffer.value
  if (!base) return
  const ctx = getAudioContext()
  const totalDur = effectiveDuration.value
  const startSec = Math.max(0, trimStart.value)
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur)
  if (endSec <= startSec + 0.005) return

  pushUndoState()

  const { newSegments, clipboardData } = cutTimelineSegments(
    ctx,
    timelineSegments.value,
    startSec,
    endSec,
    activeTrackTarget.value
  )

  sharedAudioClipboard.value = clipboardData

  const cutDuration = endSec - startSec
  appliedGainRegions.value = appliedGainRegions.value
    .filter(r => !(r.startSec >= startSec && r.endSec <= endSec))
    .map(r => {
      if (r.startSec >= endSec) {
        return {
          ...r,
          startSec: Math.max(0, r.startSec - cutDuration),
          endSec: Math.max(0, r.endSec - cutDuration),
        }
      }
      return r
    })

  commitTimelineChange(newSegments, 0, undefined, startSec)
  pulseBackStore.showToast(`Cut ${(cutDuration).toFixed(2)}s to clipboard`)
}

function onDeleteAudio() {
  if (!canCut.value) {
    pulseBackStore.showToast('Please select a region with trim handles to delete')
    return
  }
  const base = cleanBaseAudioBuffer.value
  if (!base) return
  const ctx = getAudioContext()
  const totalDur = effectiveDuration.value
  const startSec = Math.max(0, trimStart.value)
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur)
  if (endSec <= startSec + 0.005) return

  pushUndoState()

  const newSegments = deleteTimelineSegments(
    ctx,
    timelineSegments.value,
    startSec,
    endSec,
    activeTrackTarget.value
  )

  const deleteDuration = endSec - startSec
  appliedGainRegions.value = appliedGainRegions.value
    .filter(r => !(r.startSec >= startSec && r.endSec <= endSec))
    .map(r => {
      if (r.startSec >= endSec) {
        return {
          ...r,
          startSec: Math.max(0, r.startSec - deleteDuration),
          endSec: Math.max(0, r.endSec - deleteDuration),
        }
      }
      return r
    })

  commitTimelineChange(newSegments, 0, undefined, startSec)
  pulseBackStore.showToast(`Deleted ${(deleteDuration).toFixed(2)}s from timeline`)
}

function onPasteAudio() {
  if (!sharedAudioClipboard.value || !cleanBaseAudioBuffer.value) return
  const ctx = getAudioContext()
  const totalDur = effectiveDuration.value
  const pasteBuf = sharedAudioClipboard.value.buffer
  const pasteSegs = sharedAudioClipboard.value.segments

  pushUndoState()

  const hasSubSelection = (trimEnd.value > 0 && trimEnd.value < totalDur - 0.05) || trimStart.value > 0.05
  const isCursorInsideSelection = hasSubSelection &&
    (currentTime.value >= trimStart.value - 0.05 && currentTime.value <= trimEnd.value + 0.05)

  const shouldReplace = hasSubSelection && isCursorInsideSelection
  const insertAtSec = shouldReplace ? trimStart.value : currentTime.value
  const replaceEndSec = shouldReplace ? trimEnd.value : undefined

  const { newSegments, timeDelta } = spliceTimelineSegments(
    ctx,
    timelineSegments.value,
    pasteBuf,
    insertAtSec,
    replaceEndSec,
    activeTrackTarget.value,
    pasteSegs
  )

  if (replaceEndSec !== undefined) {
    appliedGainRegions.value = appliedGainRegions.value
      .filter(r => !(r.startSec >= insertAtSec && r.endSec <= replaceEndSec))
      .map(r => {
        if (r.startSec >= replaceEndSec) {
          return {
            ...r,
            startSec: Math.max(0, r.startSec + timeDelta),
            endSec: Math.max(0, r.endSec + timeDelta),
          }
        }
        return r
      })
  } else if (timeDelta !== 0) {
    appliedGainRegions.value = appliedGainRegions.value.map(r => {
      if (r.startSec >= insertAtSec) {
        return {
          ...r,
          startSec: Math.max(0, r.startSec + timeDelta),
          endSec: Math.max(0, r.endSec + timeDelta),
        }
      }
      return r
    })
  }

  const newPos = insertAtSec + pasteBuf.duration
  commitTimelineChange(newSegments, 0, undefined, newPos)

  const numSegs = pasteSegs?.length || 1
  const segsLabel = numSegs > 1 ? ` (${numSegs} segments)` : ''
  const actionLabel = shouldReplace ? 'Replaced selection with' : 'Pasted'
  pulseBackStore.showToast(`${actionLabel} ${(pasteBuf.duration).toFixed(2)}s audio${segsLabel}`)
}

function onSplitAt(sec: number) {
  if (!cleanBaseAudioBuffer.value) return
  const dur = effectiveDuration.value
  if (sec <= 0.05 || sec >= dur - 0.05) {
    pulseBackStore.showToast('Cannot split at the very beginning or end of clip')
    return
  }
  pushUndoState()
  const ctx = getAudioContext()
  const newSegments = splitTimelineAt(ctx, timelineSegments.value, sec)
  commitTimelineChange(newSegments, trimStart.value, trimEnd.value, sec)
  pulseBackStore.showToast(`✂ Split clip at ${formatSeconds(sec)} (B)`)
}

function onJoinAt(sec: number) {
  if (!cleanBaseAudioBuffer.value) return
  const currentCount = timelineSegments.value.length
  if (currentCount <= 1) {
    pulseBackStore.showToast('No adjacent clips to join at this boundary')
    return
  }
  const ctx = getAudioContext()
  const newSegments = joinTimelineAt(ctx, timelineSegments.value, sec)
  if (newSegments.length === currentCount) {
    pulseBackStore.showToast('No adjacent clips found at this boundary')
    return
  }
  pushUndoState()
  commitTimelineChange(newSegments, trimStart.value, trimEnd.value, currentTime.value)
  pulseBackStore.showToast(`🔗 Joined audio clips at ${formatSeconds(sec)}`)
}

function joinAtNearestBoundary() {
  const boundaries = segmentBoundaries.value
  if (!boundaries || boundaries.length === 0) {
    pulseBackStore.showToast('No clip boundaries to join')
    return
  }
  let bestB = boundaries[0]
  let minDiff = Math.abs(currentTime.value - bestB)
  for (const b of boundaries) {
    const diff = Math.abs(currentTime.value - b)
    if (diff < minDiff) {
      minDiff = diff
      bestB = b
    }
  }
  onJoinAt(bestB)
}

function jumpCursorToBoundary(direction: 'next' | 'prev') {
  if (!effectiveAudioBuffer.value) return
  const boundaries = segmentBoundaries.value
  const maxDur = effectiveDuration.value
  const targets = Array.from(new Set([0, ...(boundaries || []), maxDur])).sort((a, b) => a - b)
  const current = currentTime.value
  const EPSILON = 0.015

  let target: number | null = null
  if (direction === 'next') {
    for (const t of targets) {
      if (t > current + EPSILON) {
        target = t
        break
      }
    }
    if (target === null) {
      pulseBackStore.showToast(`Already at the end of audio (${formatSeconds(maxDur)})`)
      return
    }
  } else {
    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i]
      if (t < current - EPSILON) {
        target = t
        break
      }
    }
    if (target === null) {
      pulseBackStore.showToast('Already at the start of audio (0:00)')
      return
    }
  }

  currentTime.value = target
  emit('update:currentTime', target)
  syncAudioCurrentTime(target)

  const label = target === 0
    ? '0:00 (Start)'
    : Math.abs(target - maxDur) < EPSILON
      ? `${formatSeconds(target)} (End)`
      : `${formatSeconds(target)} (Boundary)`
  pulseBackStore.showToast(`⏱ Cursor moved to ${label} (Ctrl+${direction === 'next' ? 'Right' : 'Left'})`)
}

function jumpCursorToExtremity(target: 'start' | 'end') {
  if (!effectiveAudioBuffer.value) return
  const maxDur = effectiveDuration.value
  const destination = target === 'start' ? 0 : maxDur

  currentTime.value = destination
  emit('update:currentTime', destination)
  syncAudioCurrentTime(destination)

  const label = target === 'start' ? 'Start boundary (0:00)' : `End boundary (${formatSeconds(maxDur)})`
  pulseBackStore.showToast(`⏱ Cursor moved to ${label}`)
}

function jumpCursorToTrimHandle(handle: 'start' | 'end') {
  if (!effectiveAudioBuffer.value) return
  const destination = handle === 'start' ? trimStart.value : trimEnd.value

  currentTime.value = destination
  emit('update:currentTime', destination)
  syncAudioCurrentTime(destination)

  const handleName = handle === 'start' ? 'In Handle' : 'Out Handle'
  pulseBackStore.showToast(`⏱ Cursor moved to ${handleName} (${formatSeconds(destination)})`)
}

function onPlayFromCursor(sec: number) {
  if (isPlaying.value) {
    stopPreview()
  } else {
    currentTime.value = sec
    syncAudioCurrentTime(sec)
    const end = sec < trimEnd.value ? trimEnd.value : effectiveDuration.value
    startPlayback(sec, end)
  }
}

function onUndo() {
  if (!canUndo.value) return
  const prev = undoStack.value.pop()!
  if (!cleanBaseAudioBuffer.value) return

  redoStack.value.push({
    segments: [...timelineSegments.value],
    cleanBaseBuffer: cleanBaseAudioBuffer.value,
    gainRegions: JSON.parse(JSON.stringify(appliedGainRegions.value)),
    trimStart: trimStart.value,
    trimEnd: trimEnd.value,
    currentTime: currentTime.value,
  })

  appliedGainRegions.value = prev.gainRegions
  commitTimelineChange(prev.segments, prev.trimStart, prev.trimEnd, prev.currentTime)
  pulseBackStore.showToast('Undo audio edit')
}

function onRedo() {
  if (!canRedo.value) return
  const next = redoStack.value.pop()!
  if (!cleanBaseAudioBuffer.value) return

  undoStack.value.push({
    segments: [...timelineSegments.value],
    cleanBaseBuffer: cleanBaseAudioBuffer.value,
    gainRegions: JSON.parse(JSON.stringify(appliedGainRegions.value)),
    trimStart: trimStart.value,
    trimEnd: trimEnd.value,
    currentTime: currentTime.value,
  })

  appliedGainRegions.value = next.gainRegions
  commitTimelineChange(next.segments, next.trimStart, next.trimEnd, next.currentTime)
  pulseBackStore.showToast('Redo audio edit')
}

// Set In & Set Out
function setInToCurrentTime() {
  const t = Math.max(0, Math.min(effectiveDuration.value, currentTime.value))
  let start = t
  let end = trimEnd.value
  if (start > end) {
    end = start
  }
  trimStart.value = start
  trimEnd.value = end
  emit('update:trimStart', start)
  emit('update:trimEnd', end)
  updateActiveGainDisplay()
  emit('change')
  pulseBackStore.showToast(`In point set to ${formatSeconds(start)} (I)`)
}

function setOutToCurrentTime() {
  const t = Math.max(0, Math.min(effectiveDuration.value, currentTime.value))
  let start = trimStart.value
  let end = t
  if (end < start) {
    start = end
  }
  trimStart.value = start
  trimEnd.value = end
  emit('update:trimStart', start)
  emit('update:trimEnd', end)
  updateActiveGainDisplay()
  emit('change')
  pulseBackStore.showToast(`Out point set to ${formatSeconds(end)} (O)`)
}

// Snapping Helpers
function snapNearestHandleToBoundary() {
  const boundaries = segmentBoundaries.value
  const maxDur = effectiveDuration.value
  const targets = (boundaries && boundaries.length > 0)
    ? [0, ...boundaries, maxDur].sort((a, b) => a - b)
    : [0, maxDur]

  if (targets.length <= 1) return

  const inVal = trimStart.value
  const outVal = trimEnd.value

  let bestInTarget = targets[0]
  let minInDist = Infinity
  for (const t of targets) {
    const d = Math.abs(inVal - t)
    if (d < minInDist) {
      minInDist = d
      bestInTarget = t
    }
  }

  let bestOutTarget = targets[targets.length - 1]
  let minOutDist = Infinity
  for (const t of targets) {
    const d = Math.abs(outVal - t)
    if (d < minOutDist) {
      minOutDist = d
      bestOutTarget = t
    }
  }

  const inNeedsSnap = minInDist > 0.005
  const outNeedsSnap = minOutDist > 0.005

  if (inNeedsSnap && (!outNeedsSnap || minInDist <= minOutDist)) {
    trimStart.value = bestInTarget
    if (trimStart.value > outVal) {
      trimEnd.value = trimStart.value
    }
    emit('update:trimStart', trimStart.value)
    emit('update:trimEnd', trimEnd.value)
    updateActiveGainDisplay()
    emit('change')
    pulseBackStore.showToast(`⚡ Snapped In point to ${formatSeconds(bestInTarget)} (S)`)
  } else if (outNeedsSnap) {
    trimEnd.value = bestOutTarget
    if (trimEnd.value < inVal) {
      trimStart.value = trimEnd.value
    }
    emit('update:trimStart', trimStart.value)
    emit('update:trimEnd', trimEnd.value)
    updateActiveGainDisplay()
    emit('change')
    pulseBackStore.showToast(`⚡ Snapped Out point to ${formatSeconds(bestOutTarget)} (S)`)
  } else {
    pulseBackStore.showToast('Both handles are already snapped to clip boundaries')
  }
}

function snapInToNearestBoundary() {
  const boundaries = segmentBoundaries.value
  const maxDur = effectiveDuration.value
  const targets = (boundaries && boundaries.length > 0)
    ? [0, ...boundaries, maxDur].sort((a, b) => a - b)
    : [0, maxDur]

  const inVal = trimStart.value
  const outVal = trimEnd.value
  let bestTarget = targets[0]
  let minDist = Infinity
  for (const t of targets) {
    const d = Math.abs(inVal - t)
    if (d < minDist) {
      minDist = d
      bestTarget = t
    }
  }

  trimStart.value = bestTarget
  if (trimStart.value > outVal) {
    trimEnd.value = trimStart.value
  }
  emit('update:trimStart', trimStart.value)
  emit('update:trimEnd', trimEnd.value)
  updateActiveGainDisplay()
  emit('change')
  pulseBackStore.showToast(`⚡ Snapped In point to ${formatSeconds(bestTarget)} (Shift+I)`)
}

function snapOutToNearestBoundary() {
  const boundaries = segmentBoundaries.value
  const maxDur = effectiveDuration.value
  const targets = (boundaries && boundaries.length > 0)
    ? [0, ...boundaries, maxDur].sort((a, b) => a - b)
    : [0, maxDur]

  const inVal = trimStart.value
  const outVal = trimEnd.value
  let bestTarget = targets[targets.length - 1]
  let minDist = Infinity
  for (const t of targets) {
    const d = Math.abs(outVal - t)
    if (d < minDist) {
      minDist = d
      bestTarget = t
    }
  }

  trimEnd.value = bestTarget
  if (trimEnd.value < inVal) {
    trimStart.value = trimEnd.value
  }
  emit('update:trimStart', trimStart.value)
  emit('update:trimEnd', trimEnd.value)
  updateActiveGainDisplay()
  emit('change')
  pulseBackStore.showToast(`⚡ Snapped Out point to ${formatSeconds(bestTarget)} (Shift+O)`)
}

function snapSelectionToCurrentClip() {
  const boundaries = segmentBoundaries.value
  const maxDur = effectiveDuration.value
  const targets = (boundaries && boundaries.length > 0)
    ? [0, ...boundaries, maxDur].sort((a, b) => a - b)
    : [0, maxDur]

  const playhead = currentTime.value
  let start = 0
  let end = maxDur

  for (let i = 0; i < targets.length - 1; i++) {
    const bStart = targets[i]
    const bEnd = targets[i + 1]
    if (playhead >= bStart - 0.01 && playhead <= bEnd + 0.01) {
      start = bStart
      end = bEnd
      break
    }
  }

  trimStart.value = start
  trimEnd.value = end
  emit('update:trimStart', start)
  emit('update:trimEnd', end)
  updateActiveGainDisplay()
  emit('change')
  pulseBackStore.showToast(`⚡ Snapped selection to clip (${formatSeconds(start)} ➔ ${formatSeconds(end)}) (Shift+S)`)
}

// Track Toggling (Dual Tracks)
function toggleMicTrack() {
  includeMic.value = !includeMic.value
  updateTrackVolumes()
  emit('change')
}

function toggleInputTrack() {
  includeInput.value = !includeInput.value
  updateTrackVolumes()
  emit('change')
}

// Playback Implementation
function playTrimmedOnly() {
  if (isPlaying.value) {
    stopPreview()
    return
  }
  startPlayback(trimStart.value, trimEnd.value)
}

function togglePlayPreview() {
  if (isPlaying.value) {
    stopPreview()
    emit('change')
  } else {
    const startFrom =
      currentTime.value >= trimEnd.value || currentTime.value < trimStart.value
        ? trimStart.value
        : currentTime.value
    startPlayback(startFrom, trimEnd.value)
  }
}

function onStopBtnClick() {
  stopPreview()
  currentTime.value = trimStart.value
  emit('update:currentTime', trimStart.value)
  syncAudioCurrentTime(trimStart.value)
  emit('change')
}

async function startPlayback(offsetSec: number, endSec: number) {
  if (!effectiveAudioBuffer.value) return

  if (!isDualTrackActive.value) {
    if (!mainPreviewUrl.value) updatePreviewUrls()
    const mainEl = mainAudioElRef.value
    if (!mainEl) return
    playbackEndSec = endSec
    mainEl.currentTime = offsetSec
    updateTrackVolumes()
    currentTime.value = offsetSec
    emit('update:currentTime', offsetSec)
    try {
      await mainEl.play()
      isPlaying.value = true
      updatePlaybackAnimation()
    } catch (err) {
      console.error('Audio play error:', err)
    }
    return
  }

  const micEl = micAudioElRef.value
  const inputEl = inputAudioElRef.value

  if (!micPreviewUrl.value) {
    updatePreviewUrls()
  }

  playbackEndSec = endSec
  if (micEl) micEl.currentTime = offsetSec
  if (hasDualChannels.value && inputEl) {
    inputEl.currentTime = offsetSec
  }
  updateTrackVolumes()
  currentTime.value = offsetSec
  emit('update:currentTime', offsetSec)

  try {
    const playPromises: Promise<void>[] = []
    if (micEl && (includeMic.value || !hasDualChannels.value)) {
      playPromises.push(micEl.play())
    }
    if (hasDualChannels.value && inputEl && includeInput.value) {
      playPromises.push(inputEl.play())
    }
    if (playPromises.length === 0 && micEl) {
      playPromises.push(micEl.play())
    }
    await Promise.all(playPromises)
    isPlaying.value = true
    updatePlaybackAnimation()
  } catch (err) {
    console.error('Audio play error:', err)
  }
}

function stopPreview() {
  if (mainAudioElRef.value) {
    mainAudioElRef.value.pause()
  }
  if (micAudioElRef.value) {
    micAudioElRef.value.pause()
  }
  if (inputAudioElRef.value) {
    inputAudioElRef.value.pause()
  }
  if (playbackAnimationId) {
    cancelAnimationFrame(playbackAnimationId)
    playbackAnimationId = null
  }
  isPlaying.value = false
}

function updatePlaybackAnimation() {
  if (isScrubbing) return
  if (!isPlaying.value) return

  const masterEl = !isDualTrackActive.value
    ? mainAudioElRef.value
    : (hasDualChannels.value && !includeMic.value && includeInput.value && inputAudioElRef.value
      ? inputAudioElRef.value
      : micAudioElRef.value)

  if (!masterEl) return

  currentTime.value = masterEl.currentTime
  emit('update:currentTime', currentTime.value)

  if (currentTime.value >= playbackEndSec || masterEl.ended) {
    stopPreview()
    currentTime.value = trimStart.value
    emit('update:currentTime', trimStart.value)
    syncAudioCurrentTime(trimStart.value)
    return
  }

  playbackAnimationId = requestAnimationFrame(updatePlaybackAnimation)
}

function onAudioEnded() {
  if (isScrubbing) return
  stopPreview()
  currentTime.value = trimStart.value
  emit('update:currentTime', trimStart.value)
  syncAudioCurrentTime(trimStart.value)
  emit('change')
}

function onAudioTimeUpdate() {
  if (isScrubbing) return
  const masterEl = !isDualTrackActive.value ? mainAudioElRef.value : micAudioElRef.value
  if (!isPlaying.value || !masterEl) return
  if (masterEl.currentTime >= playbackEndSec || masterEl.ended) {
    stopPreview()
    currentTime.value = trimStart.value
    emit('update:currentTime', trimStart.value)
    syncAudioCurrentTime(trimStart.value)
  }
}

function onAudioMetadataLoaded() {
  if (!isScrubbing) {
    syncAudioCurrentTime(currentTime.value)
  }
}

// Scrubbing & Snippets
let isScrubbing = false
let wasPlayingBeforeScrub = false
let scrubSourceNode: AudioBufferSourceNode | null = null
let scrubGainNode: GainNode | null = null
let lastScrubPlayTime = 0

function stopScrubSnippet() {
  if (scrubSourceNode) {
    try {
      scrubSourceNode.stop()
      scrubSourceNode.disconnect()
    } catch { }
    scrubSourceNode = null
  }
  if (scrubGainNode) {
    try {
      scrubGainNode.disconnect()
    } catch { }
    scrubGainNode = null
  }
}

function playScrubSnippet(sec: number) {
  const buf = effectiveAudioBuffer.value
  if (!buf) return
  const now = performance.now()
  if (now - lastScrubPlayTime < 45) return
  lastScrubPlayTime = now

  const ctx = getAudioContext()
  stopScrubSnippet()

  const duration = 0.08
  const startSec = Math.max(0, Math.min(buf.duration - 0.02, sec))
  const snippetLen = Math.min(duration, buf.duration - startSec)
  if (snippetLen <= 0) return

  const masterVol = (props.volume ?? 100) / 100
  const bothActive = isDualTrackActive.value && includeMic.value && includeInput.value && hasDualChannels.value
  const factor = bothActive ? 0.75 : 1.0

  const sampleRate = buf.sampleRate
  const sampleCount = Math.floor(snippetLen * sampleRate)
  if (sampleCount <= 0) return

  const startSample = Math.floor(startSec * sampleRate)
  const snippetBuffer = ctx.createBuffer(1, sampleCount, sampleRate)
  const channelData = snippetBuffer.getChannelData(0)

  if (isDualTrackActive.value) {
    const micData = includeMic.value ? buf.getChannelData(0) : null
    const inputData = hasDualChannels.value && includeInput.value && buf.numberOfChannels >= 2
      ? buf.getChannelData(1)
      : null

    for (let i = 0; i < sampleCount; i++) {
      const idx = startSample + i
      if (idx >= buf.length) break
      let s = 0
      if (micData) s += micData[idx] * factor
      if (inputData) s += inputData[idx] * factor
      channelData[i] = s
    }
  } else {
    const ch0 = buf.getChannelData(0)
    const ch1 = buf.numberOfChannels >= 2 ? buf.getChannelData(1) : null
    for (let i = 0; i < sampleCount; i++) {
      const idx = startSample + i
      if (idx >= buf.length) break
      channelData[i] = ch1 ? (ch0[idx] + ch1[idx]) * 0.5 : ch0[idx]
    }
  }

  const fadeSamples = Math.min(Math.floor(sampleRate * 0.006), Math.floor(sampleCount / 4))
  for (let i = 0; i < fadeSamples; i++) {
    const ramp = i / fadeSamples
    channelData[i] *= ramp
    channelData[sampleCount - 1 - i] *= ramp
  }

  const source = ctx.createBufferSource()
  source.buffer = snippetBuffer

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(masterVol, ctx.currentTime)

  source.connect(gain)
  gain.connect(ctx.destination)

  scrubSourceNode = source
  scrubGainNode = gain

  source.onended = () => {
    if (scrubSourceNode === source) {
      scrubSourceNode = null
      scrubGainNode = null
    }
  }

  source.start(0)
}

function onScrubStart(_sec: number) {
  isScrubbing = true
  wasPlayingBeforeScrub = isPlaying.value
  stopPreview()
}

function onScrubMove(sec: number) {
  playScrubSnippet(sec)
}

function onScrubEnd(sec: number) {
  isScrubbing = false
  stopScrubSnippet()
  syncAudioCurrentTime(sec)
  const resume = wasPlayingBeforeScrub
  wasPlayingBeforeScrub = false
  emit('change')
  if (resume) {
    const startFrom =
      currentTime.value >= trimEnd.value || currentTime.value < trimStart.value
        ? trimStart.value
        : currentTime.value
    startPlayback(startFrom, trimEnd.value)
  }
}

function onTrimChange(payload: { start: number; end: number; handle?: 'start' | 'end'; }) {
  if (isPlaying.value) {
    stopPreview()
  }
  trimStart.value = payload.start
  trimEnd.value = payload.end
  emit('update:trimStart', payload.start)
  emit('update:trimEnd', payload.end)
  if (payload.handle !== 'end') {
    currentTime.value = payload.start
    emit('update:currentTime', payload.start)
    syncAudioCurrentTime(payload.start)
  } else if (currentTime.value > payload.end) {
    currentTime.value = payload.start
    emit('update:currentTime', payload.start)
    syncAudioCurrentTime(payload.start)
  }
  updateActiveGainDisplay()
}

function onTrimEndChange() {
  updateActiveGainDisplay()
  emit('change')
}

// Keyboard Event Handler
function onKeyDown(e: KeyboardEvent) {
  const activeEl = document.activeElement
  const tagName = activeEl?.tagName.toLowerCase()
  const isEditable = activeEl instanceof HTMLElement && activeEl.isContentEditable
  if (tagName === 'input' || tagName === 'textarea' || isEditable) {
    return
  }

  if (e.key === 'Home') {
    e.preventDefault()
    if (e.shiftKey) {
      jumpCursorToExtremity('start')
    } else {
      jumpCursorToTrimHandle('start')
    }
    return
  } else if (e.key === 'End') {
    e.preventDefault()
    if (e.shiftKey) {
      jumpCursorToExtremity('end')
    } else {
      jumpCursorToTrimHandle('end')
    }
    return
  } else if (e.key === 'PageDown') {
    e.preventDefault()
    jumpCursorToBoundary('next')
    return
  } else if (e.key === 'PageUp') {
    e.preventDefault()
    jumpCursorToBoundary('prev')
    return
  }

  const isCtrl = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()

  // Move cursor between clip boundaries (Ctrl+Arrow or Alt+Arrow)
  if (isCtrl || e.altKey) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      jumpCursorToExtremity('start')
      return
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      jumpCursorToExtremity('end')
      return
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (e.shiftKey) {
        jumpCursorToExtremity('end')
      } else {
        jumpCursorToBoundary('next')
      }
      return
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (e.shiftKey) {
        jumpCursorToExtremity('start')
      } else {
        jumpCursorToBoundary('prev')
      }
      return
    } else if (e.key === 'Home') {
      e.preventDefault()
      jumpCursorToExtremity('start')
      return
    } else if (e.key === 'End') {
      e.preventDefault()
      jumpCursorToExtremity('end')
      return
    }
  }

  if (!isCtrl) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (canCut.value) {
        e.preventDefault()
        onDeleteAudio()
      }
    } else if (key === 'i') {
      e.preventDefault()
      if (e.shiftKey) {
        snapInToNearestBoundary()
      } else {
        setInToCurrentTime()
      }
    } else if (key === 'o') {
      e.preventDefault()
      if (e.shiftKey) {
        snapOutToNearestBoundary()
      } else {
        setOutToCurrentTime()
      }
    } else if (key === 's') {
      e.preventDefault()
      if (e.shiftKey) {
        snapSelectionToCurrentClip()
      } else {
        snapNearestHandleToBoundary()
      }
    } else if (key === 'b') {
      e.preventDefault()
      onSplitAt(currentTime.value)
    } else if (key === 'j') {
      e.preventDefault()
      joinAtNearestBoundary()
    }
    return
  }

  if (key === 'b' || key === 'k') {
    e.preventDefault()
    onSplitAt(currentTime.value)
  } else if (key === 'j') {
    e.preventDefault()
    joinAtNearestBoundary()
  } else if (key === 'a') {
    e.preventDefault()
    resetSelectionToExtents()
  } else if (key === 'c' && !e.shiftKey) {
    if (canCopy.value) {
      e.preventDefault()
      onCopyAudio()
    }
  } else if (key === 'x' && !e.shiftKey) {
    if (canCut.value) {
      e.preventDefault()
      onCutAudio()
    }
  } else if (key === 'v' && !e.shiftKey) {
    if (canPaste.value) {
      e.preventDefault()
      onPasteAudio()
    }
  } else if (key === 'z') {
    if (e.shiftKey) {
      if (canRedo.value) {
        e.preventDefault()
        onRedo()
      }
    } else {
      if (canUndo.value) {
        e.preventDefault()
        onUndo()
      }
    }
  } else if (key === 'y' && !e.shiftKey) {
    if (canRedo.value) {
      e.preventDefault()
      onRedo()
    }
  }
}

// Window Resize Handling
function onWindowResize() {
  isResizing.value = true
  requestAnimationFrame(updateSegmentIndicator)
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    isResizing.value = false
    updateSegmentIndicator()
  }, 100)
}

// Audio Data Loader
async function loadAudioData(source: AudioBuffer | Blob, savedBoundaries?: number[]) {
  try {
    const ctx = getAudioContext()
    let decoded: AudioBuffer

    if (source instanceof Blob) {
      const arrayBuffer = await source.arrayBuffer()
      decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
    } else {
      decoded = source
    }

    cleanBaseAudioBuffer.value = decoded
    if (!originalAudioBuffer.value) {
      originalAudioBuffer.value = decoded
    }

    if (savedBoundaries && savedBoundaries.length > 0) {
      let segs = createInitialSegments(decoded)
      for (const b of savedBoundaries) {
        if (b > 0.01 && b < decoded.duration - 0.01) {
          segs = splitTimelineAt(ctx, segs, b)
        }
      }
      timelineSegments.value = segs
    } else {
      timelineSegments.value = createInitialSegments(decoded)
    }

    undoStack.value = []
    redoStack.value = []
    hasDualChannels.value = decoded.numberOfChannels >= 2

    const hasDual = isDualTrackActive.value
    effectiveAudioBuffer.value = applyGainToAudioBuffer(
      ctx,
      decoded,
      hasDual ? [globalMicGain.value, globalInputGain.value] : globalSingleGain.value,
      appliedGainRegions.value
    )
    emit('update:audioBuffer', effectiveAudioBuffer.value)

    const dur = effectiveAudioBuffer.value.duration
    if (props.trimEnd > 0) {
      trimEnd.value = Math.min(dur, props.trimEnd)
    } else {
      trimEnd.value = dur
    }
    trimStart.value = Math.max(0, Math.min(props.trimStart || 0, trimEnd.value))
    currentTime.value = Math.max(trimStart.value, Math.min(trimEnd.value, props.currentTime || trimStart.value))

    emit('update:trimStart', trimStart.value)
    emit('update:trimEnd', trimEnd.value)
    emit('update:currentTime', currentTime.value)

    updateActiveGainDisplay()
    updatePreviewUrls()
    updateTrackVolumes()
    syncAudioCurrentTime(currentTime.value)
  } catch (err) {
    console.error('Failed to load audio for WaveformEditor:', err)
  }
}

// Watchers
watch(
  [() => props.audioBuffer, () => props.blob, () => props.clipId],
  async ([newBuf, newBlob, newClipId], [_oldBuf, _oldBlob, oldClipId]) => {
    // If switching to a different clip, reset our tracking so it loads freshly
    if (newClipId && oldClipId && newClipId !== oldClipId) {
      lastEmittedBlob = null
      lastEmittedBuffer = null
    }

    // If this blob or buffer was generated internally by this editor instance, ignore the echo prop update
    if (newBlob && newBlob === lastEmittedBlob) {
      return
    }
    if (newBuf && newBuf === lastEmittedBuffer) {
      return
    }

    stopPreview()
    stopScrubSnippet()
    if (newBlob) {
      await loadAudioData(newBlob, props.segmentBoundaries)
    } else if (newBuf) {
      await loadAudioData(newBuf, props.segmentBoundaries)
    } else {
      cleanBaseAudioBuffer.value = null
      effectiveAudioBuffer.value = null
      originalAudioBuffer.value = null
      clearPreviewUrls()
    }
  },
  { immediate: true }
)

watch(
  () => props.volume,
  () => {
    updateTrackVolumes()
  }
)

watch(
  () => [props.trimStart, props.trimEnd],
  ([newStart, newEnd]) => {
    if (newStart !== undefined && newStart !== trimStart.value) {
      trimStart.value = newStart
    }
    if (newEnd !== undefined && newEnd !== trimEnd.value) {
      trimEnd.value = newEnd
    }
    updateActiveGainDisplay()
  }
)

watch(trimStart, (newStart, oldStart) => {
  if (oldStart !== undefined && newStart !== oldStart) {
    currentTime.value = newStart
    emit('update:currentTime', newStart)
    syncAudioCurrentTime(newStart)
  }
})

watch(activeTrackTarget, () => {
  nextTick(updateSegmentIndicator)
})

watch(isDualTrackActive, active => {
  if (!active) {
    activeTrackTarget.value = 'both'
  }
  nextTick(() => {
    updateSegmentIndicator()
    if (active) {
      attachSegmentedResizeObserver()
    }
  })
})

// Helper for Exporting Trimmed Audio
async function getTrimmedAudioBlob(
  format: 'mp3' | 'wav' | 'ogg' = 'mp3'
): Promise<{ blob: Blob; duration: number; extension: string; segments?: SoundSegment[]; } | null> {
  const buf = effectiveAudioBuffer.value
  if (!buf) return null

  const sampleRate = buf.sampleRate
  const startSec = Math.max(0, trimStart.value)
  const endSec = Math.min(buf.duration, trimEnd.value > 0 ? trimEnd.value : buf.duration)
  const startSample = Math.max(0, Math.floor(startSec * sampleRate))
  const endSample = Math.min(buf.length, Math.floor(endSec * sampleRate))
  const length = Math.max(0, endSample - startSample)

  if (length <= 0) return null

  const hasDual = isDualTrackActive.value
  const hasSecondChannel = buf.numberOfChannels >= 2
  const slicedSamples = new Float32Array(length)
  const ch0 = buf.getChannelData(0).subarray(startSample, endSample)
  const ch1 = hasSecondChannel ? buf.getChannelData(1).subarray(startSample, endSample) : null

  if (hasDual) {
    if (includeMic.value && (!hasSecondChannel || !includeInput.value || !ch1)) {
      slicedSamples.set(ch0)
    } else if (!includeMic.value && hasSecondChannel && includeInput.value && ch1) {
      slicedSamples.set(ch1)
    } else if (hasSecondChannel && ch1 && includeMic.value && includeInput.value) {
      for (let i = 0; i < length; i++) {
        slicedSamples[i] = Math.max(-1, Math.min(1, (ch0[i] + ch1[i]) * 0.75))
      }
    } else {
      slicedSamples.set(ch0)
    }
  } else {
    if (hasSecondChannel && ch1) {
      for (let i = 0; i < length; i++) {
        slicedSamples[i] = (ch0[i] + ch1[i]) * 0.5
      }
    } else {
      slicedSamples.set(ch0)
    }
  }

  const duration = length / sampleRate
  let blob: Blob
  let extension: string

  if (format === 'mp3') {
    blob = await encodeMP3(slicedSamples, sampleRate, 192)
    extension = 'mp3'
  } else if (format === 'ogg') {
    blob = await encodeOGG(slicedSamples, sampleRate, 3)
    extension = 'ogg'
  } else {
    if (hasDual && ch1 && includeInput.value && includeMic.value) {
      blob = encodeWAV(ch0, sampleRate, ch1)
    } else if (!hasDual && ch1) {
      blob = encodeWAV(ch0, sampleRate, ch1)
    } else {
      blob = encodeWAV(slicedSamples, sampleRate)
    }
    extension = 'wav'
  }

  const segments = calculateSoundSegments(
    segmentBoundaries.value,
    startSec,
    endSec,
    duration
  )

  return { blob, duration, extension, segments }
}

// Lifecycle Hooks
onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onWindowResize)
  nextTick(() => {
    updateSegmentIndicator()
    if (isDualTrackActive.value) {
      attachSegmentedResizeObserver()
    }
  })
})

onUnmounted(() => {
  stopPreview()
  stopScrubSnippet()
  clearPreviewUrls()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onWindowResize)
  if (resizeTimer) clearTimeout(resizeTimer)
  segmentedResizeObserver?.disconnect()
})

function formatSeconds(secs: number): string {
  if (Number.isNaN(secs) || secs < 0) secs = 0
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  const ms = Math.floor((secs % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

// Expose public API for parents
defineExpose({
  getTrimmedAudioBlob,
  getTrimmedSegments: () => {
    const buf = effectiveAudioBuffer.value
    if (!buf) return undefined
    const startSec = Math.max(0, trimStart.value)
    const endSec = Math.min(buf.duration, trimEnd.value > 0 ? trimEnd.value : buf.duration)
    const dur = Math.max(0, endSec - startSec)
    return calculateSoundSegments(segmentBoundaries.value, startSec, endSec, dur)
  },
  getEffectiveAudioBuffer: () => effectiveAudioBuffer.value,
  getCleanAudioBuffer: () => cleanBaseAudioBuffer.value,
  hasAudioBuffer: computed(() => !!effectiveAudioBuffer.value),
  resetTrim,
  resetSelectionToExtents,
  stopPreview,
  togglePlayPreview,
  jumpCursorToBoundary,
  jumpCursorToExtremity,
  jumpCursorToTrimHandle,
})
</script>

<style scoped>
.waveform-editor-root {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 100%;
}

/* Waveform Container */
.waveform-container {
  --slide-duration: 0.28s;
  --border-radius: 8px;
  --speaker-sound-in-duration: 0.98s;
  --speaker-sound-out-duration: 0.68s;
  --mic-sound-in-duration: 0.35s;
  --mic-sound-out-duration: 0.3s;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: min-content;
  position: relative;
}

.waveform-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: #e4e4e7;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.play-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #10b981;
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.play-btn:hover:not(:disabled) {
  background: #059669;
  transform: scale(1.05);
}

.play-btn:focus-visible {
  outline: 2px solid var(--active-color, #10b981);
  outline-offset: 3px;
  transform: scale(1.05);
}

.play-btn.playing {
  background: #f59e0b;
}

.play-btn.playing:focus-visible {
  outline-color: #f59e0b;
}

.play-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.stop-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #27272a;
  border: 1px solid #3f3f46;
  color: #d4d4d8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.stop-btn:hover:not(:disabled) {
  background: #3f3f46;
  color: white;
}

.stop-btn:focus-visible {
  outline: 2px solid var(--active-color, #38bdf8);
  outline-offset: 3px;
  background: #3f3f46;
  color: white;
}

.stop-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.time-readout {
  font-family: monospace;
  font-size: 0.85rem;
  color: #a1a1aa;
  min-width: 100px;
}

.time-readout.clickable {
  cursor: pointer;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  transition: all 0.15s ease;
  user-select: none;
}

.time-readout.clickable:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #38bdf8;
}

.time-readout.clickable:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

.time-readout.clickable:active {
  transform: scale(0.96);
  background: rgba(255, 255, 255, 0.14);
}

.waveform-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.76rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Audio Tracks Segmented Selector Bar */
.audio-tracks-bar {
  display: flex;
  align-items: flex-end;
  gap: 0.65rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.track-selector-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.track-selector-label {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #71717a;
  line-height: 1;
  padding-left: 2px;
}

.track-segmented-group {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
  width: 100%;
  transition: border-color var(--slide-duration, 0.28s) cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow var(--slide-duration, 0.28s) cubic-bezier(0.4, 0, 0.2, 1);
}

.track-segmented-group.is-resizing .segment-indicator {
  transition: none !important;
}

.segment-indicator {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 4px;
  pointer-events: none;
  z-index: 1;
  box-sizing: border-box;
  transition: transform var(--slide-duration, 0.28s) cubic-bezier(0.4, 0, 0.2, 1),
    width var(--slide-duration, 0.28s) cubic-bezier(0.4, 0, 0.2, 1),
    height var(--slide-duration, 0.28s) cubic-bezier(0.4, 0, 0.2, 1),
    background-color var(--slide-duration, 0.28s) cubic-bezier(0.4, 0, 0.2, 1),
    border-color var(--slide-duration, 0.28s) cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow var(--slide-duration, 0.28s) cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.15s ease;
}

.track-segmented-group.target-both {
  border-color: #3f3f46;
}

.track-segmented-group.target-both .segment-indicator {
  background: #3f3f46;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.track-segmented-group.target-mic {
  border-color: rgba(56, 189, 248, 0.4);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.1);
}

.track-segmented-group.target-mic .segment-indicator {
  background: rgba(56, 189, 248, 0.22);
  border: 1px solid rgba(56, 189, 248, 0.55);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.25), 0 1px 2px rgba(0, 0, 0, 0.3);
}

.track-segmented-group.target-input {
  border-color: rgba(52, 211, 153, 0.4);
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.1);
}

.track-segmented-group.target-input .segment-indicator {
  background: rgba(52, 211, 153, 0.22);
  border: 1px solid rgba(52, 211, 153, 0.55);
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.25), 0 1px 2px rgba(0, 0, 0, 0.3);
}

.segment-btn {
  position: relative;
  z-index: 2;
  flex: 1 1 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0.25rem 0.6rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #a1a1aa;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: color var(--slide-duration, 0.28s) cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.12s ease;
}

.segment-btn:hover:not(.active) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.04);
}

.segment-btn:active {
  transform: scale(0.96);
}

.segment-btn.active {
  color: #ffffff;
}

.segment-btn.mic-segment.active {
  color: #38bdf8;
}

.segment-btn.input-segment.active {
  color: #34d399;
}

/* Waveform Body & Left Track Controls Gutter */
.waveform-body-row {
  display: flex;
  align-items: flex-start;
  width: 100%;
}

.waveform-track-gutter {
  display: flex;
  flex-direction: column;
  height: 140px;
  width: 36px;
  flex-shrink: 0;
  background: #0f0f11;
  border: 1px solid #27272a;
  border-radius: var(--border-radius) 0 0 var(--border-radius);
  overflow: hidden;
  box-sizing: border-box;
}

.track-gutter-slot {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.track-gutter-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.12);
  width: 100%;
  flex-shrink: 0;
}

.track-icon-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid #3f3f46;
  background: #18181b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  color: #a1a1aa;
  position: relative;
  overflow: hidden;
}

.track-icon-btn:hover {
  transform: scale(1.08);
}

.track-icon-btn:active {
  transform: scale(0.94);
}

.track-icon-btn:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.track-icon-btn>svg {
  transition: stroke 300ms ease-in-out, color 300ms ease-in-out;
}

.track-icon-btn::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 2px;
  margin-top: -1px;
  margin-left: -12px;
  border-radius: 1px;
  transform: translate(22px, -22px) rotate(135deg);
  background: var(--text-color, #a1a1aa);
  pointer-events: none;
  transition:
    transform 300ms ease-in-out,
    background 300ms ease-in-out 300ms;
}

.track-icon-btn.muted::after {
  background: #ef4444;
  /* sets the color of the slash */
  transform: translate(0, 0) rotate(135deg);
}

.mic-icon-btn.active {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
  border-color: rgba(56, 189, 248, 0.5);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
}

.mic-icon-btn.active:hover {
  background: rgba(56, 189, 248, 0.25);
  border-color: #38bdf8;
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.35);
}

.mic-cradle {
  transform-box: view-box;
  transform-origin: 12px 19px;
}

.mic-capsule {
  transform-box: view-box;
  transform-origin: 12px 12px;
}

.mic-icon-btn.active .mic-cradle {
  animation: mic-cradle-release var(--mic-sound-in-duration) cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.mic-icon-btn.muted .mic-cradle {
  animation: mic-cradle-clamp var(--mic-sound-out-duration) ease-in-out forwards;
}

.mic-icon-btn.active .mic-capsule {
  animation: mic-capsule-rise var(--mic-sound-in-duration) cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.mic-icon-btn.muted .mic-capsule {
  animation: mic-capsule-dip var(--mic-sound-out-duration) ease-in-out forwards;
}

@keyframes mic-cradle-clamp {
  0% {
    transform: scaleX(1);
  }

  100% {
    transform: scaleX(0.7);
  }
}

@keyframes mic-cradle-release {
  0% {
    transform: scaleX(0.7);
  }

  70% {
    transform: scaleX(1.12);
  }

  100% {
    transform: scaleX(1);
  }
}

@keyframes mic-capsule-dip {
  0% {
    transform: translateY(0) scale(1);
  }

  100% {
    transform: translateY(1.5px) scale(0.95);
  }
}

@keyframes mic-capsule-rise {
  0% {
    transform: translateY(1.5px) scale(0.95);
  }

  70% {
    transform: translateY(-0.8px) scale(1.02);
  }

  100% {
    transform: translateY(0) scale(1);
  }
}

.input-icon-btn.active {
  color: #34d399;
  background: rgba(52, 211, 153, 0.15);
  border-color: rgba(52, 211, 153, 0.5);
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.2);
}

.input-icon-btn.active:hover {
  background: rgba(52, 211, 153, 0.25);
  border-color: #34d399;
  box-shadow: 0 0 14px rgba(52, 211, 153, 0.35);
}

.speaker-sound-waves {
  transform-box: view-box;
  transform-origin: 11px 12px;
}

.input-icon-btn.active .speaker-sound-waves {
  animation: speaker-waves-unmute var(--speaker-sound-in-duration) cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.input-icon-btn.muted .speaker-sound-waves {
  animation: speaker-waves-mute var(--speaker-sound-out-duration) ease-in forwards;
}

@keyframes speaker-waves-mute {
  0% {
    opacity: 1;
    transform: scale(1) translateX(0);
  }

  50% {
    opacity: 0.5;
    transform: scale(1) translateX(5px);
  }

  100% {
    opacity: 0;
    transform: scale(2) translateX(15px);
  }
}

@keyframes speaker-waves-unmute {
  0% {
    opacity: 0;
    transform: scale(0.1) translateX(-12px);
  }

  100% {
    opacity: 1;
    transform: scale(1) translateX(0);
  }
}

.track-icon-btn.muted {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.3);
  opacity: 0.6;
}

.track-icon-btn.muted:hover {
  opacity: 1;
  background: rgba(239, 68, 68, 0.18);
  border-color: #ef4444;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.25);
}

.waveform-graph-main {
  flex: 1;
  min-width: 0;
}

/* Loading & Error States */
.waveform-loading-state,
.waveform-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.25rem;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.82rem;
  text-align: center;
  width: 100%;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 8px;
  box-sizing: border-box;
}

.waveform-progress-bar-bg {
  width: 60%;
  max-width: 220px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.waveform-progress-bar-fill {
  height: 100%;
  background: #10b981;
  transition: width 0.2s ease;
}

.waveform-retry-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.35rem;
  color: #fff;
  font-size: 0.78rem;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.waveform-retry-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.waveform-retry-btn:focus-visible {
  outline: 2px solid var(--active-color, #38bdf8);
  outline-offset: 2px;
}
</style>
