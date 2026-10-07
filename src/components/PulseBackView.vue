<template>
  <div class="pulse-back-view">
    <!-- Top Header -->
    <div class="view-header">
      <div class="header-left">
        <h1 class="view-title">
          <svg class="w-6 h-6 text-blue-400"
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l3 3" />
          </svg>
          Pulse Back Studio
        </h1>
        <span class="header-subtitle">Review, trim, and publish audio replay clips to your soundboard</span>
      </div>

      <div class="header-right">
        <!-- Quick Clip Button & Popover -->
        <QuickClipButton />


        <!-- Pulse Back Buffer Toggle -->
        <toggle class="pulseBackToggle"
                :modelValue="pulseBackStore.isBufferEnabled"
                @update:modelValue="pulseBackStore.toggleBuffer">
          <span class="flex items-center gap-1.5">
            <span :class="['status-dot', { online: pulseBackStore.isBufferRunning }]"></span>
            Pulse Back
          </span>
        </toggle>


      </div>
    </div>

    <!-- Main Workspace Split -->
    <div class="workspace">
      <!-- Left Rail: Clips List -->
      <div class="clips-rail">
        <div class="rail-header">
          <span class="rail-title">Captured Clips ({{ pulseBackStore.clips.length }})</span>
        </div>

        <div v-if="pulseBackStore.clips.length === 0"
             class="empty-clips">
          <svg class="w-10 h-10 text-zinc-600 mb-2"
               viewBox="0 0 24 24"
               fill="none"
               stroke="currentColor"
               stroke-width="1.5">
            <path d="M12 8v4l3 3" />
            <circle cx="12"
                    cy="12"
                    r="9" />
          </svg>
          <p class="font-medium text-zinc-300">No clips captured yet</p>
          <p class="text-xs text-zinc-500 mt-1">Press <kbd class="px-1 py-0.5 bg-zinc-800 rounded border border-zinc-700">F12</kbd> or click <strong>Clip</strong> in the top bar when audio happens.</p>
        </div>

        <div v-else
             class="clips-list">
          <div v-for="clip in pulseBackStore.clips"
               :key="clip.id"
               :class="['clip-card', { active: pulseBackStore.selectedClipId === clip.id }]"
               @click="selectClip(clip)">
            <div class="clip-card-main">
              <div class="clip-card-title">{{ clip.title }}</div>
              <div class="clip-card-meta">
                <span class="time">{{ formatTime(clip.createdAt) }}</span>
                <span class="duration-badge">{{ formatSeconds(clip.duration) }}</span>
              </div>
            </div>
            <div class="clip-card-actions">
              <button class="clip-card-btn duplicate-clip-btn"
                      @click.stop="duplicateClip(clip.id)"
                      title="Duplicate clip">
                <svg class="w-4 h-4"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <rect x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button class="clip-card-btn delete-clip-btn"
                      @click.stop="deleteClip(clip.id)"
                      title="Delete clip">
                <svg class="w-4 h-4"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <line x1="18"
                        y1="6"
                        x2="6"
                        y2="18"></line>
                  <line x1="6"
                        y1="6"
                        x2="18"
                        y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Area: Waveform Studio & Soundboard Export -->
      <div v-if="selectedClip"
           class="studio-main">
        <!-- Clip Details & Title -->
        <div class="clip-info-bar">
          <div class="title-input-group">
            <label for="clip-title-input">Clip Title:</label>
            <input id="clip-title-input"
                   type="text"
                   v-model="clipTitle"
                   @input="onTitleInput"
                   @change="onTitleChange"
                   @blur="onTitleChange"
                   @keydown.enter="($event.target as HTMLInputElement).blur()"
                   placeholder="Give your sound a name..."
                   class="clip-title-input" />
          </div>
          <button class="duplicate-toolbar-btn"
                  @click="duplicateClip(selectedClip.id)"
                  title="Duplicate this clip to create another sound from it">
            <svg class="w-4 h-4 mr-1.5"
                 viewBox="0 0 24 24"
                 fill="none"
                 stroke="currentColor"
                 stroke-width="2">
              <rect x="9"
                    y="9"
                    width="13"
                    height="13"
                    rx="2"
                    ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Duplicate Clip
          </button>
        </div>

        <!-- Waveform Visualizer & Trimmer -->
        <div class="waveform-container"
             ref="waveformContainerRef">
          <div class="waveform-labels">
            <span class="playback-controls">
              <button class="play-btn"
                      :class="{ playing: isPlaying }"
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
              <button class="stop-btn"
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

              <!-- Audio Clipboard & Edit Actions Group -->
              <audio-clipboard-group
                :can-undo="canUndo"
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
                @set-out="setOutToCurrentTime"
              />
            </span>

            <!-- Audio Tracks Selector & Target Mode -->
            <div v-if="hasDualChannels"
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
          </div>

          <!-- Waveform Row with Left Track Controls Gutter -->
          <div class="waveform-body-row">
            <!-- Left Track Controls Gutter (aligned with each track lane) -->
            <div v-if="hasDualChannels"
                 class="waveform-track-gutter"
                 role="toolbar"
                 aria-label="Audio track mute controls">
              <!-- Top Track: Microphone (Channel 1) -->
              <div class="track-gutter-slot top-slot">
                <button type="button"
                        :class="['track-icon-btn', 'mic-icon-btn', { active: includeMic, muted: !includeMic }]"
                        @click="toggleMicTrack"
                        :title="includeMic ? 'Mute Microphone track in this clip' : 'Unmute Microphone track in this clip'"
                        :aria-label="includeMic ? 'Mute Microphone track' : 'Unmute Microphone track'">
                  <svg v-if="includeMic"
                       class="w-4 h-4"
                       viewBox="0 0 24 24"
                       fill="none"
                       stroke="currentColor"
                       stroke-width="2"
                       stroke-linecap="round"
                       stroke-linejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                  <svg v-else
                       class="w-4 h-4"
                       viewBox="0 0 24 24"
                       fill="none"
                       stroke="currentColor"
                       stroke-width="2"
                       stroke-linecap="round"
                       stroke-linejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </button>
              </div>

              <!-- Track Gutter Center Divider Line (matches canvas track divider) -->
              <div class="track-gutter-divider"></div>

              <!-- Bottom Track: Input Device (Channel 2) -->
              <div class="track-gutter-slot bottom-slot">
                <button type="button"
                        :class="['track-icon-btn', 'input-icon-btn', { active: includeInput, muted: !includeInput }]"
                        @click="toggleInputTrack"
                        :title="includeInput ? 'Mute Input Device track in this clip' : 'Unmute Input Device track in this clip'"
                        :aria-label="includeInput ? 'Mute Input Device track' : 'Unmute Input Device track'">
                  <svg v-if="includeInput"
                       class="w-4 h-4"
                       viewBox="0 0 24 24"
                       fill="none"
                       stroke="currentColor"
                       stroke-width="2"
                       stroke-linecap="round"
                       stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                  <svg v-else
                       class="w-4 h-4"
                       viewBox="0 0 24 24"
                       fill="none"
                       stroke="currentColor"
                       stroke-width="2"
                       stroke-linecap="round"
                       stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="22" y1="9" x2="16" y2="15"></line>
                    <line x1="16" y1="9" x2="22" y2="15"></line>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Waveform Graph Component -->
            <waveform-graph class="waveform-graph-main"
                            :audio-buffer="audioBuffer"
                            :duration="audioDuration"
                            :tracks="pulseBackTracks"
                            :active-track="activeTrackTarget"
                            :segment-boundaries="segmentBoundaries"
                            :include-mic="includeMic"
                            :include-input="includeInput"
                            v-model:current-time="currentTime"
                            v-model:trim-start="trimStart"
                            v-model:trim-end="trimEnd"
                            @scrub-start="onScrubStart"
                            @scrub-move="onScrubMove"
                            @scrub-end="onScrubEnd"
                            @trim-change="onTrimChange"
                            @trim-end-change="onTrimEndChange" />
          </div>
        </div>


        <!-- Native Audio Elements for 1:1 hardware clock playback -->
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


        <trim-summary-bar v-model:trim-start="trimStart"
                          v-model:trim-end="trimEnd"
                          :duration="audioDuration"
                          :is-playing="isPlaying"
                          :show-trim-to-selection="true"
                          :can-trim-to-selection="canTrimToSelection"
                          :has-dual-tracks="hasDualChannels"
                          v-model:active-track-target="activeTrackTarget"
                          :mic-gain="micGainMultiplier"
                          :input-gain="inputGainMultiplier"
                          :has-partial-gains="appliedGainRegions.length > 0"
                          :gain-regions="appliedGainRegions"
                          @change-gain="onPulseBackChangeGain"
                          @auto-level="onPulseBackAutoLevel"
                          @reset-gain="onPulseBackResetGain"
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

        <!-- Soundboard Publish Card -->
        <div class="publish-card">
          <h2 class="publish-heading">Add to Soundboard</h2>
          <div class="publish-grid">
            <div class="publish-field">
              <label>Button Color:</label>
              <div class="flex items-center gap-2">
                <color-picker v-model="clipColor"
                              :label="''"
                              align="left"
                              @update:model-value="onColorChange" />
                <span class="text-xs text-zinc-400 uppercase font-mono">{{ clipColor }}</span>
              </div>
            </div>

            <div class="publish-field">
              <label for="clip-tags"
                     @click="tagInputRef && tagInputRef.textInputRef?.focus()">Tags:</label>
              <tag-input ref="tagInputRef"
                         id="clip-tags"
                         v-model="clipTags"
                         placeholder="Tags are used for searching"
                         @update:model-value="onTagsChange" />
            </div>

            <div class="publish-field">
              <label>Volume: {{ clipVolume }}%</label>
              <input type="range"
                     min="0"
                     max="100"
                     v-model="clipVolume"
                     @input="onVolumeChange"
                     @change="onVolumeChange"
                     class="volume-slider cursor-pointer" />
            </div>

            <div class="publish-field">
              <label>Save Format:</label>
              <div class="format-toggle-group">
                <button type="button"
                        class="format-toggle-btn"
                        :class="{ active: exportFormat === 'mp3' }"
                        @click="setExportFormat('mp3')">
                  MP3
                </button>
                <button type="button"
                        class="format-toggle-btn"
                        :class="{ active: exportFormat === 'wav' }"
                        @click="setExportFormat('wav')">
                  WAV
                </button>
                <button type="button"
                        class="format-toggle-btn"
                        :class="{ active: exportFormat === 'ogg' }"
                        @click="setExportFormat('ogg')">
                  OGG
                </button>
              </div>
            </div>
          </div>

          <div class="publish-actions">
            <div class="publish-options">
              <label class="publish-option-label"
                     title="When enabled, removes this clip from Pulse Back after adding it to the soundboard">
                <input type="checkbox"
                       v-model="deleteAfterPublish"
                       @change="onDeleteAfterPublishChange"
                       class="publish-checkbox" />
                <span>Delete clip from Pulse Back after adding</span>
              </label>
            </div>
            <div class="publish-buttons">
              <button class="save-file-btn"
                      :disabled="isSavingFile || isPublishing"
                      @click="saveToFile"
                      :title="`Save audio file as .${exportFormat} to your computer`">
                <svg class="w-5 h-5 mr-1.5"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12"
                        y1="15"
                        x2="12"
                        y2="3" />
                </svg>
                {{ isSavingFile ? 'Saving...' : `Save as .${exportFormat.toUpperCase()}` }}
              </button>
              <button class="publish-btn"
                      :disabled="isPublishing || isSavingFile"
                      @click="publishToSoundboard">
                <svg class="w-5 h-5 mr-1"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {{ isPublishing ? 'Publishing...' : 'Add to Soundboard' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- No Clip Selected -->
      <div v-else
           class="studio-empty">
        <p class="text-zinc-400">Select a clip on the left to edit and publish</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { usePulseBackStore, PulseBackClip } from '../store/pulseBack';
import { useSettingsStore } from '../store/settings';
import { TagInputRef } from './BaseComponents/TagInputTypes';
import { encodeWAV, encodeMP3, encodeOGG } from '../services/pulseBackBuffer';
import WaveformGraph, { WaveformTrack } from './WaveformGraph.vue';
import TrimSummaryBar from './TrimSummaryBar.vue';
import AudioClipboardGroup from './AudioClipboardGroup.vue';
import { calculateAutoGainMultiplier, applyGainToAudioBuffer, AudioGainRegion } from '../utils/audioGain';
import {
  AudioTimelineSegment,
  AudioClipboardData,
  createInitialSegments,
  getSegmentBoundaries,
  compositeSegments,
  copyAudioSelection,
  splitTimelineAt,
  spliceTimelineSegments,
  cutTimelineSegments,
  deleteTimelineSegments,
} from '../utils/audioSegments';

const pulseBackStore = usePulseBackStore();
const settingsStore = useSettingsStore();

function getDefaultVolumePercent(): number {
  const def = settingsStore.defaultVolume;
  return typeof def === 'number' && !Number.isNaN(def) ? Math.round(def * 100) : 100;
}

const tagInputRef = ref<TagInputRef | null>(null);

const selectedClip = computed(() => pulseBackStore.selectedClip);

// Editor State
const clipTitle = ref('');
const clipColor = ref('#ffffff');
const clipTags = ref<string[]>(['clip']);
const clipVolume = ref(getDefaultVolumePercent());
const isPublishing = ref(false);
const isSavingFile = ref(false);

const savedDeleteAfterPublish = localStorage.getItem('pulse_back_delete_after_publish');
const deleteAfterPublish = ref(savedDeleteAfterPublish === 'true');

function onDeleteAfterPublishChange() {
  try {
    localStorage.setItem('pulse_back_delete_after_publish', String(deleteAfterPublish.value));
  } catch { }
}

const savedFormat = localStorage.getItem('pulse_back_export_format');
const exportFormat = ref<'mp3' | 'wav' | 'ogg'>(
  savedFormat === 'wav' || savedFormat === 'ogg' ? savedFormat : 'mp3'
);

function setExportFormat(format: 'mp3' | 'wav' | 'ogg') {
  exportFormat.value = format;
  try {
    localStorage.setItem('pulse_back_export_format', format);
  } catch { }
}

// Trimming State
const trimStart = ref(0);
const trimEnd = ref(0);

// Waveform & Audio State
const micAudioElRef = ref<HTMLAudioElement | null>(null);
const inputAudioElRef = ref<HTMLAudioElement | null>(null);
const micPreviewUrl = ref<string>('');
const inputPreviewUrl = ref<string>('');
const cleanBaseAudioBuffer = shallowRef<AudioBuffer | null>(null);
const audioBuffer = shallowRef<AudioBuffer | null>(null);
const originalAudioBuffer = shallowRef<AudioBuffer | null>(null);
const appliedGainRegions = ref<AudioGainRegion[]>([]);
const globalMicGain = ref(1.0);
const globalInputGain = ref(1.0);
const micGainMultiplier = ref(1.0);
const inputGainMultiplier = ref(1.0);
let audioContext: AudioContext | null = null;

// Multi-Segment Audio Timeline State
const timelineSegments = ref<AudioTimelineSegment[]>([]);
const segmentBoundaries = computed(() => getSegmentBoundaries(timelineSegments.value));

// In-Memory Audio Clipboard & History Stack
const audioClipboard = ref<AudioClipboardData | null>(null);

interface TimelineHistoryItem {
  segments: AudioTimelineSegment[];
  gainRegions: AudioGainRegion[];
  trimStart: number;
  trimEnd: number;
  currentTime: number;
}

const undoStack = ref<TimelineHistoryItem[]>([]);
const redoStack = ref<TimelineHistoryItem[]>([]);
const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);
const canCopy = computed(() => audioDuration.value > 0);
const canCut = computed(() => {
  if (audioDuration.value <= 0) return false;
  const totalDur = audioDuration.value;
  const isTrimmed = trimStart.value > 0.05 || (trimEnd.value > 0 && trimEnd.value < totalDur - 0.05);
  const selDuration = (trimEnd.value > 0 ? trimEnd.value : totalDur) - trimStart.value;
  return isTrimmed && selDuration > 0.05;
});
const canPaste = computed(() => audioClipboard.value !== null);
const pasteTooltip = computed(() => {
  if (!canPaste.value) return 'Paste audio (Ctrl+V) - Clipboard empty';
  const totalDur = audioDuration.value;
  const hasSubSelection = (trimEnd.value > 0 && trimEnd.value < totalDur - 0.05) || trimStart.value > 0.05;
  const isCursorInside = hasSubSelection && (currentTime.value >= trimStart.value - 0.05 && currentTime.value <= trimEnd.value + 0.05);
  if (hasSubSelection && isCursorInside) {
    return `Paste (Replace selection ${formatSeconds(trimStart.value)} - ${formatSeconds(trimEnd.value)}) (Ctrl+V)`;
  }
  return `Paste at cursor (${formatSeconds(currentTime.value)}) (Ctrl+V)`;
});

// Dual-Track State
const includeMic = ref(true);
const includeInput = ref(true);
const hasDualChannels = ref(false);
const activeTrackTarget = ref<'both' | 'mic' | 'input'>('both');

// Segmented Track Selector Animated Sliding Indicator
const segmentedGroupRef = ref<HTMLElement | null>(null);
const btnBothRef = ref<HTMLButtonElement | null>(null);
const btnMicRef = ref<HTMLButtonElement | null>(null);
const btnInputRef = ref<HTMLButtonElement | null>(null);

const indicatorPos = ref<{ x: number; y: number; width: number; height: number; visible: boolean; }>({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  visible: false,
});

function updateSegmentIndicator() {
  const container = segmentedGroupRef.value;
  const activeBtn = activeTrackTarget.value === 'both'
    ? btnBothRef.value
    : activeTrackTarget.value === 'mic'
      ? btnMicRef.value
      : btnInputRef.value;

  if (!container || !activeBtn) return;

  const containerRect = container.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();

  if (btnRect.width > 0 && btnRect.height > 0) {
    indicatorPos.value = {
      x: btnRect.left - containerRect.left - container.clientLeft,
      y: btnRect.top - containerRect.top - container.clientTop,
      width: btnRect.width,
      height: btnRect.height,
      visible: true,
    };
  }
}

const segmentIndicatorStyle = computed(() => {
  if (!indicatorPos.value.visible) {
    return { opacity: 0 };
  }
  return {
    transform: `translate3d(${indicatorPos.value.x}px, ${indicatorPos.value.y}px, 0)`,
    width: `${indicatorPos.value.width}px`,
    height: `${indicatorPos.value.height}px`,
    opacity: 1,
  };
});

let segmentedResizeObserver: ResizeObserver | null = null;
let resizeTimer: number | null = null;
const isResizing = ref(false);

function attachSegmentedResizeObserver() {
  segmentedResizeObserver?.disconnect();
  if (typeof ResizeObserver === 'undefined') return;
  segmentedResizeObserver = new ResizeObserver(() => {
    updateSegmentIndicator();
  });
  if (segmentedGroupRef.value) segmentedResizeObserver.observe(segmentedGroupRef.value);
  if (btnBothRef.value) segmentedResizeObserver.observe(btnBothRef.value);
  if (btnMicRef.value) segmentedResizeObserver.observe(btnMicRef.value);
  if (btnInputRef.value) segmentedResizeObserver.observe(btnInputRef.value);
}

function onWindowResize() {
  isResizing.value = true;
  requestAnimationFrame(updateSegmentIndicator);
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    isResizing.value = false;
    updateSegmentIndicator();
  }, 100);
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onWindowResize);
  nextTick(() => {
    updateSegmentIndicator();
    if (hasDualChannels.value) {
      attachSegmentedResizeObserver();
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('resize', onWindowResize);
  if (resizeTimer) clearTimeout(resizeTimer);
  segmentedResizeObserver?.disconnect();
});

watch(activeTrackTarget, () => {
  nextTick(updateSegmentIndicator);
});

watch(hasDualChannels, (hasDual) => {
  if (!hasDual) {
    activeTrackTarget.value = 'both';
  }
  nextTick(() => {
    updateSegmentIndicator();
    if (hasDual) {
      attachSegmentedResizeObserver();
    }
  });
});

const pulseBackTracks = computed<WaveformTrack[]>(() => {
  if (!hasDualChannels.value) {
    return [
      {
        label: '',
        channelIndex: 0,
        enabled: true,
        colors: ['#38bdf8', '#0284c7'],
      },
    ];
  }
  return [
    {
      label: '🎤 MIC (VOICE)',
      channelIndex: 0,
      enabled: includeMic.value,
      colors: ['#38bdf8', '#0284c7'],
    },
    {
      label: '🔊 INPUT DEVICE (AUDIO)',
      channelIndex: 1,
      enabled: includeInput.value,
      colors: ['#34d399', '#059669'],
    },
  ];
});

// Playback State
const isPlaying = ref(false);
const currentTime = ref(0);
let playbackEndSec = 0;
let playbackAnimationId: number | null = null;

const audioDuration = computed(() => audioBuffer.value?.duration || selectedClip.value?.duration || 1);

const trimmedDuration = computed(() => Math.max(0, trimEnd.value - trimStart.value));

const relativeCurrentTime = computed(() => {
  if (trimmedDuration.value <= 0) return 0;
  return Math.max(0, Math.min(trimmedDuration.value, currentTime.value - trimStart.value));
});

function syncAudioCurrentTime(sec: number) {
  if (micAudioElRef.value && micAudioElRef.value.readyState >= 1) {
    micAudioElRef.value.currentTime = sec;
  }
  if (inputAudioElRef.value && inputAudioElRef.value.readyState >= 1) {
    inputAudioElRef.value.currentTime = sec;
  }
}

function updateTrackVolumes() {
  const masterVol = clipVolume.value / 100;
  const bothActive = includeMic.value && includeInput.value && hasDualChannels.value;
  const factor = bothActive ? 0.75 : 1.0;

  if (micAudioElRef.value) {
    micAudioElRef.value.muted = !includeMic.value;
    micAudioElRef.value.volume = includeMic.value ? masterVol * factor : 0;
    if (isPlaying.value && includeMic.value && micAudioElRef.value.paused) {
      micAudioElRef.value.currentTime = currentTime.value;
      micAudioElRef.value.play().catch(() => { });
    }
  }
  if (inputAudioElRef.value) {
    inputAudioElRef.value.muted = !includeInput.value;
    inputAudioElRef.value.volume = includeInput.value ? masterVol * factor : 0;
    if (isPlaying.value && includeInput.value && inputAudioElRef.value.paused) {
      inputAudioElRef.value.currentTime = currentTime.value;
      inputAudioElRef.value.play().catch(() => { });
    }
  }
}

function clearPreviewUrls() {
  if (micPreviewUrl.value) {
    try {
      URL.revokeObjectURL(micPreviewUrl.value);
    } catch { }
    micPreviewUrl.value = '';
  }
  if (inputPreviewUrl.value) {
    try {
      URL.revokeObjectURL(inputPreviewUrl.value);
    } catch { }
    inputPreviewUrl.value = '';
  }
}

function updatePreviewUrls() {
  if (!audioBuffer.value) return;
  const numChannels = audioBuffer.value.numberOfChannels;
  const sampleRate = audioBuffer.value.sampleRate;

  const micData = audioBuffer.value.getChannelData(0);
  const micBlob = encodeWAV(micData, sampleRate);
  if (micPreviewUrl.value) {
    try {
      URL.revokeObjectURL(micPreviewUrl.value);
    } catch { }
  }
  micPreviewUrl.value = URL.createObjectURL(micBlob);

  if (numChannels >= 2) {
    const inputData = audioBuffer.value.getChannelData(1);
    const inputBlob = encodeWAV(inputData, sampleRate);
    if (inputPreviewUrl.value) {
      try {
        URL.revokeObjectURL(inputPreviewUrl.value);
      } catch { }
    }
    inputPreviewUrl.value = URL.createObjectURL(inputBlob);
  } else {
    if (inputPreviewUrl.value) {
      try {
        URL.revokeObjectURL(inputPreviewUrl.value);
      } catch { }
    }
    inputPreviewUrl.value = '';
  }
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

function updateActiveGainDisplay() {
  const totalDur = audioDuration.value;
  const startSec = trimStart.value;
  const endSec = trimEnd.value > 0 ? trimEnd.value : totalDur;
  const isPartial = startSec > 0.05 || (endSec < totalDur - 0.05 && endSec > 0);

  if (isPartial) {
    const micRegion = appliedGainRegions.value.find(
      r => (r.channel === undefined || r.channel === 0) &&
        ((Math.abs(r.startSec - startSec) < 0.25 && Math.abs(r.endSec - endSec) < 0.25) ||
          (startSec >= r.startSec - 0.08 && endSec <= r.endSec + 0.08))
    );
    micGainMultiplier.value = micRegion && micRegion.multiplier !== undefined ? micRegion.multiplier : globalMicGain.value;

    const inputRegion = appliedGainRegions.value.find(
      r => (r.channel === undefined || r.channel === 1) &&
        ((Math.abs(r.startSec - startSec) < 0.25 && Math.abs(r.endSec - endSec) < 0.25) ||
          (startSec >= r.startSec - 0.08 && endSec <= r.endSec + 0.08))
    );
    inputGainMultiplier.value = inputRegion && inputRegion.multiplier !== undefined ? inputRegion.multiplier : globalInputGain.value;
  } else {
    const fullMicRegion = appliedGainRegions.value.find(
      r => (r.channel === undefined || r.channel === 0) &&
        r.startSec <= startSec + 0.1 && r.endSec >= endSec - 0.1
    );
    micGainMultiplier.value = fullMicRegion && fullMicRegion.multiplier !== undefined ? fullMicRegion.multiplier : globalMicGain.value;

    const fullInputRegion = appliedGainRegions.value.find(
      r => (r.channel === undefined || r.channel === 1) &&
        r.startSec <= startSec + 0.1 && r.endSec >= endSec - 0.1
    );
    inputGainMultiplier.value = fullInputRegion && fullInputRegion.multiplier !== undefined ? fullInputRegion.multiplier : globalInputGain.value;
  }
}

function applyPulseBackGain() {
  const base = cleanBaseAudioBuffer.value;
  if (!base) return;
  const ctx = getAudioContext();
  const hasDual = base.numberOfChannels >= 2;
  hasDualChannels.value = hasDual;

  audioBuffer.value = applyGainToAudioBuffer(
    ctx,
    base,
    hasDual ? [globalMicGain.value, globalInputGain.value] : globalMicGain.value,
    appliedGainRegions.value
  );

  updatePreviewUrls();
  updateTrackVolumes();
  syncAudioCurrentTime(currentTime.value);
  saveCurrentClipState();
}

function onPulseBackChangeGain(payload: { target: 'both' | 'mic' | 'input'; multiplier: number; }) {
  const totalDur = audioDuration.value;
  const startSec = Math.max(0, trimStart.value);
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur);
  const isPartial = startSec > 0.05 || (endSec < totalDur - 0.05 && endSec > 0);

  if (payload.target === 'mic' || payload.target === 'both') {
    micGainMultiplier.value = payload.multiplier;
    if (isPartial) {
      appliedGainRegions.value = appliedGainRegions.value.filter(
        r => !(r.channel === 0 && Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
      );
      appliedGainRegions.value.push({
        id: 'gain-pb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        startSec,
        endSec,
        channel: 0,
        multiplier: payload.multiplier,
      });
    } else {
      appliedGainRegions.value = appliedGainRegions.value.filter(r => r.channel !== 0);
      globalMicGain.value = payload.multiplier;
    }
  }

  if (payload.target === 'input' || payload.target === 'both') {
    inputGainMultiplier.value = payload.multiplier;
    if (isPartial) {
      appliedGainRegions.value = appliedGainRegions.value.filter(
        r => !(r.channel === 1 && Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
      );
      appliedGainRegions.value.push({
        id: 'gain-pb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        startSec,
        endSec,
        channel: 1,
        multiplier: payload.multiplier,
      });
    } else {
      appliedGainRegions.value = appliedGainRegions.value.filter(r => r.channel !== 1);
      globalInputGain.value = payload.multiplier;
    }
  }

  applyPulseBackGain();
  updateActiveGainDisplay();
}

function onPulseBackAutoLevel(target: 'both' | 'mic' | 'input') {
  const base = cleanBaseAudioBuffer.value;
  if (!base) return;

  const sampleRate = base.sampleRate;
  const totalDur = audioDuration.value;
  const startSec = Math.max(0, trimStart.value);
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur);
  const isPartial = startSec > 0.05 || (endSec < totalDur - 0.05 && endSec > 0);

  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(base.length, Math.floor(endSec * sampleRate));

  if (target === 'mic' || target === 'both') {
    const ch0 = base.getChannelData(0);
    const mult0 = calculateAutoGainMultiplier(ch0, 0.944, undefined, startSample, endSample);
    micGainMultiplier.value = mult0;

    if (isPartial) {
      appliedGainRegions.value = appliedGainRegions.value.filter(
        r => !(r.channel === 0 && Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
      );
      appliedGainRegions.value.push({
        id: 'gain-pb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        startSec,
        endSec,
        channel: 0,
        multiplier: mult0,
      });
    } else {
      appliedGainRegions.value = appliedGainRegions.value.filter(r => r.channel !== 0);
      globalMicGain.value = mult0;
    }
  }

  if ((target === 'input' || target === 'both') && base.numberOfChannels >= 2) {
    const ch1 = base.getChannelData(1);
    const mult1 = calculateAutoGainMultiplier(ch1, 0.944, undefined, startSample, endSample);
    inputGainMultiplier.value = mult1;

    if (isPartial) {
      appliedGainRegions.value = appliedGainRegions.value.filter(
        r => !(r.channel === 1 && Math.abs(r.startSec - startSec) < 0.1 && Math.abs(r.endSec - endSec) < 0.1)
      );
      appliedGainRegions.value.push({
        id: 'gain-pb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        startSec,
        endSec,
        channel: 1,
        multiplier: mult1,
      });
    } else {
      appliedGainRegions.value = appliedGainRegions.value.filter(r => r.channel !== 1);
      globalInputGain.value = mult1;
    }
  }

  applyPulseBackGain();
  updateActiveGainDisplay();
}

function onPulseBackResetGain(target: 'both' | 'mic' | 'input') {
  const totalDur = audioDuration.value;
  const startSec = Math.max(0, trimStart.value);
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur);

  if (target === 'mic' || target === 'both') {
    micGainMultiplier.value = 1.0;
    appliedGainRegions.value = appliedGainRegions.value.filter(
      r => !((r.channel === 0 || r.channel === undefined) && r.startSec < endSec && r.endSec > startSec)
    );
    globalMicGain.value = 1.0;
  }

  if (target === 'input' || target === 'both') {
    inputGainMultiplier.value = 1.0;
    appliedGainRegions.value = appliedGainRegions.value.filter(
      r => !((r.channel === 1 || r.channel === undefined) && r.startSec < endSec && r.endSec > startSec)
    );
    globalInputGain.value = 1.0;
  }

  applyPulseBackGain();
  updateActiveGainDisplay();
  saveCurrentClipState();
}

function onSelectGainRegion(region: AudioGainRegion) {
  trimStart.value = region.startSec;
  trimEnd.value = region.endSec;
  currentTime.value = region.startSec;
  syncAudioCurrentTime(region.startSec);
  if (hasDualChannels.value) {
    if (region.channel === 0) {
      micGainMultiplier.value = region.multiplier;
    } else if (region.channel === 1) {
      inputGainMultiplier.value = region.multiplier;
    } else {
      micGainMultiplier.value = region.multiplier;
      inputGainMultiplier.value = region.multiplier;
    }
  } else {
    micGainMultiplier.value = region.multiplier;
  }
}

function onDeleteGainRegion(region: AudioGainRegion) {
  appliedGainRegions.value = appliedGainRegions.value.filter(r => {
    if (region.id && r.id) return r.id !== region.id;
    return !(
      (r.channel === region.channel || r.channel === undefined || region.channel === undefined) &&
      Math.abs(r.startSec - region.startSec) < 0.1 &&
      Math.abs(r.endSec - region.endSec) < 0.1
    );
  });
  applyPulseBackGain();
  updateActiveGainDisplay();
  saveCurrentClipState();
}

function onClearAllGainRegions() {
  appliedGainRegions.value = [];
  applyPulseBackGain();
  updateActiveGainDisplay();
  saveCurrentClipState();
}

function onResetAllGainRegions() {
  appliedGainRegions.value = appliedGainRegions.value.map(r => ({ ...r, multiplier: 1.0 }));
  applyPulseBackGain();
  updateActiveGainDisplay();
  saveCurrentClipState();
}

function resetTrimStart() {
  trimStart.value = 0;
  currentTime.value = 0;
  syncAudioCurrentTime(0);
  updateActiveGainDisplay();
  saveCurrentClipState();
}

function resetTrimEnd() {
  const dur = audioDuration.value;
  trimEnd.value = dur;
  if (currentTime.value > dur) {
    currentTime.value = dur;
    syncAudioCurrentTime(dur);
  }
  updateActiveGainDisplay();
  saveCurrentClipState();
}

function resetSelectionToExtents() {
  const dur = audioDuration.value;
  trimStart.value = 0;
  trimEnd.value = dur;
  currentTime.value = 0;
  syncAudioCurrentTime(0);
  updateActiveGainDisplay();
  saveCurrentClipState();
}

let isSwitchingClip = false;

watch(trimStart, (newStart, oldStart) => {
  if (!isSwitchingClip && oldStart !== undefined && newStart !== oldStart) {
    currentTime.value = newStart;
    syncAudioCurrentTime(newStart);
  }
});

watch(
  () => selectedClip.value?.id,
  async (_newId, oldId) => {
    stopPreview();
    isSwitchingClip = true;
    if (oldId) {
      const oldClip = pulseBackStore.clips.find(c => c.id === oldId);
      if (oldClip) {
        pulseBackStore.updateClip(oldId, {
          title: clipTitle.value,
          tags: clipTags.value ? [...clipTags.value] : [],
          trimStart: trimStart.value,
          trimEnd: trimEnd.value,
          currentTime: currentTime.value,
          volume: clipVolume.value,
          color: clipColor.value,
          includeMic: includeMic.value,
          includeInput: includeInput.value,
          micGain: globalMicGain.value,
          inputGain: globalInputGain.value,
          partialGains: appliedGainRegions.value ? [...appliedGainRegions.value] : [],
          segmentBoundaries: segmentBoundaries.value ? [...segmentBoundaries.value] : [],
        });
      }
    }
    if (!selectedClip.value) {
      isSwitchingClip = false;
      return;
    }

    const clip = selectedClip.value;
    clipTitle.value = clip.title;
    clipTags.value = clip.tags ? [...clip.tags] : ['clip'];
    trimStart.value = clip.trimStart ?? 0;
    trimEnd.value = clip.trimEnd ?? clip.duration;
    currentTime.value = clip.currentTime ?? trimStart.value;
    clipVolume.value = clip.volume ?? getDefaultVolumePercent();
    clipColor.value = clip.color ?? '#3b82f6';
    includeMic.value = clip.includeMic ?? true;
    includeInput.value = clip.includeInput ?? true;
    appliedGainRegions.value = clip.partialGains ? [...clip.partialGains] : [];
    globalMicGain.value = clip.micGain ?? 1.0;
    globalInputGain.value = clip.inputGain ?? 1.0;
    micGainMultiplier.value = clip.micGain ?? 1.0;
    inputGainMultiplier.value = clip.inputGain ?? 1.0;

    if (!clip.originalBlob && clip.blob) {
      clip.originalBlob = clip.blob;
    }
    if (clip.originalDuration === undefined) {
      clip.originalDuration = clip.duration;
    }
    if (!clip.originalFileName && clip.fileName) {
      clip.originalFileName = clip.fileName;
    }
    if (!clip.originalAudioUrl && clip.audioUrl) {
      clip.originalAudioUrl = clip.audioUrl;
    }
    originalAudioBuffer.value = null;

    syncAudioCurrentTime(currentTime.value);
    updateTrackVolumes();

    await loadAudioData(clip.blob, clip.segmentBoundaries);
    if (!clip.originalDuration || Math.abs(clip.duration - clip.originalDuration) < 0.05) {
      originalAudioBuffer.value = cleanBaseAudioBuffer.value;
    }
    nextTick(() => {
      isSwitchingClip = false;
    });
  },
  { immediate: true }
);

async function loadAudioData(blob: Blob, savedBoundaries?: number[]) {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = getAudioContext();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    cleanBaseAudioBuffer.value = decoded;

    // Restore multi-segment timeline if boundaries were saved
    if (savedBoundaries && savedBoundaries.length > 0) {
      let segs = createInitialSegments(decoded);
      for (const b of savedBoundaries) {
        if (b > 0.01 && b < decoded.duration - 0.01) {
          segs = splitTimelineAt(ctx, segs, b);
        }
      }
      timelineSegments.value = segs;
    } else {
      timelineSegments.value = createInitialSegments(decoded);
    }

    undoStack.value = [];
    redoStack.value = [];
    hasDualChannels.value = decoded.numberOfChannels >= 2;

    audioBuffer.value = applyGainToAudioBuffer(
      ctx,
      decoded,
      hasDualChannels.value ? [globalMicGain.value, globalInputGain.value] : globalMicGain.value,
      appliedGainRegions.value
    );

    if (selectedClip.value?.trimEnd !== undefined) {
      trimEnd.value = Math.min(audioBuffer.value.duration, selectedClip.value.trimEnd);
    } else {
      trimEnd.value = audioBuffer.value.duration;
    }
    if (selectedClip.value?.trimStart !== undefined) {
      trimStart.value = Math.max(0, Math.min(selectedClip.value.trimStart, trimEnd.value));
    }
    if (selectedClip.value?.currentTime !== undefined) {
      currentTime.value = Math.max(trimStart.value, Math.min(trimEnd.value, selectedClip.value.currentTime));
      syncAudioCurrentTime(currentTime.value);
    }

    updateActiveGainDisplay();
    updatePreviewUrls();
    updateTrackVolumes();
  } catch (err) {
    console.error('Failed to decode audio data for waveform:', err);
  }
}

function saveCurrentClipState(options?: { includeBlob?: boolean; }) {
  if (!selectedClip.value) return;
  const updates: Partial<PulseBackClip> = {
    title: clipTitle.value,
    tags: clipTags.value ? [...clipTags.value] : [],
    trimStart: trimStart.value,
    trimEnd: trimEnd.value,
    currentTime: currentTime.value,
    duration: selectedClip.value.duration,
    volume: clipVolume.value,
    color: clipColor.value,
    includeMic: includeMic.value,
    includeInput: includeInput.value,
    micGain: globalMicGain.value,
    inputGain: globalInputGain.value,
    partialGains: appliedGainRegions.value ? [...appliedGainRegions.value] : [],
    segmentBoundaries: segmentBoundaries.value ? [...segmentBoundaries.value] : [],
    originalDuration: selectedClip.value.originalDuration,
    originalFileName: selectedClip.value.originalFileName,
  };
  if (options?.includeBlob && selectedClip.value.blob) {
    updates.blob = selectedClip.value.blob;
  }
  pulseBackStore.updateClip(selectedClip.value.id, updates);
}

function pushUndoState() {
  undoStack.value.push({
    segments: [...timelineSegments.value],
    gainRegions: JSON.parse(JSON.stringify(appliedGainRegions.value)),
    trimStart: trimStart.value,
    trimEnd: trimEnd.value,
    currentTime: currentTime.value,
  });
  if (undoStack.value.length > 30) {
    undoStack.value.shift();
  }
  redoStack.value = [];
}

async function commitTimelineChange(
  newSegments: AudioTimelineSegment[],
  newTrimStart?: number,
  newTrimEnd?: number,
  newCurrentTime?: number
) {
  stopPreview();
  stopScrubSnippet();
  const ctx = getAudioContext();
  timelineSegments.value = newSegments;
  const composite = compositeSegments(ctx, newSegments);
  cleanBaseAudioBuffer.value = composite;
  hasDualChannels.value = composite.numberOfChannels >= 2;

  const dur = composite.duration;
  trimStart.value = newTrimStart !== undefined ? Math.max(0, Math.min(newTrimStart, dur)) : 0;
  trimEnd.value = newTrimEnd !== undefined ? Math.max(trimStart.value, Math.min(newTrimEnd, dur)) : dur;
  if (newCurrentTime !== undefined) {
    currentTime.value = Math.max(0, Math.min(newCurrentTime, dur));
  } else {
    currentTime.value = Math.max(0, Math.min(currentTime.value, dur));
  }

  applyPulseBackGain();

  const sampleRate = composite.sampleRate;
  let newBlob: Blob;
  if (composite.numberOfChannels >= 2) {
    newBlob = encodeWAV(composite.getChannelData(0), sampleRate, composite.getChannelData(1));
  } else {
    newBlob = encodeWAV(composite.getChannelData(0), sampleRate);
  }

  if (selectedClip.value) {
    selectedClip.value.duration = dur;
    selectedClip.value.blob = newBlob;
    if (selectedClip.value.audioUrl && selectedClip.value.audioUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(selectedClip.value.audioUrl);
      } catch { }
    }
    selectedClip.value.audioUrl = URL.createObjectURL(newBlob);
    selectedClip.value.trimStart = trimStart.value;
    selectedClip.value.trimEnd = trimEnd.value;
    selectedClip.value.currentTime = currentTime.value;
    selectedClip.value.segmentBoundaries = segmentBoundaries.value ? [...segmentBoundaries.value] : [];
  }

  updateActiveGainDisplay();
  updatePreviewUrls();
  saveCurrentClipState({ includeBlob: true });
}

