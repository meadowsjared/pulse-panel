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
                <span>{{ formatTime(clip.createdAt) }}</span>
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
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
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
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
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
              <span class="time-readout">
                {{ formatSeconds(relativeCurrentTime) }} / {{ formatSeconds(trimmedDuration) }}
              </span>
            </span>

            <!-- Audio Tracks Selector (Mic & Input Device Mute/Unmute) -->
            <div v-if="hasDualChannels"
                 class="audio-tracks-bar">
              <span>Waveform Trimmer</span>
              <button :class="['track-toggle-btn', 'mic-track-btn', { active: includeMic, muted: !includeMic }]"
                      @click="toggleMicTrack"
                      :title="includeMic ? 'Mute Microphone in this clip' : 'Unmute Microphone in this clip'">
                <inline-svg :src="includeMic ? MicrophoneIcon : MicrophoneSlashIcon"
                            class="w-4 h-4" />
                <span class="track-name">Microphone</span>
                <span class="track-badge">{{ includeMic ? 'ON' : 'OFF' }}</span>
              </button>

              <button :class="['track-toggle-btn', 'input-track-btn', { active: includeInput, muted: !includeInput }]"
                      @click="toggleInputTrack"
                      :title="includeInput ? 'Mute Input Device in this clip' : 'Unmute Input Device in this clip'">
                <inline-svg :src="includeInput ? SpeakerIcon : HeadphonesIcon"
                            class="w-4 h-4" />
                <span class="track-name">Input</span>
                <span class="track-badge">{{ includeInput ? 'ON' : 'OFF' }}</span>
              </button>
            </div>


          </div>

          <waveform-graph :audio-buffer="audioBuffer"
                          :duration="audioDuration"
                          :tracks="pulseBackTracks"
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


        <!-- Trim Range Summary Bar -->
        <div class="trim-summary-bar">
          <div class="trim-stats">
            <span class="stat-pill"><strong>Selected:</strong> {{ formatSeconds(trimmedDuration) }}</span>
            <span class="stat-pill"><strong>Start:</strong> {{ formatSeconds(trimStart) }}</span>
            <span class="stat-pill"><strong>End:</strong> {{ formatSeconds(trimEnd) }}</span>
          </div>

          <div class="trim-quick-actions">
            <button v-if="canTrimToSelection"
                    class="secondary-btn"
                    title="Discard audio outside In and Out points to refine selection"
                    @click="trimToSelection">Trim to Selection</button>
            <button class="secondary-btn"
                    @click="resetTrim">Reset Trim</button>
            <button class="secondary-btn"
                    @click="playTrimmedOnly">Play Trimmed</button>
          </div>
        </div>

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
import { ref, computed, shallowRef, watch, onUnmounted } from 'vue';
import InlineSvg from 'vue-inline-svg';
import { usePulseBackStore, PulseBackClip } from '../store/pulseBack';
import { useSettingsStore } from '../store/settings';
import { TagInputRef } from './BaseComponents/TagInputTypes';
import { encodeWAV, encodeMP3, encodeOGG } from '../services/pulseBackBuffer';
import WaveformGraph, { WaveformTrack } from './WaveformGraph.vue';
import MicrophoneIcon from '../assets/images/microphone.svg';
import MicrophoneSlashIcon from '../assets/images/microphone-slash.svg';
import SpeakerIcon from '../assets/images/speaker.svg';
import HeadphonesIcon from '../assets/images/headphones.svg';

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
const clipColor = ref('#3b82f6');
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
const audioBuffer = shallowRef<AudioBuffer | null>(null);
let audioContext: AudioContext | null = null;

// Dual-Track State
const includeMic = ref(true);
const includeInput = ref(true);
const hasDualChannels = ref(false);

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
      micAudioElRef.value.play().catch(() => {});
    }
  }
  if (inputAudioElRef.value) {
    inputAudioElRef.value.muted = !includeInput.value;
    inputAudioElRef.value.volume = includeInput.value ? masterVol * factor : 0;
    if (isPlaying.value && includeInput.value && inputAudioElRef.value.paused) {
      inputAudioElRef.value.currentTime = currentTime.value;
      inputAudioElRef.value.play().catch(() => {});
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

watch(
  () => selectedClip.value?.id,
  async (_newId, oldId) => {
    stopPreview();
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
        });
      }
    }
    if (!selectedClip.value) return;

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

    syncAudioCurrentTime(currentTime.value);
    updateTrackVolumes();

    await loadAudioData(clip.blob);
  },
  { immediate: true }
);

async function loadAudioData(blob: Blob) {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioContext) {
      audioContext = new AudioContextClass();
    }
    audioBuffer.value = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    hasDualChannels.value = audioBuffer.value.numberOfChannels >= 2;
    if (selectedClip.value?.trimEnd !== undefined && selectedClip.value.trimEnd > 0) {
      trimEnd.value = Math.min(audioBuffer.value.duration, selectedClip.value.trimEnd);
    } else {
      trimEnd.value = audioBuffer.value.duration;
    }
    if (selectedClip.value?.trimStart !== undefined) {
      trimStart.value = Math.max(0, Math.min(selectedClip.value.trimStart, trimEnd.value - 0.05));
    }
    if (selectedClip.value?.currentTime !== undefined) {
      currentTime.value = Math.max(trimStart.value, Math.min(trimEnd.value, selectedClip.value.currentTime));
      syncAudioCurrentTime(currentTime.value);
    }

    updatePreviewUrls();
    updateTrackVolumes();
  } catch (err) {
    console.error('Failed to decode audio data for waveform:', err);
  }
}

