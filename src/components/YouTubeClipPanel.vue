<template>
  <div class="clip-panel-root">
    <div class="clip-panel-body">
      <!-- Section 1: Audio Waveform & Studio Trimmer -->
      <div class="waveform-section">
        <div class="waveform-header">
          <div class="playback-controls">
            <button type="button"
                    class="play-btn"
                    :class="{ playing: isPlayingPreview }"
                    :disabled="!effectiveAudioBuffer || isLoadingAudio"
                    @click="togglePlayPreview"
                    title="Preview trimmed region">
              <svg v-if="!isPlayingPreview"
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
            <button type="button"
                    class="stop-btn"
                    :disabled="!effectiveAudioBuffer || isLoadingAudio"
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
            <span class="time-readout clickable"
                  role="button"
                  tabindex="0"
                  title="Click to reset selection to full waveform extents"
                  @click="resetSelectionToExtents"
                  @keydown.enter.prevent="resetSelectionToExtents"
                  @keydown.space.prevent="resetSelectionToExtents">
              {{ formatSeconds(relativeCurrentTime) }} / {{ formatSeconds(trimmedDuration) }}
            </span>
          </div>

          <div class="waveform-title">
            <svg class="w-4 h-4 text-emerald-400"
                 viewBox="0 0 24 24"
                 fill="none"
                 stroke="currentColor"
                 stroke-width="2">
              <path d="M2 10v4M6 6v12M10 3v18M14 8v8M18 5v14M22 10v4" />
            </svg>
            <span>Audio Waveform Trimmer</span>
          </div>
        </div>

        <!-- Waveform Graph / Loading Box -->
        <div class="waveform-graph-box">
          <!-- Loading State -->
          <div v-if="isLoadingAudio"
               class="waveform-loading-state">
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
            <span>{{ audioLoadStatus || 'Downloading YouTube audio for waveform...' }}</span>
            <div class="waveform-progress-bar-bg"
                 v-if="audioLoadProgress > 0">
              <div class="waveform-progress-bar-fill"
                   :style="{ width: `${audioLoadProgress}%` }"></div>
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="audioLoadError && !effectiveAudioBuffer"
               class="waveform-error-state">
            <span>{{ audioLoadError }}</span>
            <button type="button"
                    class="waveform-retry-btn"
                    @click="$emit('retryAudio')">
              Retry
            </button>
          </div>

          <!-- Waveform Graph Component -->
          <WaveformGraph v-else
                         :audio-buffer="effectiveAudioBuffer"
                         :duration="currentTotalDuration"
                         v-model:current-time="currentTime"
                         v-model:trim-start="startTime"
                         v-model:trim-end="endTime"
                         :is-playing="isPlayingPreview"
                         :height="76"
                         :show-trim-handles="true"
                         :show-trim-labels="true"
                         :show-time-ticks="true"
                         :show-playhead="true"
                         @scrub-start="onScrubStart"
                         @scrub-move="onScrubMove"
                         @scrub-end="onScrubEnd"
                         @trim-change="onTrimChange"
                         @trim-end-change="onTrimEndChange" />
        </div>

        <TrimSummaryBar v-model:trim-start="startTime"
                        v-model:trim-end="endTime"
                        :duration="currentTotalDuration"
                        :is-playing="isPlayingPreview"
                        :show-trim-to-selection="true"
                        :can-trim-to-selection="canTrimToSelection"
                        :gain="gainMultiplier"
                        :has-partial-gains="appliedGainRegions.length > 0"
                        :gain-regions="appliedGainRegions"
                        @update:gain="onGainMultiplierChange"
                        @change-gain="onGainChange"
                        @auto-level="onAutoLevel"
                        @reset-gain="onResetGain"
                        @select-region="onSelectGainRegion"
                        @delete-region="onDeleteGainRegion"
                        @clearAllGainRegions="onClearAllGainRegions"
                        @resetAllGainRegions="onResetAllGainRegions"
                        @resetStart="resetTrimStart"
                        @resetEnd="resetTrimEnd"
                        @resetSelection="resetSelectionToExtents"
                        @reset="resetTrim"
                        @play-trimmed="playTrimmedOnly"
                        @trim-to-selection="trimToSelection" />
      </div>

      <!-- Section 2: Media Preview (Left) + Details (Right) -->
      <div class="modal-top-grid">
        <!-- Left Column: Thumbnail & Frame Capture -->
        <div class="modal-col-left">
          <div class="thumbnail-wrapper"
               :class="{ 'is-short': isShortVideo }">
            <img v-if="thumbnailUrl"
                 :src="thumbnailUrl"
                 alt="Video thumbnail"
                 class="video-thumbnail" />
            <div v-else
                 class="thumbnail-placeholder">
              <svg class="w-8 h-8 text-zinc-500"
                   viewBox="0 0 24 24"
                   fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
              </svg>
            </div>
            <div class="thumbnail-badge"
                 v-if="videoDurationFormatted">
              {{ videoDurationFormatted }}
            </div>
            <button type="button"
                    class="recapture-frame-btn"
                    :disabled="isCapturingFrame"
                    @click="$emit('captureFrame')"
                    title="Capture frame from video at current position">
              <svg v-if="!isCapturingFrame"
                   class="w-3.5 h-3.5"
                   viewBox="0 0 24 24"
                   fill="none"
                   stroke="currentColor"
                   stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12"
                        cy="13"
                        r="4"></circle>
              </svg>
              <svg v-else
                   class="w-3.5 h-3.5 animate-spin"
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
              <span>{{ isCapturingFrame ? 'Capturing...' : 'Capture Frame' }}</span>
            </button>
          </div>

          <!-- Thumbnail Option Checkbox -->
          <label class="thumbnail-checkbox">
            <input type="checkbox"
                   v-model="useThumbnailAsIcon" />
            <span>Use image as icon</span>
          </label>
        </div>

        <!-- Right Column: Sound Title & Tags -->
        <div class="modal-col-right">
          <!-- Sound Title -->
          <div class="field-group">
            <label class="field-label"
                   for="clip-sound-title">Sound Title</label>
            <input id="clip-sound-title"
                   type="text"
                   class="field-input"
                   v-model="clipTitle"
                   placeholder="Enter title for soundboard button" />
          </div>

          <!-- Tags -->
          <div class="field-group">
            <label class="field-label"
                   for="clip-sound-tags"
                   @click="tagInputRef && tagInputRef.textInputRef?.focus()">Tags</label>
            <TagInput ref="tagInputRef"
                      id="clip-sound-tags"
                      v-model="clipTags"
                      placeholder="Tags are used for searching" />
          </div>
        </div>
      </div>

      <!-- Section 3: Button Appearance Card: Preview + Color + Opacity + Hide Title -->
      <div class="button-appearance-card">
        <!-- Live Preview -->
        <div class="appearance-preview-col">
          <span class="preview-label">Button Preview</span>
          <div class="sound-button-preview-wrapper">
            <div class="sound-button"
                 :class="{ 'has-image': useThumbnailAsIcon && !!thumbnailUrl }"
                 :style="{
                  backgroundColor: (useThumbnailAsIcon && thumbnailUrl) ? 'transparent' : 'var(--button-color, #23a459)',
                  backgroundImage: (useThumbnailAsIcon && thumbnailUrl) ? `url('${thumbnailUrl}')` : 'none',
                }">
              <span v-if="!hideTitle"
                    class="button-title"
                    :style="{
                      color: selectedColor,
                      opacity: titleOpacity / 100,
                    }">
                {{ clipTitle || 'New Sound' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Appearance Controls -->
        <div class="appearance-controls-col">
          <!-- Button Color Selection -->
          <div class="color-section">
            <span class="field-label">Button Color</span>
            <div class="color-palette">
              <button v-for="color in presetColors"
                      :key="color"
                      type="button"
                      class="color-swatch"
                      :style="{ backgroundColor: color }"
                      :class="{ selected: selectedColor === color }"
                      :title="`Select color ${color}`"
                      :aria-label="`Color ${color}`"
                      @click="selectedColor = color"></button>
            </div>
          </div>

          <!-- Row: Hide title & Title opacity -->
          <div class="appearance-options-row">
            <label class="hide-title-checkbox"
                   title="Hide title on soundboard button">
              <input type="checkbox"
                     v-model="hideTitle" />
              <span class="nowrap">Hide title</span>
            </label>

            <!-- Title Opacity (shown when title not hidden) -->
            <div class="title-opacity-control"
                 v-if="!hideTitle">
              <label class="opacity-label"
                     for="clip-title-opacity">Opacity</label>
              <input id="clip-title-opacity"
                     type="range"
                     min="0"
                     max="100"
                     step="1"
                     v-model.number="titleOpacity"
                     class="opacity-slider" />
              <span class="opacity-badge">{{ titleOpacity }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 4: Action Footer -->
    <div class="clip-panel-footer">
      <div class="progress-info"
           v-if="isProcessing">
        <span class="progress-text">{{ progressStatusText }}</span>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill"
               :style="{ width: `${progressPercent}%` }"></div>
        </div>
      </div>

      <div class="footer-buttons">

        <!-- When audio is preloading/loading: interactive progress bar button -->
        <div v-if="isLoadingAudio"
             class="btn-preload-progress"
             title="Preloading audio from YouTube in background...">
          <div class="btn-preload-fill"
               :style="{ width: `${audioLoadProgress}%` }"></div>
          <div class="btn-preload-content">
            <svg class="w-4 h-4 animate-spin text-emerald-400"
                 viewBox="0 0 24 24"
                 fill="none"
                 stroke="currentColor">
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
            <span class="btn-preload-text">{{ audioLoadStatus || `Loading Audio: ${audioLoadProgress}%` }}</span>
          </div>
        </div>

        <!-- Ready: Add to Soundboard button -->
        <button v-else
                type="button"
                class="btn-add-sound"
                :disabled="isProcessing || !clipTitle.trim()"
                @click="saveSound">
          <svg v-if="!isProcessing"
               class="w-4 h-4"
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               stroke-width="2.5">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          <svg v-else
               class="w-4 h-4 animate-spin"
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
          <span>{{ isProcessing ? (progressStatusText || 'Adding to Soundboard...') : 'Add to Soundboard' }}</span>
        </button>
        <button type="button"
                class="btn-cancel"
                :disabled="isProcessing"
                @click="handleCancel">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef, watch, onUnmounted } from 'vue';
import { useSettingsStore } from '../store/settings';
import { usePulseBackStore } from '../store/pulseBack';
import { Sound } from '../@types/sound';
import { TagInputRef } from './BaseComponents/TagInputTypes';
import TagInput from './BaseComponents/TagInput.vue';
import TrimSummaryBar from './TrimSummaryBar.vue';
import { encodeMP3 } from '../services/pulseBackBuffer';
import { calculateAutoGainMultiplier, calculateChannelPeak, applyGainToAudioBuffer, AudioGainRegion } from '../utils/audioGain';

interface Props {
  audioBuffer?: AudioBuffer | null;
  audioDuration?: number;
  videoTotalDuration?: number | null;
  isLoadingAudio?: boolean;
  audioLoadProgress?: number;
  audioLoadStatus?: string;
  audioLoadError?: string;
  thumbnailUrl?: string;
  isShortVideo?: boolean;
  videoDurationFormatted?: string;
  isCapturingFrame?: boolean;
  activeVideoTitle?: string;
  currentUrl?: string;
  isOpen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  audioBuffer: null,
  audioDuration: 0,
  videoTotalDuration: null,
  isLoadingAudio: false,
  audioLoadProgress: 0,
  audioLoadStatus: '',
  audioLoadError: '',
  thumbnailUrl: '',
  isShortVideo: false,
  videoDurationFormatted: '',
  isCapturingFrame: false,
  activeVideoTitle: '',
  currentUrl: '',
  isOpen: false,
});

const emit = defineEmits<{
  (e: 'captureFrame'): void;
  (e: 'captureFrame'): void;
  (e: 'close'): void;
  (e: 'retryAudio'): void;
  (e: 'soundAdded', sound: Sound): void;
}>();

const settingsStore = useSettingsStore();
const pulseBackStore = usePulseBackStore();

// Local active audio buffer (supports non-destructive trimming and gain adjustments)
const cleanBaseAudioBuffer = shallowRef<AudioBuffer | null>(null);
const effectiveAudioBuffer = shallowRef<AudioBuffer | null>(null);
const appliedGainRegions = ref<AudioGainRegion[]>([]);
const gainMultiplier = ref(1.0);

// Trimming & Playback state
const startTime = ref(0);
const endTime = ref(0);
const currentTime = ref(0);
const isPlayingPreview = ref(false);

// Form / Appearance state
const clipTitle = ref('');
const clipTags = ref<string[]>([]);
const tagInputRef = ref<TagInputRef | null>(null);
const useThumbnailAsIcon = ref(true);
const selectedColor = ref('#ffffff');
const hideTitle = ref(false);
const titleOpacity = ref(100);

// Saving state
const isProcessing = ref(false);
const progressStatusText = ref('');
const progressPercent = ref(0);

const presetColors = [
  '#ffffff',
  '#23a459',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#ef4444',
  '#10b981',
  '#6b7280',
  '#000000',
];

// Audio Context & nodes
let audioContext: AudioContext | null = null;
let previewSourceNode: AudioBufferSourceNode | null = null;
let previewStartTime = 0;
let previewStartAudioContextTime = 0;
let previewAnimFrame: number | null = null;
let lastScrubTime = 0;
let scrubSourceNode: AudioBufferSourceNode | null = null;

// Total duration calculation
const currentTotalDuration = computed(() => {
  if (effectiveAudioBuffer.value) return effectiveAudioBuffer.value.duration;
  return props.audioDuration || props.videoTotalDuration || 1;
});

const trimmedDuration = computed(() => Math.max(0, endTime.value - startTime.value));

const relativeCurrentTime = computed(() => {
  if (trimmedDuration.value <= 0) return 0;
  return Math.max(0, Math.min(trimmedDuration.value, currentTime.value - startTime.value));
});

const canTrimToSelection = computed(() => {
  if (!effectiveAudioBuffer.value) return false;
  const dur = effectiveAudioBuffer.value.duration;
  return startTime.value > 0.05 || (endTime.value < dur - 0.05 && endTime.value > 0);
});

// Watch original audioBuffer prop
watch(
  () => props.audioBuffer,
  (newBuf) => {
    cleanBaseAudioBuffer.value = newBuf;
    gainMultiplier.value = 1.0;
    effectiveAudioBuffer.value = newBuf;
    if (newBuf) {
      if (endTime.value === 0 || endTime.value > newBuf.duration) {
        endTime.value = newBuf.duration;
      }
    }
  },
  { immediate: true }
);

function applyCurrentGain() {
  const base = cleanBaseAudioBuffer.value;
  if (!base) return;
  const ctx = getAudioContext();
  effectiveAudioBuffer.value = applyGainToAudioBuffer(
    ctx,
    base,
    gainMultiplier.value,
    appliedGainRegions.value
  );
}

function onGainMultiplierChange(val: number) {
  gainMultiplier.value = val;
  applyCurrentGain();
}

function onGainChange(payload: { target: 'both' | 'mic' | 'input'; multiplier: number; }) {
  const totalDur = currentTotalDuration.value;
  const startSec = Math.max(0, startTime.value);
  const endSec = Math.min(totalDur, endTime.value > 0 ? endTime.value : totalDur);
  const isPartial = startSec > 0.05 || (endSec < totalDur - 0.05 && endSec > 0);

  gainMultiplier.value = payload.multiplier;
  if (isPartial) {
    appliedGainRegions.value = appliedGainRegions.value.filter(
      r => !(Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
    );
    appliedGainRegions.value.push({
      id: 'gain-yt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      startSec,
      endSec,
      multiplier: payload.multiplier,
    });
  } else {
    appliedGainRegions.value = [];
  }
  applyCurrentGain();
}

function onAutoLevel() {
  const base = cleanBaseAudioBuffer.value;
  if (!base) return;
  const sampleRate = base.sampleRate;
  const totalDur = currentTotalDuration.value;
  const startSec = Math.max(0, startTime.value);
  const endSec = Math.min(totalDur, endTime.value > 0 ? endTime.value : totalDur);
  const isPartial = startSec > 0.05 || (endSec < totalDur - 0.05 && endSec > 0);

  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(base.length, Math.floor(endSec * sampleRate));

  const ch0 = base.getChannelData(0);
  const ch1 = base.numberOfChannels >= 2 ? base.getChannelData(1) : null;
  const peak0 = calculateChannelPeak(ch0, startSample, endSample);
  const peak1 = ch1 ? calculateChannelPeak(ch1, startSample, endSample) : 0;
  const maxPeak = Math.max(peak0, peak1);
  if (maxPeak <= 0.0001) return;
  const targetChannel = peak0 >= peak1 ? ch0 : ch1!;
  const mult = calculateAutoGainMultiplier(targetChannel, 0.944, undefined, startSample, endSample);
  gainMultiplier.value = mult;

  if (isPartial) {
    appliedGainRegions.value = appliedGainRegions.value.filter(
      r => !(Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
    );
    appliedGainRegions.value.push({
      id: 'gain-yt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      startSec,
      endSec,
      multiplier: mult,
    });
  } else {
    appliedGainRegions.value = [];
  }

  applyCurrentGain();
}

function onResetGain() {
  appliedGainRegions.value = [];
  gainMultiplier.value = 1.0;
  applyCurrentGain();
}

function onSelectGainRegion(region: AudioGainRegion) {
  startTime.value = region.startSec;
  endTime.value = region.endSec;
  currentTime.value = region.startSec;
  gainMultiplier.value = region.multiplier;
}

function onDeleteGainRegion(region: AudioGainRegion) {
  appliedGainRegions.value = appliedGainRegions.value.filter(r => {
    if (region.id && r.id) return r.id !== region.id;
    return !(Math.abs(r.startSec - region.startSec) < 0.05 && Math.abs(r.endSec - region.endSec) < 0.05);
  });
  if (Math.abs(startTime.value - region.startSec) < 0.05 && Math.abs(endTime.value - region.endSec) < 0.05) {
    gainMultiplier.value = 1.0;
  }
  applyCurrentGain();
}

function onClearAllGainRegions() {
  appliedGainRegions.value = [];
  gainMultiplier.value = 1.0;
  applyCurrentGain();
}

function onResetAllGainRegions() {
  appliedGainRegions.value = appliedGainRegions.value.map(r => ({ ...r, multiplier: 1.0 }));
  gainMultiplier.value = 1.0;
  applyCurrentGain();
}

function resetTrimStart() {
  startTime.value = 0;
  currentTime.value = 0;
}

function resetTrimEnd() {
  const dur = currentTotalDuration.value;
  endTime.value = dur;
  if (currentTime.value > dur) {
    currentTime.value = dur;
  }
}

function resetSelectionToExtents() {
  const dur = currentTotalDuration.value;
  startTime.value = 0;
  endTime.value = dur;
  currentTime.value = 0;
}

// Watch open state to initialize defaults
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      if (!clipTitle.value || clipTitle.value === 'YouTube Clip') {
        clipTitle.value = props.activeVideoTitle || 'YouTube Clip';
      }
      if (clipTags.value.length === 0) {
        const activeTags = settingsStore.quickTags.filter(t => t.active).map(t => t.label);
        clipTags.value = [...activeTags];
      }
      const dur = currentTotalDuration.value;
      if (endTime.value === 0 && dur > 0) {
        startTime.value = 0;
        endTime.value = dur;
      }
    } else {
      stopAudioPreview();
      stopScrubSnippet();
    }
  },
  { immediate: true }
);