function onCopyAudio() {
  const base = cleanBaseAudioBuffer.value;
  if (!base) return;
  const ctx = getAudioContext();
  const totalDur = audioDuration.value;
  const startSec = Math.max(0, trimStart.value);
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur);

  audioClipboard.value = copyAudioSelection(
    ctx,
    timelineSegments.value,
    startSec,
    endSec,
    activeTrackTarget.value
  );

  const numSegs = audioClipboard.value.segments?.length || 1;
  const segsLabel = numSegs > 1 ? ` (${numSegs} segments)` : '';
  const trackLabel = activeTrackTarget.value === 'both' ? 'Both tracks' : activeTrackTarget.value === 'mic' ? 'Mic track' : 'Input track';
  pulseBackStore.showToast(`Copied ${trackLabel} ${(endSec - startSec).toFixed(2)}s${segsLabel}`);
}

function onCutAudio() {
  if (!canCut.value) {
    pulseBackStore.showToast('Please select a region with trim handles to cut');
    return;
  }
  const base = cleanBaseAudioBuffer.value;
  if (!base) return;
  const ctx = getAudioContext();
  const totalDur = audioDuration.value;
  const startSec = Math.max(0, trimStart.value);
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur);
  if (endSec <= startSec + 0.005) return;

  pushUndoState();

  const { newSegments, clipboardData } = cutTimelineSegments(
    ctx,
    timelineSegments.value,
    startSec,
    endSec,
    activeTrackTarget.value
  );

  audioClipboard.value = clipboardData;

  const cutDuration = endSec - startSec;
  appliedGainRegions.value = appliedGainRegions.value
    .filter(r => !(r.startSec >= startSec && r.endSec <= endSec))
    .map(r => {
      if (r.startSec >= endSec) {
        return {
          ...r,
          startSec: Math.max(0, r.startSec - cutDuration),
          endSec: Math.max(0, r.endSec - cutDuration),
        };
      }
      return r;
    });

  // After cut, reveal whole clip (trimStart: 0, trimEnd: undefined -> dur), and set playhead to startSec
  commitTimelineChange(newSegments, 0, undefined, startSec);
  pulseBackStore.showToast(`Cut ${(cutDuration).toFixed(2)}s to clipboard`);
}

