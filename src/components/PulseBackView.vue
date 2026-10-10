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

        <!-- Waveform Studio Editor -->
        <waveform-editor ref="waveformEditorRef"
                         :blob="selectedClip?.blob"
                         :original-blob="selectedClip?.originalBlob || selectedClip?.blob"
                         :clip-id="selectedClip?.id"
                         :duration="selectedClip?.duration || 1"
                         v-model:trim-start="trimStart"
                         v-model:trim-end="trimEnd"
                         v-model:current-time="currentTime"
                         :enable-dual-tracks="true"
                         v-model:include-mic="includeMic"
                         v-model:include-input="includeInput"
                         v-model:active-track-target="activeTrackTarget"
                         v-model:mic-gain="micGainMultiplier"
                         v-model:input-gain="inputGainMultiplier"
                         v-model:applied-gain-regions="appliedGainRegions"
                         v-model:segment-boundaries="segmentBoundaries"
                         :volume="clipVolume"
                         @timeline-change="onTimelineChange"
                         @change="saveCurrentClipState" />

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
import { ref, computed, watch, onUnmounted } from 'vue';
import { usePulseBackStore, PulseBackClip } from '../store/pulseBack';
import { useSettingsStore } from '../store/settings';
import { TagInputRef } from './BaseComponents/TagInputTypes';
import WaveformEditor from './WaveformEditor.vue';
import { AudioGainRegion } from '../utils/audioGain';
import { AudioTimelineSegment } from '../utils/audioSegments';

const pulseBackStore = usePulseBackStore();
const settingsStore = useSettingsStore();

function getDefaultVolumePercent(): number {
  const def = settingsStore.defaultVolume;
  return typeof def === 'number' && !Number.isNaN(def) ? Math.round(def * 100) : 100;
}

const tagInputRef = ref<TagInputRef | null>(null);
const waveformEditorRef = ref<InstanceType<typeof WaveformEditor> | null>(null);

const selectedClip = computed(() => pulseBackStore.selectedClip);

// Editor Form State
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

// Trimming & Playback State (bound to WaveformEditor)
const trimStart = ref(0);
const trimEnd = ref(0);
const currentTime = ref(0);

// Dual-Track & Gain State (bound to WaveformEditor)
const includeMic = ref(true);
const includeInput = ref(true);
const activeTrackTarget = ref<'both' | 'mic' | 'input'>('both');
const micGainMultiplier = ref(1.0);
const inputGainMultiplier = ref(1.0);
const appliedGainRegions = ref<AudioGainRegion[]>([]);
const segmentBoundaries = ref<number[]>([]);

watch(
  () => selectedClip.value?.id,
  (_newId, oldId) => {
    waveformEditorRef.value?.stopPreview?.();
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
          micGain: micGainMultiplier.value,
          inputGain: inputGainMultiplier.value,
          partialGains: appliedGainRegions.value ? [...appliedGainRegions.value] : [],
          segmentBoundaries: segmentBoundaries.value ? [...segmentBoundaries.value] : [],
        });
      }
    }
    if (!selectedClip.value) {
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
    micGainMultiplier.value = clip.micGain ?? 1.0;
    inputGainMultiplier.value = clip.inputGain ?? 1.0;
    segmentBoundaries.value = clip.segmentBoundaries ? [...clip.segmentBoundaries] : [];

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
  },
  { immediate: true }
);

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
    micGain: micGainMultiplier.value,
    inputGain: inputGainMultiplier.value,
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

function onTimelineChange(payload: {
  buffer: AudioBuffer;
  blob: Blob;
  duration: number;
  segments: AudioTimelineSegment[];
  boundaries: number[];
}) {
  if (!selectedClip.value) return;
  selectedClip.value.duration = payload.duration;
  selectedClip.value.blob = payload.blob;
  if (selectedClip.value.audioUrl && selectedClip.value.audioUrl.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(selectedClip.value.audioUrl);
    } catch { }
  }
  selectedClip.value.audioUrl = URL.createObjectURL(payload.blob);
  selectedClip.value.trimStart = trimStart.value;
  selectedClip.value.trimEnd = trimEnd.value;
  selectedClip.value.currentTime = currentTime.value;
  selectedClip.value.segmentBoundaries = payload.boundaries ? [...payload.boundaries] : [];
  saveCurrentClipState({ includeBlob: true });
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
  saveCurrentClipState();
}

function onColorChange() {
  saveCurrentClipState();
}

async function deleteClip(id: string) {
  waveformEditorRef.value?.stopPreview?.();
  await pulseBackStore.deleteClip(id);
}

async function duplicateClip(id: string) {
  waveformEditorRef.value?.stopPreview?.();
  saveCurrentClipState();
  await pulseBackStore.duplicateClip(id);
}

async function publishToSoundboard() {
  if (!selectedClip.value || !waveformEditorRef.value || isPublishing.value || isSavingFile.value) return;

  isPublishing.value = true;
  try {
    const format = exportFormat.value;
    const trimmed = await waveformEditorRef.value.getTrimmedAudioBlob(format);
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
  if (!selectedClip.value || !waveformEditorRef.value || isSavingFile.value || isPublishing.value) return;

  isSavingFile.value = true;
  try {
    const format = exportFormat.value;
    const trimmed = await waveformEditorRef.value.getTrimmedAudioBlob(format);
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
        pulseBackStore.showToast(`Saved "${defaultFilename}"`, {
          filePath: typeof saved === 'string' ? saved : undefined,
        });
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

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSeconds(secs: number): string {
  if (Number.isNaN(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

onUnmounted(() => {
  waveformEditorRef.value?.stopPreview?.();
  saveCurrentClipState();
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
  background: var(--primary-color-50);
  border-color: var(--primary-color);
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
  border-color: var(--primary-color);
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
  background: var(--primary-color);
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
  accent-color: var(--primary-color);
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
  background: var(--primary-color);
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
</style>