function saveCurrentClipState() {
  if (!selectedClip.value) return;
  pulseBackStore.updateClip(selectedClip.value.id, {
    title: clipTitle.value,
    tags: clipTags.value ? [...clipTags.value] : [],
    trimStart: trimStart.value,
    trimEnd: trimEnd.value,
    currentTime: currentTime.value,
    volume: clipVolume.value,
    color: clipColor.value,
    includeMic: includeMic.value,
    includeInput: includeInput.value,
  });
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

function resetTrim() {
  if (!selectedClip.value) return;
  const duration = audioDuration.value;
  trimStart.value = 0;
  trimEnd.value = duration;
  currentTime.value = 0;
  syncAudioCurrentTime(0);
  saveCurrentClipState();
}

const canTrimToSelection = computed(() => {
  if (!audioBuffer.value || !selectedClip.value) return false;
  const dur = audioDuration.value;
  return trimStart.value > 0.05 || (trimEnd.value < dur - 0.05 && trimEnd.value > 0);
});

async function trimToSelection() {
  if (!audioBuffer.value || !selectedClip.value || !canTrimToSelection.value) return;

  stopPreview();
  const buffer = audioBuffer.value;
  const sampleRate = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(trimStart.value * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(trimEnd.value * sampleRate));
  const newLength = Math.max(0, endSample - startSample);
  if (newLength <= 0) return;

  const newDuration = newLength / sampleRate;
  const hasDual = buffer.numberOfChannels >= 2;

  let newBlob: Blob;
  if (hasDual) {
    const micSlice = buffer.getChannelData(0).slice(startSample, endSample);
    const inputSlice = buffer.getChannelData(1).slice(startSample, endSample);
    newBlob = encodeWAV(micSlice, sampleRate, inputSlice);
  } else {
    const micSlice = buffer.getChannelData(0).slice(startSample, endSample);
    newBlob = encodeWAV(micSlice, sampleRate);
  }

  const clipId = selectedClip.value.id;
  selectedClip.value.duration = newDuration;
  selectedClip.value.blob = newBlob;
  if (selectedClip.value.audioUrl) {
    try {
      URL.revokeObjectURL(selectedClip.value.audioUrl);
    } catch {}
  }
  selectedClip.value.audioUrl = URL.createObjectURL(newBlob);
  selectedClip.value.trimStart = 0;
  selectedClip.value.trimEnd = newDuration;
  selectedClip.value.currentTime = 0;

  trimStart.value = 0;
  trimEnd.value = newDuration;
  currentTime.value = 0;

  await loadAudioData(newBlob);

  await pulseBackStore.updateClip(clipId, {
    duration: newDuration,
    blob: newBlob,
    trimStart: 0,
    trimEnd: newDuration,
    currentTime: 0,
  });
}

function playTrimmedOnly() {
  stopPreview();
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

function onTrimChange(payload: { start: number; end: number; }) {
  if (currentTime.value < payload.start) {
    currentTime.value = payload.start;
  } else if (currentTime.value > payload.end) {
    currentTime.value = payload.end;
  }
}

function onTrimEndChange() {
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
    const trimmed = await getTrimmedAudioBlob('wav');
    if (!trimmed) return;

    await pulseBackStore.publishToSoundboard(selectedClip.value.id, trimmed.blob, trimmed.duration, {
      title: clipTitle.value.trim() || selectedClip.value.title,
      tags: clipTags.value ? [...clipTags.value] : [],
      color: clipColor.value,
      volume: clipVolume.value,
    }, {
      deleteAfterPublish: deleteAfterPublish.value,
      navigateToSoundboard: false,
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
}

.clip-card:hover {
  background: #323236;
}

.clip-card.active {
  background: #1e3a8a;
  border-color: #3b82f6;
}

.clip-card-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.clip-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: #a1a1aa;
  margin-top: 0.2rem;
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
}

.clip-info-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1c1c20;
  padding: 0.85rem 1.25rem;
  border-radius: 10px;
  border: 1px solid #2e2e34;
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

.play-btn.playing {
  background: #f59e0b;
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

.time-readout {
  font-family: monospace;
  font-size: 0.85rem;
  color: #a1a1aa;
  min-width: 100px;
}

/* Waveform Container */
.waveform-container {
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

/* Audio Tracks Bar */
.audio-tracks-bar {
  display: flex;
  gap: 0.25rem 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: end;
}

.tracks-heading {
  display: flex;
  gap: 0.2rem;
}

.tracks-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #e4e4e7;
}

.tracks-subtitle {
  font-size: 0.75rem;
  color: #71717a;
}

.tracks-buttons {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.track-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  justify-content: center;
  cursor: pointer;
  background: #27272a;
  border: 1px solid #3f3f46;
  color: #d4d4d8;
  transition: all 0.15s ease;
  user-select: none;
  width: 8.5rem;
}

.track-toggle-btn:hover {
  background: #3f3f46;
}

.track-toggle-btn.active {
  background: rgba(56, 189, 248, 0.12);
  border-color: #38bdf8;
  color: #38bdf8;
}

.input-track-btn.active {
  background: rgba(52, 211, 153, 0.12);
  border-color: #34d399;
  color: #34d399;
}

.track-toggle-btn.muted {
  opacity: 0.5;
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.track-name {
  font-weight: 600;
}

.track-badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
}

.track-toggle-btn.active .track-badge {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
}

.input-track-btn.active .track-badge {
  background: rgba(52, 211, 153, 0.2);
  color: #34d399;
}

.track-toggle-btn.muted .track-badge {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
</style>