function onDeleteAudio() {
  if (!canCut.value) {
    pulseBackStore.showToast('Please select a region with trim handles to delete');
    return;
  }
  const base = cleanBaseAudioBuffer.value;
  if (!base) return;
  const ctx = getAudioContext();
  const totalDur = audioDuration.value;
  const startSec = Math.max(0, trimStart.value);
  const endSec = Math.min(totalDur, trimEnd.value > 0 ? trimEnd.value : totalDur);
  if (endSec <= startSec + 0.005) return;

  pushUndoState();

  const newSegments = deleteTimelineSegments(
    ctx,
    timelineSegments.value,
    startSec,
    endSec,
    activeTrackTarget.value
  );

  const deleteDuration = endSec - startSec;
  appliedGainRegions.value = appliedGainRegions.value
    .filter(r => !(r.startSec >= startSec && r.endSec <= endSec))
    .map(r => {
      if (r.startSec >= endSec) {
        return {
          ...r,
          startSec: Math.max(0, r.startSec - deleteDuration),
          endSec: Math.max(0, r.endSec - deleteDuration),
        };
      }
      return r;
    });

  commitTimelineChange(newSegments, 0, undefined, startSec);
  pulseBackStore.showToast(`Deleted ${(deleteDuration).toFixed(2)}s from timeline`);
}