watch(
  () => props.activeVideoTitle,
  (newTitle) => {
    if (newTitle && (!clipTitle.value || clipTitle.value === 'YouTube Clip')) {
      clipTitle.value = newTitle;
    }
  }
);

function formatSeconds(secs: number): string {
  if (Number.isNaN(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

function applyOpacityToColor(color: string, opacityPercent: number): string {
  if (opacityPercent >= 100) return color;
  const alpha = Math.max(0, Math.min(1, opacityPercent / 100));
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
    }
  } else if (color.startsWith('rgb(') || color.startsWith('rgba(')) {
    const parts = color.replace(/rgba?\((.*?)\)/, '$1').split(',').map(s => s.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha.toFixed(2)})`;
    }
  }
  return color;
}

function getAudioContext(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => { });
  }
  return audioContext;
}

function stopAudioPreview() {
  if (previewSourceNode) {
    try {
      previewSourceNode.stop();
      previewSourceNode.disconnect();
    } catch { }
    previewSourceNode = null;
  }
  if (previewAnimFrame) {
    cancelAnimationFrame(previewAnimFrame);
    previewAnimFrame = null;
  }
  isPlayingPreview.value = false;
}

function startAudioPreview(fromStart = false) {
  const buf = effectiveAudioBuffer.value;
  if (!buf) return;
  stopAudioPreview();

  const ctx = getAudioContext();
  const startSec = fromStart || currentTime.value < startTime.value || currentTime.value >= endTime.value
    ? startTime.value
    : currentTime.value;
  const durationSec = Math.max(0, endTime.value - startSec);
  if (durationSec <= 0) return;

  const source = ctx.createBufferSource();
  source.buffer = buf;

  const gain = ctx.createGain();
  gain.gain.value = 1.0;
  source.connect(gain);
  gain.connect(ctx.destination);

  previewSourceNode = source;
  previewStartTime = startSec;
  previewStartAudioContextTime = ctx.currentTime;
  isPlayingPreview.value = true;
  currentTime.value = startSec;

  source.onended = () => {
    if (previewSourceNode === source) {
      stopAudioPreview();
      currentTime.value = startTime.value;
    }
  };

  source.start(0, startSec, durationSec);

  const updatePlayhead = () => {
    if (!isPlayingPreview.value || !audioContext) return;
    const elapsed = audioContext.currentTime - previewStartAudioContextTime;
    const cur = previewStartTime + elapsed;
    if (cur >= endTime.value) {
      stopAudioPreview();
      currentTime.value = startTime.value;
      return;
    }
    currentTime.value = cur;
    previewAnimFrame = requestAnimationFrame(updatePlayhead);
  };
  previewAnimFrame = requestAnimationFrame(updatePlayhead);
}

function togglePlayPreview() {
  if (isPlayingPreview.value) {
    stopAudioPreview();
  } else {
    const fromStart = currentTime.value < startTime.value || currentTime.value >= endTime.value;
    startAudioPreview(fromStart);
  }
}

function onStopBtnClick() {
  stopAudioPreview();
  currentTime.value = startTime.value;
}

function stopScrubSnippet() {
  if (scrubSourceNode) {
    try {
      scrubSourceNode.stop();
      scrubSourceNode.disconnect();
    } catch { }
    scrubSourceNode = null;
  }
}

function playScrubSnippet(sec: number) {
  const buf = effectiveAudioBuffer.value;
  if (!buf) return;
  const now = performance.now();
  if (now - lastScrubTime < 45) return;
  lastScrubTime = now;

  const ctx = getAudioContext();
  stopScrubSnippet();

  const durationSec = 0.08;
  const startSec = Math.max(0, Math.min(buf.duration - 0.02, sec));
  const sampleRate = buf.sampleRate;
  const sampleCount = Math.floor(durationSec * sampleRate);
  if (sampleCount <= 0) return;

  const startSample = Math.floor(startSec * sampleRate);
  const snippet = ctx.createBuffer(1, sampleCount, sampleRate);
  const outData = snippet.getChannelData(0);
  const ch0 = buf.getChannelData(0);
  const ch1 = buf.numberOfChannels >= 2 ? buf.getChannelData(1) : null;

  for (let i = 0; i < sampleCount; i++) {
    const idx = startSample + i;
    if (idx >= buf.length) break;
    outData[i] = ch1 ? (ch0[idx] + ch1[idx]) * 0.5 : ch0[idx];
  }

  const fade = Math.min(Math.floor(sampleRate * 0.005), Math.floor(sampleCount / 4));
  for (let i = 0; i < fade; i++) {
    const ramp = i / fade;
    outData[i] *= ramp;
    outData[sampleCount - 1 - i] *= ramp;
  }

  const source = ctx.createBufferSource();
  source.buffer = snippet;
  source.connect(ctx.destination);
  scrubSourceNode = source;
  source.onended = () => {
    if (scrubSourceNode === source) scrubSourceNode = null;
  };
  source.start(0);
}

function onScrubStart(sec: number) {
  stopAudioPreview();
  currentTime.value = sec;
  playScrubSnippet(sec);
}

function onScrubMove(sec: number) {
  currentTime.value = sec;
  playScrubSnippet(sec);
}

function onScrubEnd(sec: number) {
  currentTime.value = sec;
  stopScrubSnippet();
}

function onTrimChange(payload: { start: number; end: number; handle?: 'start' | 'end'; }) {
  if (isPlayingPreview.value) {
    stopAudioPreview();
  }
  const isStartChange = payload.handle === 'start' || startTime.value !== payload.start;
  startTime.value = payload.start;
  endTime.value = payload.end;
  if (isStartChange) {
    currentTime.value = payload.start;
  } else if (currentTime.value < payload.start) {
    currentTime.value = payload.start;
  } else if (currentTime.value > payload.end) {
    currentTime.value = payload.end;
  }
}

watch(startTime, (newStart, oldStart) => {
  if (oldStart !== undefined && newStart !== oldStart) {
    currentTime.value = newStart;
  }
});

function onTrimEndChange() {
  if (isPlayingPreview.value) {
    stopAudioPreview();
  }
}

function trimToSelection() {
  const buf = cleanBaseAudioBuffer.value || effectiveAudioBuffer.value;
  if (!buf || !canTrimToSelection.value) return;

  stopAudioPreview();
  stopScrubSnippet();

  const startSec = startTime.value;
  const endSec = endTime.value;
  const sampleRate = buf.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(buf.length, Math.floor(endSec * sampleRate));
  const newLength = Math.max(0, endSample - startSample);
  if (newLength <= 0) return;

  const newDuration = newLength / sampleRate;
  const ctx = getAudioContext();
  const numChannels = buf.numberOfChannels;
  const newBuf = ctx.createBuffer(numChannels, newLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const srcData = buf.getChannelData(ch);
    const dstData = newBuf.getChannelData(ch);
    dstData.set(srcData.subarray(startSample, endSample));
  }

  cleanBaseAudioBuffer.value = newBuf;

  // Shift partial gain regions to new coordinates
  const newGainRegions: AudioGainRegion[] = [];
  for (const reg of appliedGainRegions.value) {
    const overlapStart = Math.max(reg.startSec, startSec);
    const overlapEnd = Math.min(reg.endSec, endSec);
    if (overlapEnd - overlapStart > 0.02) {
      const regStart = Math.max(0, overlapStart - startSec);
      const regEnd = Math.min(newDuration, overlapEnd - startSec);
      newGainRegions.push({
        id: reg.id || ('gain-yt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
        startSec: Math.round(regStart * 100) / 100,
        endSec: Math.round(regEnd * 100) / 100,
        multiplier: reg.multiplier,
      });
    }
  }
  appliedGainRegions.value = newGainRegions;

  applyCurrentGain();
  startTime.value = 0;
  endTime.value = newDuration;
  currentTime.value = 0;
}

function resetTrim() {
  stopAudioPreview();
  stopScrubSnippet();
  cleanBaseAudioBuffer.value = props.audioBuffer;
  applyCurrentGain();
  const fullDur = currentTotalDuration.value;
  startTime.value = 0;
  endTime.value = fullDur;
  currentTime.value = 0;
}

function playTrimmedOnly() {
  if (isPlayingPreview.value) {
    stopAudioPreview();
  } else {
    startAudioPreview(true);
  }
}

function handleCancel() {
  if (isProcessing.value) return;
  stopAudioPreview();
  stopScrubSnippet();
  emit('close');
}

async function saveSound() {
  if (!clipTitle.value.trim() || isProcessing.value) return;

  isProcessing.value = true;
  progressPercent.value = 10;
  progressStatusText.value = 'Preparing audio...';

  try {
    const totalMax = currentTotalDuration.value;
    if (startTime.value < 0 || Number.isNaN(startTime.value)) startTime.value = 0;
    if (endTime.value <= startTime.value || Number.isNaN(endTime.value)) {
      endTime.value = totalMax > 0 ? totalMax : startTime.value + 1;
    }

    const buf = effectiveAudioBuffer.value;
    let audioBlob: Blob | null = null;
    let extension = 'mp3';
    let duration = trimmedDuration.value;

    if (buf) {
      progressPercent.value = 35;
      progressStatusText.value = 'Encoding audio snippet to MP3...';

      const sampleRate = buf.sampleRate;
      const startSample = Math.max(0, Math.floor(startTime.value * sampleRate));
      const endSample = Math.min(buf.length, Math.floor(endTime.value * sampleRate));
      const length = Math.max(0, endSample - startSample);

      const slicedSamples = new Float32Array(length);
      const ch0 = buf.getChannelData(0).subarray(startSample, endSample);
      const hasSecond = buf.numberOfChannels >= 2;
      const ch1 = hasSecond ? buf.getChannelData(1).subarray(startSample, endSample) : null;

      if (hasSecond && ch1) {
        for (let i = 0; i < length; i++) {
          slicedSamples[i] = (ch0[i] + ch1[i]) * 0.5;
        }
      } else {
        slicedSamples.set(ch0);
      }

      duration = slicedSamples.length / sampleRate;
      audioBlob = await encodeMP3(slicedSamples, sampleRate, 192);
      extension = 'mp3';
    } else {
      progressStatusText.value = 'Downloading audio with yt-dlp...';
      const downloadOpts = {
        url: props.currentUrl,
        startTime: startTime.value,
        endTime: endTime.value,
      };
      const result = await window.electron?.ytDownloadClip(downloadOpts);
      if (!result || !result.success || !result.buffer) {
        throw new Error('Failed to extract audio from video');
      }
      audioBlob = new Blob([result.buffer], { type: result.mimeType || 'audio/mp4' });
      extension = result.extension || 'm4a';
    }

    if (!audioBlob) {
      throw new Error('Failed to create audio clip file');
    }

    progressPercent.value = 75;
    progressStatusText.value = 'Adding sound to soundboard...';

    const audioFile = new File([audioBlob], `${clipTitle.value.trim()}.${extension}`, {
      type: extension === 'mp3' ? 'audio/mpeg' : 'audio/mp4',
    });

    const ctx = getAudioContext();
    const { fileUrl: audioUrl, fileKey: audioKey } = await settingsStore.replaceFile(undefined, audioFile);
    const audioDur = await settingsStore.getAudioDuration(audioUrl, ctx);

    // Handle thumbnail image if selected
    let imageKey: string | undefined = undefined;
    let imageUrl: string | undefined = undefined;

    if (useThumbnailAsIcon.value && props.thumbnailUrl) {
      progressStatusText.value = 'Processing thumbnail artwork...';
      try {
        let imgBlob: Blob | null = null;
        if (props.thumbnailUrl.startsWith('data:')) {
          const res = await fetch(props.thumbnailUrl);
          imgBlob = await res.blob();
        } else {
          const imgBuffer = await window.electron?.ytFetchImage(props.thumbnailUrl);
          if (imgBuffer) {
            imgBlob = new Blob([imgBuffer], { type: 'image/jpeg' });
          }
        }

        if (imgBlob) {
          const imgFile = new File([imgBlob], `${clipTitle.value.trim()}_icon.jpg`, {
            type: imgBlob.type || 'image/jpeg',
          });
          const imgResult = await settingsStore.replaceFile(undefined, imgFile);
          imageKey = imgResult.fileKey;
          imageUrl = imgResult.fileUrl;
        }
      } catch (imgErr) {
        console.warn('Could not save thumbnail:', imgErr);
      }
    }

    // Parse tags
    const tags = (clipTags.value || []).map(t => t.trim()).filter(Boolean);
    const finalColor = applyOpacityToColor(selectedColor.value, titleOpacity.value);

    const newSound: Sound = {
      id: crypto.randomUUID(),
      title: clipTitle.value.trim(),
      audioKey,
      audioUrl,
      ...(imageKey ? { imageKey, imageUrl } : {}),
      color: finalColor,
      ...(hideTitle.value ? { hideTitle: true } : {}),
      tags: tags.length > 0 ? tags : undefined,
      duration: audioDur || duration,
      soundSegments: [
        {
          id: crypto.randomUUID(),
          label: 'Clip',
          start: 0,
          end: audioDur || duration,
        },
      ],
    };

    await settingsStore.insertSounds(settingsStore.sounds.length - 1, newSound);

    progressPercent.value = 100;
    progressStatusText.value = 'Saved!';

    pulseBackStore.showToast(`Added "${newSound.title}" to Soundboard!`);
    emit('soundAdded', newSound);
    emit('close');
  } catch (err: any) {
    console.error('Download error:', err);
    alert(`Failed to clip sound: ${err?.message || err}`);
  } finally {
    isProcessing.value = false;
  }
}

defineExpose({
  stopAudio: stopAudioPreview,
});

onUnmounted(() => {
  stopAudioPreview();
  stopScrubSnippet();
});
</script>

<style scoped>
.clip-panel-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 0;
  background: #18181b;
  overflow: hidden;
  text-align: left;
}

/* Panel Body */
.clip-panel-body {
  flex: 1 1 0px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 1.25rem;
  overflow-y: auto;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}

/* Audio Waveform Section */
.waveform-section {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  background: #131316;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.5rem;
  padding: 0.85rem 1rem;
  width: 100%;
}

.waveform-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  background: #23a459;
  border: none;
  color: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 6px rgba(35, 164, 89, 0.4);
}

.play-btn:hover:not(:disabled) {
  background: #2bb965;
  transform: scale(1.06);
}

.play-btn:focus-visible:not(:disabled) {
  outline: 2px solid var(--active-color, #23a459);
  outline-offset: 2px;
  background: #2bb965;
}

.play-btn.playing {
  background: #eab308;
  box-shadow: 0 2px 6px rgba(234, 179, 8, 0.4);
}

.play-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.stop-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 0.375rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ccc;
  cursor: pointer;
  transition: all 0.15s ease;
}

.stop-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.stop-btn:focus-visible:not(:disabled) {
  outline: 2px solid var(--active-color, #38bdf8);
  outline-offset: 2px;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.stop-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.time-readout {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8rem;
  color: #94a3b8;
  font-weight: 500;
  user-select: none;
  min-width: 90px;
}

.time-readout.clickable {
  cursor: pointer;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.time-readout.clickable:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #38bdf8;
}

.time-readout.clickable:focus-visible {
  outline: 2px solid #38bdf8;
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

.waveform-graph-box {
  width: 100%;
  min-height: 80px;
  background: #0d0d0f;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0.375rem;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

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

/* Media Preview & Details Grid */
.modal-top-grid {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
  width: 100%;
}

.modal-col-left {
  width: 230px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.thumbnail-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #111;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: aspect-ratio 0.2s ease, max-height 0.2s ease;
}

.thumbnail-wrapper.is-short {
  aspect-ratio: 9 / 14;
  max-height: 200px;
  margin: 0 auto;
}

.recapture-frame-btn {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(18, 18, 20, 0.85);
  backdrop-filter: blur(4px);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 0.35rem;
  padding: 0.22rem 0.5rem;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  z-index: 2;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
}

.recapture-frame-btn:hover:not(:disabled) {
  background: rgba(35, 164, 89, 0.9);
  border-color: rgba(35, 164, 89, 1);
  transform: translateY(-1px);
}

.recapture-frame-btn:focus-visible:not(:disabled) {
  outline: 2px solid var(--active-color, #23a459);
  outline-offset: 2px;
  background: rgba(35, 164, 89, 0.9);
  border-color: rgba(35, 164, 89, 1);
}

.recapture-frame-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.video-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.thumbnail-badge {
  position: absolute;
  bottom: 0.3rem;
  right: 0.3rem;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
}

.thumbnail-checkbox {
  display: flex !important;
  justify-content: flex-start !important;
  align-items: center !important;
  gap: 0.45rem !important;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  margin: 0 !important;
  padding: 0 !important;
  text-align: left;
}

.thumbnail-checkbox input[type='checkbox'] {
  cursor: pointer;
}

/* Right Column: Sound Title & Tags */
.modal-col-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
  text-align: left;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  text-align: left;
}

.field-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.55);
  text-align: left;
  display: block;
  margin: 0;
  padding: 0;
}

.field-input {
  width: 100%;
  background: #121214;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.45rem;
  padding: 0.45rem 0.65rem;
  font-size: 0.85rem;
  color: #fff;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  border-color: #23a459;
  box-shadow: 0 0 0 2px rgba(35, 164, 89, 0.2);
}

.field-group :deep(.tag-input) {
  background: #121214;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.45rem;
  min-height: 38px;
  padding: 0.25rem 0.45rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-group :deep(.tag-input:focus-within) {
  border-color: #23a459;
  box-shadow: 0 0 0 2px rgba(35, 164, 89, 0.2);
  outline: none;
}

/* Button Appearance Card & Preview */
.button-appearance-card {
  display: flex;
  align-items: center;
  gap: 1.15rem;
  background: #131316;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.5rem;
  padding: 0.75rem 0.95rem;
  min-width: 0;
}

.appearance-preview-col {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex-shrink: 0;
}

.appearance-controls-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.appearance-options-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem 1rem;
  min-height: 28px;
}

.preview-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.5);
  text-align: left;
}

.sound-button-preview-wrapper {
  display: flex;
  width: 100%;
}

.sound-button-preview-wrapper .sound-button {
  width: 88px;
  height: 80px;
  overflow: hidden;
  background-color: var(--button-color, #23a459);
  color: var(--text-color, #ffffff);
  border-radius: 0.313rem;
  background-size: cover;
  background-position: center;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  isolation: isolate;
  padding: 0.25rem 0.5rem;
  text-align: center;
  border: none;
  box-shadow: none;
  cursor: default;
  user-select: none;
  transition: background 0.15s ease;
}

.sound-button-preview-wrapper .button-title {
  font-size: 0.8rem;
  font-weight: bold;
  text-wrap: pretty;
  line-height: 1.1;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.sound-button-preview-wrapper .sound-button.has-image .button-title {
  color: white;
  --opacity: 0.3;
  text-shadow: 0px 0px 8px rgba(0, 0, 0, var(--opacity)), 4px 4px 8px rgba(0, 0, 0, var(--opacity)),
    4px -4px 8px rgba(0, 0, 0, var(--opacity)), -4px 4px 8px rgba(0, 0, 0, var(--opacity)),
    -4px -4px 8px rgba(0, 0, 0, var(--opacity));
}

/* Color section */
.color-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-align: left;
}

.color-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
  padding: 0;
  outline: none;
}

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch:focus-visible {
  outline: 2px solid var(--active-color, #38bdf8);
  outline-offset: 2px;
  transform: scale(1.15);
}

.color-swatch.selected {
  border-color: #fff;
  transform: scale(1.2);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.4);
}

.hide-title-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  user-select: none;
  font-weight: 500;
  flex-shrink: 0;
}

.hide-title-checkbox input[type="checkbox"] {
  accent-color: #23a459;
  width: 13px;
  height: 13px;
  cursor: pointer;
}

.title-opacity-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 150px;
}

.opacity-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  font-weight: 500;
}

.opacity-slider {
  flex: 1;
  height: 4px;
  accent-color: #38bdf8;
  cursor: pointer;
  min-width: 60px;
  margin: 0;
  padding: 0;
}

.opacity-badge {
  font-size: 0.72rem;
  font-weight: 600;
  color: #38bdf8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  min-width: 32px;
  text-align: right;
  user-select: none;
  margin-left: auto;
}

.nowrap {
  white-space: nowrap;
}

/* Action Footer */
.clip-panel-footer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  background: var(--top-toolbar-color);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.progress-text {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.7);
}

.progress-bar-bg {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #23a459;
  transition: width 0.25s ease;
}

.footer-buttons {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 0.45rem;
  color: #e0e0e0;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.45rem 1rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.btn-cancel:focus-visible:not(:disabled) {
  outline: 2px solid var(--active-color, #38bdf8);
  outline-offset: 2px;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.btn-add-sound {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: #23a459;
  border: none;
  border-radius: 0.45rem;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.45rem 1.15rem;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 2px 8px rgba(35, 164, 89, 0.35);
}

.btn-add-sound:hover:not(:disabled) {
  background: #2bb965;
  box-shadow: 0 2px 12px rgba(35, 164, 89, 0.55);
}

.btn-add-sound:focus-visible:not(:disabled) {
  outline: 2px solid var(--active-color, #23a459);
  outline-offset: 2px;
  background: #2bb965;
  box-shadow: 0 2px 14px rgba(35, 164, 89, 0.65);
}

.btn-add-sound:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-preload-progress {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 14rem;
  height: 2.25rem;
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.35);
  overflow: hidden;
  user-select: none;
}

.btn-preload-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.25), rgba(35, 164, 89, 0.5));
  transition: width 0.25s ease;
  pointer-events: none;
}

.btn-preload-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.85rem;
  color: #a7f3d0;
  font-size: 0.82rem;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
}

.btn-preload-text {
  max-width: 15rem;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