function onPasteAudio() {
  if (!audioClipboard.value || !cleanBaseAudioBuffer.value) return;
  const ctx = getAudioContext();
  const totalDur = audioDuration.value;
  const pasteBuf = audioClipboard.value.buffer;
  const pasteSegs = audioClipboard.value.segments;

  pushUndoState();

  const hasSubSelection = (trimEnd.value > 0 && trimEnd.value < totalDur - 0.05) || trimStart.value > 0.05;
  const isCursorInsideSelection = hasSubSelection && (currentTime.value >= trimStart.value - 0.05 && currentTime.value <= trimEnd.value + 0.05);

  const shouldReplace = hasSubSelection && isCursorInsideSelection;
  const insertAtSec = shouldReplace ? trimStart.value : currentTime.value;
  const replaceEndSec = shouldReplace ? trimEnd.value : undefined;

  const { newSegments, timeDelta } = spliceTimelineSegments(
    ctx,
    timelineSegments.value,
    pasteBuf,
    insertAtSec,
    replaceEndSec,
    activeTrackTarget.value,
    pasteSegs
  );

  if (replaceEndSec !== undefined) {
    appliedGainRegions.value = appliedGainRegions.value
      .filter(r => !(r.startSec >= insertAtSec && r.endSec <= replaceEndSec))
      .map(r => {
        if (r.startSec >= replaceEndSec) {
          return {
            ...r,
            startSec: Math.max(0, r.startSec + timeDelta),
            endSec: Math.max(0, r.endSec + timeDelta),
          };
        }
        return r;
      });
  } else if (timeDelta !== 0) {
    appliedGainRegions.value = appliedGainRegions.value.map(r => {
      if (r.startSec >= insertAtSec) {
        return {
          ...r,
          startSec: Math.max(0, r.startSec + timeDelta),
          endSec: Math.max(0, r.endSec + timeDelta),
        };
      }
      return r;
    });
  }

  const newPos = insertAtSec + pasteBuf.duration;
  // After paste, keep full clip visible (trimStart: 0, trimEnd: undefined -> dur), and place playhead at newPos
  commitTimelineChange(newSegments, 0, undefined, newPos);

  const numSegs = pasteSegs?.length || 1;
  const segsLabel = numSegs > 1 ? ` (${numSegs} segments)` : '';
  const actionLabel = shouldReplace ? 'Replaced selection with' : 'Pasted';
  pulseBackStore.showToast(`${actionLabel} ${(pasteBuf.duration).toFixed(2)}s audio${segsLabel}`);
}

function onUndo() {
  if (!canUndo.value) return;
  const prev = undoStack.value.pop()!;
  redoStack.value.push({
    segments: [...timelineSegments.value],
    gainRegions: JSON.parse(JSON.stringify(appliedGainRegions.value)),
    trimStart: trimStart.value,
    trimEnd: trimEnd.value,
    currentTime: currentTime.value,
  });

  appliedGainRegions.value = prev.gainRegions;
  commitTimelineChange(prev.segments, prev.trimStart, prev.trimEnd, prev.currentTime);
  pulseBackStore.showToast('Undo audio edit');
}

function onRedo() {
  if (!canRedo.value) return;
  const next = redoStack.value.pop()!;
  undoStack.value.push({
    segments: [...timelineSegments.value],
    gainRegions: JSON.parse(JSON.stringify(appliedGainRegions.value)),
    trimStart: trimStart.value,
    trimEnd: trimEnd.value,
    currentTime: currentTime.value,
  });

  appliedGainRegions.value = next.gainRegions;
  commitTimelineChange(next.segments, next.trimStart, next.trimEnd, next.currentTime);
  pulseBackStore.showToast('Redo audio edit');
}

function setInToCurrentTime() {
  const t = Math.max(0, Math.min(audioDuration.value, currentTime.value));
  let start = t;
  let end = trimEnd.value;
  if (start > end) {
    end = start;
  }
  trimStart.value = start;
  trimEnd.value = end;
  updateActiveGainDisplay();
  saveCurrentClipState();
  pulseBackStore.showToast(`In point set to ${formatSeconds(start)} (I)`);
}

function setOutToCurrentTime() {
  const t = Math.max(0, Math.min(audioDuration.value, currentTime.value));
  let start = trimStart.value;
  let end = t;
  if (end < start) {
    start = end;
  }
  trimStart.value = start;
  trimEnd.value = end;
  updateActiveGainDisplay();
  saveCurrentClipState();
  pulseBackStore.showToast(`Out point set to ${formatSeconds(end)} (O)`);
}

function snapNearestHandleToBoundary() {
  const boundaries = segmentBoundaries.value;
  const maxDur = audioDuration.value;
  const targets = (boundaries && boundaries.length > 0)
    ? [0, ...boundaries, maxDur].sort((a, b) => a - b)
    : [0, maxDur];

  if (targets.length <= 1) return;

  const inVal = trimStart.value;
  const outVal = trimEnd.value;

  let bestInTarget = targets[0];
  let minInDist = Infinity;
  for (const t of targets) {
    const d = Math.abs(inVal - t);
    if (d < minInDist) {
      minInDist = d;
      bestInTarget = t;
    }
  }

  let bestOutTarget = targets[targets.length - 1];
  let minOutDist = Infinity;
  for (const t of targets) {
    const d = Math.abs(outVal - t);
    if (d < minOutDist) {
      minOutDist = d;
      bestOutTarget = t;
    }
  }

  // Snap the handle that is closer to an unsnapped target
  const inNeedsSnap = minInDist > 0.005;
  const outNeedsSnap = minOutDist > 0.005;

  if (inNeedsSnap && (!outNeedsSnap || minInDist <= minOutDist)) {
    trimStart.value = bestInTarget;
    if (trimStart.value > outVal) {
      trimEnd.value = trimStart.value;
    }
    updateActiveGainDisplay();
    saveCurrentClipState();
    pulseBackStore.showToast(`⚡ Snapped In point to ${formatSeconds(bestInTarget)} (S)`);
  } else if (outNeedsSnap) {
    trimEnd.value = bestOutTarget;
    if (trimEnd.value < inVal) {
      trimStart.value = trimEnd.value;
    }
    updateActiveGainDisplay();
    saveCurrentClipState();
    pulseBackStore.showToast(`⚡ Snapped Out point to ${formatSeconds(bestOutTarget)} (S)`);
  } else {
    pulseBackStore.showToast(`Both handles are already snapped to clip boundaries`);
  }
}

function snapInToNearestBoundary() {
  const boundaries = segmentBoundaries.value;
  const maxDur = audioDuration.value;
  const targets = (boundaries && boundaries.length > 0)
    ? [0, ...boundaries, maxDur].sort((a, b) => a - b)
    : [0, maxDur];

  const inVal = trimStart.value;
  const outVal = trimEnd.value;
  let bestTarget = targets[0];
  let minDist = Infinity;
  for (const t of targets) {
    const d = Math.abs(inVal - t);
    if (d < minDist) {
      minDist = d;
      bestTarget = t;
    }
  }

  trimStart.value = bestTarget;
  if (trimStart.value > outVal) {
    trimEnd.value = trimStart.value;
  }
  updateActiveGainDisplay();
  saveCurrentClipState();
  pulseBackStore.showToast(`⚡ Snapped In point to ${formatSeconds(bestTarget)} (Shift+I)`);
}

function snapOutToNearestBoundary() {
  const boundaries = segmentBoundaries.value;
  const maxDur = audioDuration.value;
  const targets = (boundaries && boundaries.length > 0)
    ? [0, ...boundaries, maxDur].sort((a, b) => a - b)
    : [0, maxDur];

  const inVal = trimStart.value;
  const outVal = trimEnd.value;
  let bestTarget = targets[targets.length - 1];
  let minDist = Infinity;
  for (const t of targets) {
    const d = Math.abs(outVal - t);
    if (d < minDist) {
      minDist = d;
      bestTarget = t;
    }
  }

  trimEnd.value = bestTarget;
  if (trimEnd.value < inVal) {
    trimStart.value = trimEnd.value;
  }
  updateActiveGainDisplay();
  saveCurrentClipState();
  pulseBackStore.showToast(`⚡ Snapped Out point to ${formatSeconds(bestTarget)} (Shift+O)`);
}

function snapSelectionToCurrentClip() {
  const boundaries = segmentBoundaries.value;
  const maxDur = audioDuration.value;
  const targets = (boundaries && boundaries.length > 0)
    ? [0, ...boundaries, maxDur].sort((a, b) => a - b)
    : [0, maxDur];

  const playhead = currentTime.value;
  let start = 0;
  let end = maxDur;

  for (let i = 0; i < targets.length - 1; i++) {
    const bStart = targets[i];
    const bEnd = targets[i + 1];
    if (playhead >= bStart - 0.01 && playhead <= bEnd + 0.01) {
      start = bStart;
      end = bEnd;
      break;
    }
  }

  trimStart.value = start;
  trimEnd.value = end;
  updateActiveGainDisplay();
  saveCurrentClipState();
  pulseBackStore.showToast(`⚡ Snapped selection to clip (${formatSeconds(start)} ➔ ${formatSeconds(end)}) (Shift+S)`);
}

function onKeyDown(e: KeyboardEvent) {
  const activeEl = document.activeElement;
  const tagName = activeEl?.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || (activeEl as HTMLElement)?.isContentEditable) {
    return;
  }

  if (e.key === 'Home') {
    e.preventDefault();
    currentTime.value = 0;
    syncAudioCurrentTime(0);
    return;
  } else if (e.key === 'End') {
    e.preventDefault();
    currentTime.value = audioDuration.value;
    syncAudioCurrentTime(audioDuration.value);
    return;
  }

  const isCtrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (!isCtrl) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (canCut.value) {
        e.preventDefault();
        onDeleteAudio();
      }
    } else if (key === 'i') {
      e.preventDefault();
      if (e.shiftKey) {
        snapInToNearestBoundary();
      } else {
        setInToCurrentTime();
      }
    } else if (key === 'o') {
      e.preventDefault();
      if (e.shiftKey) {
        snapOutToNearestBoundary();
      } else {
        setOutToCurrentTime();
      }
    } else if (key === 's') {
      e.preventDefault();
      if (e.shiftKey) {
        snapSelectionToCurrentClip();
      } else {
        snapNearestHandleToBoundary();
      }
    }
    return;
  }

  if (key === 'a') {
    e.preventDefault();
    resetSelectionToExtents();
  } else if (key === 'c' && !e.shiftKey) {
    if (canCopy.value) {
      e.preventDefault();
      onCopyAudio();
    }
  } else if (key === 'x' && !e.shiftKey) {
    if (canCut.value) {
      e.preventDefault();
      onCutAudio();
    }
  } else if (key === 'v' && !e.shiftKey) {
    if (canPaste.value) {
      e.preventDefault();
      onPasteAudio();
    }
  } else if (key === 'z') {
    if (e.shiftKey) {
      if (canRedo.value) {
        e.preventDefault();
        onRedo();
      }
    } else {
      if (canUndo.value) {
        e.preventDefault();
        onUndo();
      }
    }
  } else if (key === 'y' && !e.shiftKey) {
    if (canRedo.value) {
      e.preventDefault();
      onRedo();
    }
  }
}

function toggleMicTrack() {
  includeMic.value = !includeMic.value;
  updateTrackVolumes();
  saveCurrentClipState();
}

function toggleInputTrack() {
  includeInput.value = !includeInput.value;
  updateTrackVolumes();
  saveCurrentClipState();
}

function selectClip(clip: PulseBackClip) {
  if (pulseBackStore.selectedClipId === clip.id) return;
  saveCurrentClipState();
  pulseBackStore.selectClip(clip.id);
}

function onTitleInput() {
  if (selectedClip.value && clipTitle.value.trim().length > 0) {
    selectedClip.value.title = clipTitle.value;
  }
}

async function onTitleChange() {
  if (!selectedClip.value) return;
  const newTitle = clipTitle.value.trim();
  if (!newTitle) {
    clipTitle.value = selectedClip.value.title || 'Untitled Clip';
    return;
  }
  clipTitle.value = newTitle;
  selectedClip.value.title = newTitle;
  saveCurrentClipState();
}

function onTagsChange(tags?: string[]) {
  if (!selectedClip.value) return;
  clipTags.value = tags || [];
  selectedClip.value.tags = [...clipTags.value];
  saveCurrentClipState();
}

function onVolumeChange() {
  updateTrackVolumes();
  saveCurrentClipState();
}

function onColorChange() {
  saveCurrentClipState();
}

async function deleteClip(id: string) {
  stopPreview();
  clearPreviewUrls();
  await pulseBackStore.deleteClip(id);
}

async function duplicateClip(id: string) {
  stopPreview();
  saveCurrentClipState();
  await pulseBackStore.duplicateClip(id);
}

async function resetTrim() {
  if (!selectedClip.value) return;

  stopPreview();
  stopScrubSnippet();

  const clip = selectedClip.value;

  // Determine if this clip has been trimmed down from its original audio
  const hasOriginal = !!clip.originalBlob || (clip.originalDuration !== undefined && clip.originalDuration > 0);
  const isTrimmed = hasOriginal && (
    (clip.originalDuration !== undefined && Math.abs(clip.duration - clip.originalDuration) > 0.05) ||
    (clip.originalBlob && clip.originalBlob !== clip.blob)
  );

  if (isTrimmed) {
    // If the trimmed file on disk was different from the original file, clean up the trimmed file
    if (clip.fileName && clip.originalFileName && clip.fileName !== clip.originalFileName && window.electron?.deleteClipFile) {
      try {
        await window.electron.deleteClipFile(clip.fileName);
      } catch (e) {
        console.warn('[PulseBack] Failed to cleanup trimmed clip file:', e);
      }
    }

    let origBlob = clip.originalBlob;
    if (!origBlob && clip.originalFileName && window.electron?.readClipFile) {
      try {
        const buffer = await window.electron.readClipFile(clip.originalFileName);
        if (buffer) {
          origBlob = new Blob([buffer], { type: 'audio/wav' });
          clip.originalBlob = origBlob;
        }
      } catch (e) {
        console.warn('[PulseBack] Failed to read original clip file:', e);
      }
    }

    if (origBlob) {
      if (clip.audioUrl && clip.audioUrl.startsWith('blob:') && clip.audioUrl !== clip.originalAudioUrl) {
        try {
          URL.revokeObjectURL(clip.audioUrl);
        } catch { }
      }

      clip.blob = origBlob;
      clip.duration = clip.originalDuration || clip.duration;
      if (clip.originalFileName) {
        clip.fileName = clip.originalFileName;
      }
      if (clip.originalAudioUrl) {
        clip.audioUrl = clip.originalAudioUrl;
      } else {
        clip.audioUrl = URL.createObjectURL(origBlob);
        clip.originalAudioUrl = clip.audioUrl;
      }

      clip.trimStart = 0;
      clip.trimEnd = clip.duration;
      clip.currentTime = 0;

      if (originalAudioBuffer.value) {
        cleanBaseAudioBuffer.value = originalAudioBuffer.value;
        timelineSegments.value = createInitialSegments(originalAudioBuffer.value);
        hasDualChannels.value = originalAudioBuffer.value.numberOfChannels >= 2;
        applyPulseBackGain();
        trimStart.value = 0;
        trimEnd.value = originalAudioBuffer.value.duration;
        currentTime.value = 0;
        updatePreviewUrls();
        updateTrackVolumes();
        syncAudioCurrentTime(0);
      } else {
        await loadAudioData(origBlob);
        originalAudioBuffer.value = cleanBaseAudioBuffer.value;
      }

      await pulseBackStore.updateClip(clip.id, {
        duration: clip.duration,
        blob: origBlob,
        fileName: clip.fileName,
        audioUrl: clip.audioUrl,
        trimStart: 0,
        trimEnd: clip.duration,
        currentTime: 0,
        originalDuration: clip.originalDuration,
        originalFileName: clip.originalFileName,
        micGain: globalMicGain.value,
        inputGain: globalInputGain.value,
        partialGains: appliedGainRegions.value ? [...appliedGainRegions.value] : [],
      });
    }
  } else {
    // Untrimmed clip: re-apply gains to cleanBaseAudioBuffer (preserving appliedGainRegions)
    applyPulseBackGain();
  }

  const duration = audioDuration.value;
  trimStart.value = 0;
  trimEnd.value = duration;
  currentTime.value = 0;
  updateActiveGainDisplay();
  updatePreviewUrls();
  updateTrackVolumes();
  syncAudioCurrentTime(0);
  saveCurrentClipState();
}

const canTrimToSelection = computed(() => {
  if (!audioBuffer.value || !selectedClip.value) return false;
  const dur = audioDuration.value;
  return trimEnd.value > trimStart.value && (trimStart.value > 0.01 || trimEnd.value < dur - 0.01);
});

async function trimToSelection() {
  if (!audioBuffer.value || !selectedClip.value || !canTrimToSelection.value) return;

  stopPreview();
  stopScrubSnippet();

  const sampleRate = audioBuffer.value.sampleRate;
  const startSec = trimStart.value;
  const endSec = trimEnd.value;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(audioBuffer.value.length, Math.floor(endSec * sampleRate));
  const newLength = Math.max(0, endSample - startSample);
  if (newLength <= 0) return;

  const newDuration = newLength / sampleRate;

  const clip = selectedClip.value;
  const clipId = clip.id;

  // Preserve original audio properties before first trim
  if (!clip.originalBlob) {
    clip.originalBlob = clip.blob;
  }
  if (clip.originalDuration === undefined) {
    clip.originalDuration = clip.duration;
  }
  if (!clip.originalFileName) {
    clip.originalFileName = clip.fileName;
  }
  if (!clip.originalAudioUrl) {
    clip.originalAudioUrl = clip.audioUrl;
  }
  if (!originalAudioBuffer.value) {
    originalAudioBuffer.value = cleanBaseAudioBuffer.value || audioBuffer.value;
  }

  // Create new AudioBuffer for the trimmed selection from clean base audio (raw un-gained audio)
  const ctx = getAudioContext();
  const cleanBase = cleanBaseAudioBuffer.value || originalAudioBuffer.value || audioBuffer.value;
  const newCleanBuf = ctx.createBuffer(cleanBase.numberOfChannels, newLength, sampleRate);
  for (let ch = 0; ch < cleanBase.numberOfChannels; ch++) {
    newCleanBuf.getChannelData(ch).set(cleanBase.getChannelData(ch).subarray(startSample, endSample));
  }
  cleanBaseAudioBuffer.value = newCleanBuf;
  timelineSegments.value = createInitialSegments(newCleanBuf);
  const hasDual = newCleanBuf.numberOfChannels >= 2;
  hasDualChannels.value = hasDual;

  // appliedGainRegions is globally defined: NO modification needed!

  let newBlob: Blob;
  if (hasDual) {
    const micSlice = newCleanBuf.getChannelData(0);
    const inputSlice = newCleanBuf.getChannelData(1);
    newBlob = encodeWAV(micSlice, sampleRate, inputSlice);
  } else {
    const micSlice = newCleanBuf.getChannelData(0);
    newBlob = encodeWAV(micSlice, sampleRate);
  }

  clip.duration = newDuration;
  clip.blob = newBlob;
  if (clip.audioUrl && clip.audioUrl.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(clip.audioUrl);
    } catch { }
  }
  clip.audioUrl = URL.createObjectURL(newBlob);
  clip.trimStart = 0;
  clip.trimEnd = newDuration;
  clip.currentTime = 0;

  trimStart.value = 0;
  trimEnd.value = newDuration;
  currentTime.value = 0;

  // Apply gains to the clean trimmed buffer and update preview players
  applyPulseBackGain();
  updateActiveGainDisplay();
  syncAudioCurrentTime(0);

  await pulseBackStore.updateClip(clipId, {
    duration: newDuration,
    blob: newBlob,
    trimStart: 0,
    trimEnd: newDuration,
    currentTime: 0,
    originalDuration: clip.originalDuration,
    originalFileName: clip.originalFileName,
    originalBlob: clip.originalBlob,
    originalAudioUrl: clip.originalAudioUrl,
    micGain: globalMicGain.value,
    inputGain: globalInputGain.value,
    partialGains: appliedGainRegions.value ? [...appliedGainRegions.value] : [],
  });
}

function playTrimmedOnly() {
  if (isPlaying.value) {
    stopPreview();
    return;
  }
  startPlayback(trimStart.value, trimEnd.value);
}

function togglePlayPreview() {
  if (isPlaying.value) {
    stopPreview();
    saveCurrentClipState();
  } else {
    const startFrom =
      currentTime.value >= trimEnd.value || currentTime.value < trimStart.value
        ? trimStart.value
        : currentTime.value;
    startPlayback(startFrom, trimEnd.value);
  }
}

function onStopBtnClick() {
  stopPreview();
  currentTime.value = trimStart.value;
  syncAudioCurrentTime(trimStart.value);
  saveCurrentClipState();
}

async function startPlayback(offsetSec: number, endSec: number) {
  const micEl = micAudioElRef.value;
  const inputEl = inputAudioElRef.value;
  if (!selectedClip.value) return;

  if (!micPreviewUrl.value && audioBuffer.value) {
    updatePreviewUrls();
  }

  playbackEndSec = endSec;
  if (micEl) micEl.currentTime = offsetSec;
  if (hasDualChannels.value && inputEl) {
    inputEl.currentTime = offsetSec;
  }
  updateTrackVolumes();
  currentTime.value = offsetSec;

  try {
    const playPromises: Promise<void>[] = [];
    if (micEl && (includeMic.value || !hasDualChannels.value)) {
      playPromises.push(micEl.play());
    }
    if (hasDualChannels.value && inputEl && includeInput.value) {
      playPromises.push(inputEl.play());
    }
    // Fallback: if both are currently muted/toggled off, still start micEl for clock tracking
    if (playPromises.length === 0 && micEl) {
      playPromises.push(micEl.play());
    }
    await Promise.all(playPromises);
    isPlaying.value = true;
    updatePlaybackAnimation();
  } catch (err) {
    console.error('Audio play error:', err);
  }
}

// Scrubbing & Trim State for Audio Playback
let isScrubbing = false;
let wasPlayingBeforeScrub = false;
let scrubSourceNode: AudioBufferSourceNode | null = null;
let scrubGainNode: GainNode | null = null;
let lastScrubPlayTime = 0;

function updatePlaybackAnimation() {
  if (isScrubbing) return;
  const micEl = micAudioElRef.value;
  const inputEl = inputAudioElRef.value;
  if (!isPlaying.value || (!micEl && !inputEl)) return;

  // Use the active element for clock
  const masterEl =
    hasDualChannels.value && !includeMic.value && includeInput.value && inputEl
      ? inputEl
      : micEl;

  if (!masterEl) return;

  // Playhead directly tracks native HTML5 audio clock with zero latency
  currentTime.value = masterEl.currentTime;

  if (currentTime.value >= playbackEndSec || masterEl.ended) {
    stopPreview();
    currentTime.value = trimStart.value;
    syncAudioCurrentTime(trimStart.value);
    return;
  }

  playbackAnimationId = requestAnimationFrame(updatePlaybackAnimation);
}

function stopPreview() {
  if (micAudioElRef.value) {
    micAudioElRef.value.pause();
  }
  if (inputAudioElRef.value) {
    inputAudioElRef.value.pause();
  }
  if (playbackAnimationId) {
    cancelAnimationFrame(playbackAnimationId);
    playbackAnimationId = null;
  }
  isPlaying.value = false;
}

function onAudioEnded() {
  if (isScrubbing) return;
  stopPreview();
  currentTime.value = trimStart.value;
  syncAudioCurrentTime(trimStart.value);
  saveCurrentClipState();
}

function onAudioTimeUpdate() {
  if (isScrubbing) return;
  const micEl = micAudioElRef.value;
  if (!isPlaying.value || !micEl) return;
  if (micEl.currentTime >= playbackEndSec || micEl.ended) {
    stopPreview();
    currentTime.value = trimStart.value;
    syncAudioCurrentTime(trimStart.value);
  }
}

function onAudioMetadataLoaded() {
  if (!isScrubbing) {
    syncAudioCurrentTime(currentTime.value);
  }
}

function stopScrubSnippet() {
  if (scrubSourceNode) {
    try {
      scrubSourceNode.stop();
      scrubSourceNode.disconnect();
    } catch { }
    scrubSourceNode = null;
  }
  if (scrubGainNode) {
    try {
      scrubGainNode.disconnect();
    } catch { }
    scrubGainNode = null;
  }
}

function playScrubSnippet(sec: number) {
  if (!audioBuffer.value) return;
  const now = performance.now();
  // Throttle snippet triggering so rapid mouse events don't pile up
  if (now - lastScrubPlayTime < 45) return;
  lastScrubPlayTime = now;

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => { });
  }

  stopScrubSnippet();

  const duration = 0.08; // 80ms snippet
  const startSec = Math.max(0, Math.min(audioBuffer.value.duration - 0.02, sec));
  const snippetLen = Math.min(duration, audioBuffer.value.duration - startSec);
  if (snippetLen <= 0) return;

  const masterVol = clipVolume.value / 100;
  const bothActive = includeMic.value && includeInput.value && hasDualChannels.value;
  const factor = bothActive ? 0.75 : 1.0;

  const sampleRate = audioBuffer.value.sampleRate;
  const sampleCount = Math.floor(snippetLen * sampleRate);
  if (sampleCount <= 0) return;

  const startSample = Math.floor(startSec * sampleRate);
  const snippetBuffer = audioContext.createBuffer(1, sampleCount, sampleRate);
  const channelData = snippetBuffer.getChannelData(0);

  const micData = includeMic.value ? audioBuffer.value.getChannelData(0) : null;
  const inputData =
    hasDualChannels.value && includeInput.value && audioBuffer.value.numberOfChannels >= 2
      ? audioBuffer.value.getChannelData(1)
      : null;

  for (let i = 0; i < sampleCount; i++) {
    const idx = startSample + i;
    if (idx >= audioBuffer.value.length) break;
    let s = 0;
    if (micData) s += micData[idx] * factor;
    if (inputData) s += inputData[idx] * factor;
    channelData[i] = s;
  }

  // Quick 6ms fade-in and fade-out to prevent clicks
  const fadeSamples = Math.min(Math.floor(sampleRate * 0.006), Math.floor(sampleCount / 4));
  for (let i = 0; i < fadeSamples; i++) {
    const ramp = i / fadeSamples;
    channelData[i] *= ramp;
    channelData[sampleCount - 1 - i] *= ramp;
  }

  const source = audioContext.createBufferSource();
  source.buffer = snippetBuffer;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(masterVol, audioContext.currentTime);

  source.connect(gain);
  gain.connect(audioContext.destination);

  scrubSourceNode = source;
  scrubGainNode = gain;

  source.onended = () => {
    if (scrubSourceNode === source) {
      scrubSourceNode = null;
      scrubGainNode = null;
    }
  };

  source.start(0);
}

function onScrubStart(_sec: number) {
  isScrubbing = true;
  wasPlayingBeforeScrub = isPlaying.value;
  stopPreview();
}

function onScrubMove(sec: number) {
  playScrubSnippet(sec);
}

function onScrubEnd(sec: number) {
  isScrubbing = false;
  stopScrubSnippet();
  syncAudioCurrentTime(sec);
  const resume = wasPlayingBeforeScrub;
  wasPlayingBeforeScrub = false;
  saveCurrentClipState();
  if (resume) {
    const startFrom =
      currentTime.value >= trimEnd.value || currentTime.value < trimStart.value
        ? trimStart.value
        : currentTime.value;
    startPlayback(startFrom, trimEnd.value);
  }
}

function onTrimChange(payload: { start: number; end: number; handle?: 'start' | 'end'; }) {
  if (isPlaying.value) {
    stopPreview();
  }
  trimStart.value = payload.start;
  trimEnd.value = payload.end;
  if (payload.handle !== 'end') {
    currentTime.value = payload.start;
    syncAudioCurrentTime(payload.start);
  } else if (currentTime.value > payload.end) {
    currentTime.value = payload.start;
    syncAudioCurrentTime(payload.start);
  }
  updateActiveGainDisplay();
}

function onTrimEndChange() {
  updateActiveGainDisplay();
  saveCurrentClipState();
}

async function getTrimmedAudioBlob(
  format: 'mp3' | 'wav' | 'ogg' = 'mp3'
): Promise<{ blob: Blob; duration: number; extension: string; } | null> {
  if (!audioBuffer.value) return null;

  const sampleRate = audioBuffer.value.sampleRate;
  const startSample = Math.max(0, Math.floor(trimStart.value * sampleRate));
  const endSample = Math.min(audioBuffer.value.length, Math.floor(trimEnd.value * sampleRate));
  const length = Math.max(0, endSample - startSample);

  const slicedSamples = new Float32Array(length);
  const micData = audioBuffer.value.getChannelData(0).subarray(startSample, endSample);
  const hasSecondChannel = audioBuffer.value.numberOfChannels >= 2;
  const inputData = hasSecondChannel ? audioBuffer.value.getChannelData(1).subarray(startSample, endSample) : null;

  if (includeMic.value && (!hasSecondChannel || !includeInput.value || !inputData)) {
    slicedSamples.set(micData);
  } else if (!includeMic.value && hasSecondChannel && includeInput.value && inputData) {
    slicedSamples.set(inputData);
  } else if (hasSecondChannel && inputData && includeMic.value && includeInput.value) {
    for (let i = 0; i < length; i++) {
      slicedSamples[i] = Math.max(-1, Math.min(1, (micData[i] + inputData[i]) * 0.75));
    }
  } else {
    slicedSamples.set(micData);
  }

  const duration = slicedSamples.length / sampleRate;
  let blob: Blob;
  let extension: string;

  if (format === 'mp3') {
    blob = await encodeMP3(slicedSamples, sampleRate, 192);
    extension = 'mp3';
  } else if (format === 'ogg') {
    blob = await encodeOGG(slicedSamples, sampleRate, 3);
    extension = 'ogg';
  } else {
    blob = encodeWAV(slicedSamples, sampleRate);
    extension = 'wav';
  }

  return { blob, duration, extension };
}

async function publishToSoundboard() {
  if (!selectedClip.value || !audioBuffer.value || isPublishing.value || isSavingFile.value) return;

  isPublishing.value = true;
  try {
    const format = exportFormat.value;
    const trimmed = await getTrimmedAudioBlob(format);
    if (!trimmed) return;

    await pulseBackStore.publishToSoundboard(selectedClip.value.id, trimmed.blob, trimmed.duration, {
      title: clipTitle.value.trim() || selectedClip.value.title,
      tags: clipTags.value ? [...clipTags.value] : [],
      color: clipColor.value,
      volume: clipVolume.value,
    }, {
      deleteAfterPublish: deleteAfterPublish.value,
      navigateToSoundboard: false,
      format,
      extension: trimmed.extension,
    });
  } catch (err) {
    console.error('Failed to publish clip to soundboard:', err);
  } finally {
    isPublishing.value = false;
  }
}

async function saveToFile() {
  if (!selectedClip.value || !audioBuffer.value || isSavingFile.value || isPublishing.value) return;

  isSavingFile.value = true;
  try {
    const format = exportFormat.value;
    const trimmed = await getTrimmedAudioBlob(format);
    if (!trimmed) return;

    const rawTitle = clipTitle.value.trim() || selectedClip.value.title || 'pulse_back_clip';
    const sanitizedTitle = rawTitle.replace(/[<>:"/\\|?*]/g, '_').trim() || 'pulse_back_clip';
    const baseName = sanitizedTitle.replace(/\.(mp3|wav|ogg)$/i, '');
    const defaultFilename = `${baseName}.${trimmed.extension}`;

    if (window.electron?.saveFileDialog) {
      const arrayBuffer = await trimmed.blob.arrayBuffer();
      const formatFilterMap: Record<'mp3' | 'wav' | 'ogg', { name: string; extensions: string[]; }> = {
        mp3: { name: 'MP3 Audio (*.mp3)', extensions: ['mp3'] },
        ogg: { name: 'OGG Audio (*.ogg)', extensions: ['ogg'] },
        wav: { name: 'WAV Audio (*.wav)', extensions: ['wav'] },
      };
      const filters = [formatFilterMap[format]];

      const saved = await window.electron.saveFileDialog(defaultFilename, arrayBuffer, filters);
      if (saved) {
        pulseBackStore.showToast(`Saved "${defaultFilename}"`);
      }
    } else {
      const url = URL.createObjectURL(trimmed.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      pulseBackStore.showToast(`Downloaded "${defaultFilename}"`);
    }
  } catch (err) {
    console.error('Failed to save audio file:', err);
    pulseBackStore.showToast('Failed to save audio file');
  } finally {
    isSavingFile.value = false;
  }
}

function formatSeconds(secs: number): string {
  if (isNaN(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

onUnmounted(() => {
  stopPreview();
  stopScrubSnippet();
  saveCurrentClipState();
  clearPreviewUrls();
});
</script>

<style scoped>
.pulse-back-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--background-color, #121214);
  color: #e4e4e7;
  overflow: hidden;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.25rem;
  background: #18181b;
  border-bottom: 1px solid #27272a;
  position: relative;
  z-index: 30;
}

.view-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

.header-subtitle {
  font-size: 0.8rem;
  color: #a1a1aa;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Left Rail */
.clips-rail {
  width: 280px;
  border-right: 1px solid #27272a;
  background: #18181b;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rail-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #27272a;
  font-size: 0.85rem;
  font-weight: 600;
  color: #d4d4d8;
}

.empty-clips {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.25rem;
  text-align: center;
  flex: 1;
}

.clips-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.clip-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.75rem;
  background: #27272a;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-wrap: wrap;
}

.clip-card:hover {
  background: #323236;
}

.clip-card.active {
  background: #1e3a8a;
  border-color: #3b82f6;
}

.clip-card-main {
  max-width: 100%;
}

.clip-card-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: white;
  overflow: hidden;
  max-width: 100%;
  word-wrap: break-word;
}

.clip-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: #a1a1aa;
  margin-top: 0.2rem;
}

.clip-card-meta>.time {
  min-width: max-content;
}

.duration-badge {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-family: monospace;
}

.clip-card-actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.clip-card-btn {
  background: transparent;
  border: none;
  color: #71717a;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.duplicate-clip-btn:hover {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
}

.delete-clip-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* Studio Main */
.studio-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  gap: 1rem;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  min-width: min-content;
}

.clip-info-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1c1c20;
  padding: 0.85rem 1.25rem;
  border-radius: 10px;
  border: 1px solid #2e2e34;
  flex-wrap: wrap;
  min-width: min-content;
  gap: 0.5rem;
}

.title-input-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  max-width: 450px;
}

.title-input-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #a1a1aa;
}

.clip-title-input {
  flex: 1;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  padding: 0.45rem 0.75rem;
  color: white;
  font-size: 0.9rem;
}

.duplicate-toolbar-btn {
  display: flex;
  align-items: center;
  padding: 0.45rem 0.85rem;
  background: #27272a;
  color: #d4d4d8;
  border: 1px solid #3f3f46;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.duplicate-toolbar-btn:hover {
  background: #3f3f46;
  color: #ffffff;
  border-color: #38bdf8;
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

.play-btn:hover {
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
}

.stop-btn:hover {
  background: #3f3f46;
  color: white;
}

.stop-btn:focus-visible {
  outline: 2px solid var(--active-color, #38bdf8);
  outline-offset: 3px;
  background: #3f3f46;
  color: white;
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
  outline: 2px solid #38bdf8;
  outline-offset: 1px;
}

.time-readout.clickable:active {
  transform: scale(0.96);
  background: rgba(255, 255, 255, 0.14);
}
/* Waveform Container */
.waveform-container {
  --slide-duration: 0.28s;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: min-content;
}

.waveform-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: #e4e4e7;
  gap: 0.25rem;
  /* flex-wrap: wrap; */
}



/* Trim Summary Bar */
.trim-summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1c1c20;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  border: 1px solid #2e2e34;
}

.trim-stats {
  display: flex;
  gap: 0.75rem;
}

.stat-pill {
  font-size: 0.8rem;
  color: #a1a1aa;
}

.stat-pill strong {
  color: white;
}

.trim-quick-actions {
  display: flex;
  gap: 0.5rem;
}

.secondary-btn {
  padding: 0.35rem 0.75rem;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  color: #e4e4e7;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.secondary-btn:hover:not(:disabled) {
  background: #3f3f46;
  color: white;
}

.secondary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Publish Card */
.publish-card {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: min-content;
}

.publish-heading {
  font-size: 1rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

.publish-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.publish-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.publish-field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #a1a1aa;
}

.color-picker-input {
  width: 40px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #3f3f46;
  background: transparent;
}

.publish-field :deep(.tag-input) {
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  min-height: 38px;
  box-sizing: border-box;
}

.publish-field :deep(.tag-input:focus-within) {
  border-color: #3b82f6;
  outline: none;
}

.volume-slider {
  width: 100%;
}

.format-toggle-group {
  display: inline-flex;
  background: #27272a;
  border-radius: 6px;
  padding: 2px;
  border: 1px solid #3f3f46;
  width: fit-content;
}

.format-toggle-btn {
  padding: 0.35rem 0.85rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.15s ease;
}

.format-toggle-btn:hover {
  color: white;
}

.format-toggle-btn.active {
  background: #3b82f6;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.publish-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  border-top: 1px solid #27272a;
  padding-top: 1rem;
  flex-wrap: wrap;
}

.publish-options {
  display: flex;
  align-items: center;
}

.publish-option-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: #a1a1aa;
  cursor: pointer;
  user-select: none;
}

.publish-option-label:hover {
  color: #e4e4e7;
}

.publish-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #3b82f6;
  cursor: pointer;
  border-radius: 4px;
}

.publish-buttons {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.save-file-btn {
  display: flex;
  align-items: center;
  padding: 0.65rem 1.25rem;
  background: #27272a;
  color: #e4e4e7;
  border: 1px solid #3f3f46;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.save-file-btn:hover:not(:disabled) {
  background: #3f3f46;
  color: #ffffff;
  border-color: #52525b;
  transform: translateY(-1px);
}

.save-file-btn:focus-visible:not(:disabled) {
  outline: 2px solid var(--active-color, #38bdf8);
  outline-offset: 2px;
  background: #3f3f46;
  color: #ffffff;
  border-color: #52525b;
}

.save-file-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.publish-btn {
  display: flex;
  align-items: center;
  padding: 0.65rem 1.5rem;
  background: #10b981;
  color: white;
  font-size: 0.9rem;
  font-weight: 700;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.publish-btn:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
}

.publish-btn:focus-visible:not(:disabled) {
  outline: 2px solid var(--active-color, #10b981);
  outline-offset: 3px;
  background: #059669;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.5);
}

.publish-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.studio-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

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
  gap: 0.5rem;
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
  border-radius: 8px;
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
</style>
