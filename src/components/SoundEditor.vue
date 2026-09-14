<template>
  <div class="edit-dialog">
    <div class="title-bar flex justify-between">
      <button @click="handlePreviewButtonClick"
              title="preview sound"
              :class="{ 'playing-sound': playingThisSound }"
              class="light preview-button">
        <inline-svg class="w-8 h-8"
                    :src="Listen" />
      </button>
      <h1 @click="scrollToSound"
          class="cursor-pointer select-none"
          title="Scroll sound into view">Edit Sound</h1>
      <button @click="close"
              class="close-button">
        <inline-svg class="w-8 h-8 rotate-45"
                    :src="Plus" />
      </button>
    </div>
    <div class="sound-properties">
      <div class="input-group">
        <label for="title">Sound title:</label>
        <input type="text"
               v-model="props.modelValue.title"
               id="title"
               placeholder="Enter text for the button" />
        <div class="hide-title-checkbox-group">
          <div title="hide title on button">
            <input type="checkbox"
                   v-model="props.modelValue.hideTitle"
                   id="hideTitle" /><label for="hideTitle">Hide title</label>
          </div>
          <div title="set title color button">
            <color-picker v-model="props.modelValue.color" />
          </div>
        </div>
        <label for="tags"
               @click="tagInputRef && tagInputRef.textInputRef?.focus()">Tags:</label>
        <tag-input ref="tagInputRef"
                   id="tags"
                   v-model="props.modelValue.tags"
                   placeholder="Tags are used for searching" />
      </div>
      <input type="file"
             ref="audioFileInput"
             @change="handleAudioFileUpload"
             class="file-input hidden"
             accept="audio/*" />
      <button @click="audioFileInput?.click()"
              class="light">Browse Audio...</button>
      <div class="input-group">
        <div class="volume-control-container">
          <input-text-number id="volume-display"
                             class="volume-display"
                             :min="0"
                             :max="100"
                             :bigStep="5"
                             v-model="volumeDisplay" />
          <label class="volume-label"
                 for="volume-display">Volume:</label>
          <button @click="handlePlayButtonClick"
                  :class="['play-sound-button', { focusVisible }, { 'sound-is-playing': playingThisSound }]"
                  @blur="focusVisible = false"
                  @keyup="handleKeyup">
            <inline-svg :src="PlayIcon"
                        class="w-6 h-6" />
          </button>
          <input-range-number class="volume-slider"
                              :bigStep="5"
                              v-model="volumeDisplay" />
        </div>
      </div>
      <div class="waveform-container w-full">
        <waveform-graph :audio-buffer="audioBuffer"
                        :duration="duration"
                        :height="50"
                        :show-trim-handles="false"
                        v-model:current-time="currentTime"
                        @scrub-start="onScrubStart"
                        @scrub-move="onScrubMove"
                        @scrub-end="onScrubEnd" />
      </div>
      <div class="flex flex-row gap-1"
           title="Total duration of the sound">
        <span>Total Duration: </span><span>{{ formatSecondsToMMSS(duration) }}</span>
      </div>
      <div class="input-group flex flex-col mb-1 w-full gap-2">
        <span class="font-semibold text-xs text-zinc-400 uppercase tracking-wider">Segments:</span>
        <div v-for="(segment, index) in modelValue.soundSegments"
             :key="`input-range-segment-${segment.id}`"
             :class="['segment-card flex flex-col gap-1 w-full cursor-grab p-1.5 rounded-lg border border-zinc-800/80 bg-zinc-900/50', { dragging: segment.isDragPreview }]"
             draggable="true"
             @dragstart="dragStart(segment, index)"
             @dragenter.prevent="dragOver(segment)"
             @dragend="dragEnd">
          <!-- Top row: Index number, full-width label, remove button -->
          <div class="flex items-center gap-1.5 w-full">
            <span class="text-xs font-mono font-bold text-zinc-500 w-4 text-center select-none">{{ index + 1 }}</span>
            <input v-model="segment.label"
                   placeholder="Segment label (optional)"
                   class="segment-label-input flex-1 min-w-0 text-xs py-0.5" />
            <button @click="removeSegment(segment)"
                    class="close-button flex items-center justify-center w-6 h-6 text-zinc-400 hover:text-white flex-shrink-0"
                    title="Remove segment">
              <inline-svg class="w-4 h-4 rotate-45"
                          :src="Plus" />
            </button>
          </div>

          <!-- Bottom row: Play button, Preview button, Waveform Graph -->
          <div class="flex items-center gap-1.5 w-full">
            <button @click="soundStore.playSound(modelValue, null, null, false, true, segment)"
                    :class="[
                      'play-sound-button flex items-center justify-center flex-shrink-0',
                      { focusVisible },
                      {
                        'sound-is-playing':
                          soundStore.currentSound?.activeSegment?.id === segment.id &&
                          playingThisSound &&
                          soundStore.currentSound?.activeSegment?.isSoundPreview !== true,
                      },
                    ]"
                    @blur="focusVisible = false"
                    @keyup="handleKeyup">
              <inline-svg :src="PlayIcon"
                          class="w-5 h-5" />
            </button>
            <button @click="soundStore.playSound(modelValue, null, null, true, undefined, segment)"
                    title="preview sound"
                    :class="{
                      'playing-sound': playingThisSound,
                      'sound-is-playing':
                        soundStore.currentSound?.activeSegment?.id === segment.id &&
                        playingThisSound &&
                        soundStore.currentSound?.activeSegment?.isSoundPreview === true,
                    }"
                    class="light preview-button flex items-center justify-center flex-shrink-0">
              <inline-svg class="w-5 h-5"
                          :src="Listen" />
            </button>
            <div class="flex-1 min-w-0">
              <waveform-graph :audio-buffer="audioBuffer"
                              :duration="duration"
                              :height="36"
                              :show-trim-handles="true"
                              :show-trim-labels="false"
                              :show-time-ticks="false"
                              :playhead-only-when-active="true"
                              :is-playing="isSegmentPlaying(segment)"
                              :current-time="currentTime"
                              :trim-start="segment.start"
                              :trim-end="segment.end"
                              @update:trim-start="val => handleSegmentTrimStart(val, segment)"
                              @update:trim-end="val => handleSegmentTrimEnd(val, segment)"
                              @scrub-start="sec => onSegmentScrubStart(sec, segment)"
                              @scrub-move="onScrubMove"
                              @scrub-end="sec => onSegmentScrubEnd(sec, segment)" />
            </div>
          </div>
        </div>
        <button @click="addSegment"
                class="close-button w-full flex items-center justify-center py-1 mt-0.5 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs gap-1">
          <inline-svg class="w-4 h-4"
                      :src="Plus" />
          <span>Add Segment</span>
        </button>
      </div>
      <div v-if="modelValue.imageUrl"
           class="relative">
        <div class="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          <button @click="exportImage"
                  class="image-action-button w-8 h-8 bg-white flex items-center justify-center p-1.5 rounded cursor-pointer"
                  title="Save / export image">
            <inline-svg :src="DownloadIcon"
                        class="w-full h-full text-black" />
          </button>
          <button @click="removeImage"
                  class="remove-image-button image-action-button w-8 h-8 bg-white flex items-center justify-center p-1 rounded cursor-pointer"
                  title="Remove image">
            <inline-svg :src="Plus"
                        alt="remove image"
                        class="w-full h-full rotate-45 text-black" />
          </button>
        </div>
        <img :src="modelValue.imageUrl"
             alt="preview button"
             class="image" />
      </div>
      <input type="file"
             ref="imageFileInput"
             @change="handleImageFileUpload"
             class="file-input hidden"
             accept="image/*" />
      <button @click="imageFileInput?.click()"
              class="light">Browse Image...</button>
      <div class="flex flex-col text-black">
        <hotkey-picker v-model="props.modelValue.hotkey"
                       @update:modelValue="updateHotkey"
                       :dark="false"
                       title="set a keybind for sound">Keybind:</hotkey-picker>
      </div>
      <div ref="exportMenuRef"
           class="relative w-full">
        <!-- Export options popup if sound has trimmed segments -->
        <transition name="export-menu-fade">
          <div v-if="showExportMenu"
               class="export-menu">
            <div class="export-menu-header">
              <span class="export-menu-title">Export Audio</span>
              <button @click.stop="showExportMenu = false"
                      type="button"
                      class="export-menu-close"
                      title="Close">✕</button>
            </div>
            <button @click="exportOriginalAudio"
                    type="button"
                    class="export-menu-item">
              <div class="export-item-info">
                <inline-svg :src="DownloadIcon"
                            class="export-item-icon" />
                <span class="export-item-label">Original Audio (Full)</span>
              </div>
              <span class="export-item-time">{{ formatSecondsToMMSS(duration) }}</span>
            </button>
            <template v-if="soundSegments.length > 0">
              <div class="export-section-title">Sound Segments</div>
              <button v-for="(seg, idx) in soundSegments"
                      :key="seg.id"
                      @click="exportTrimmedSegment(seg, idx)"
                      type="button"
                      class="export-menu-item">
                <div class="export-item-info">
                  <span class="segment-num-badge">{{ idx + 1 }}</span>
                  <span class="export-item-label truncate">{{ seg.label || `Segment ${idx + 1}` }}</span>
                </div>
                <span class="export-item-time">
                  {{ formatSecondsToMMSS(seg.start) }} - {{ formatSecondsToMMSS(seg.end) }}
                </span>
              </button>
              <button v-if="soundSegments.length > 1"
                      @click="exportAllSegments"
                      type="button"
                      class="export-menu-item export-all-btn">
                <div class="export-item-info">
                  <inline-svg :src="DownloadIcon"
                              class="export-item-icon" />
                  <span class="export-item-label font-semibold">Export All ({{ soundSegments.length }} segments)</span>
                </div>
              </button>
            </template>
          </div>
        </transition>

        <button :disabled="!hasAudio || isExporting"
                @click="handleExportClick"
                type="button"
                class="light flex items-center justify-center gap-1.5 w-full"
                :title="hasAudio ? 'Save or export audio file' : 'No audio file loaded'">
          <inline-svg class="w-4 h-4"
                      :src="DownloadIcon" />
          <span>{{ isExporting ? 'Exporting...' : 'Export Audio...' }}</span>
          <span v-if="soundSegments.length > 0"
                class="text-xs opacity-75 ml-0.5">▾</span>
        </button>
      </div>
      <button @click="emit('deleteSound', modelValue)"
              class="light danger">DELETE</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Sound } from '../@types/sound';
import Plus from '../assets/images/plus.svg';
import Listen from '../assets/images/listen.svg';
import InlineSvg from 'vue-inline-svg';
import { useSettingsStore } from '../store/settings';
import { computed, ref, shallowRef, watch, onMounted, onUnmounted } from 'vue';
import PlayIcon from '../assets/images/play.svg';
import DownloadIcon from '../assets/images/download.svg';
import { useSoundStore } from '../store/sound';
import { usePulseBackStore } from '../store/pulseBack';
import { encodeMP3 } from '../services/pulseBackBuffer';
import { stripFileExtension, formatSecondsToMMSS } from '../utils/utils';
import { TagInputRef } from './BaseComponents/TagInputTypes';
import { useThrottleFn } from '@vueuse/shared';
import { SoundSegment } from '../@types/sound.d';

const props = defineProps<{
  modelValue: Sound;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: Sound): void;
  (event: 'deleteSound', sound: Sound): void;
  (event: 'close'): void;
}>();
const playingThisSound = computed(() => soundStore.playingSoundIds.some(item => item.fileId === props.modelValue.id));

const settingsStore = useSettingsStore();
const soundStore = useSoundStore();
const pulseBackStore = usePulseBackStore();

const isExporting = ref(false);
const showExportMenu = ref(false);
const exportMenuRef = ref<HTMLElement | null>(null);

const hasAudio = computed(() => !!(props.modelValue.audioUrl || props.modelValue.audioKey));
const soundSegments = computed(() => props.modelValue.soundSegments || []);

function handleExportClick() {
  if (!hasAudio.value || isExporting.value) return;
  if (soundSegments.value.length > 0) {
    showExportMenu.value = !showExportMenu.value;
  } else {
    exportOriginalAudio();
  }
}

async function exportOriginalAudio() {
  let url = props.modelValue.audioUrl;
  if (!url && props.modelValue.audioKey) {
    url = (await settingsStore.getFile(props.modelValue.audioKey)) ?? undefined;
  }
  if (!url) return;

  isExporting.value = true;
  showExportMenu.value = false;
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    const mimeType = (blob.type || '').toLowerCase();
    let extension = 'mp3';
    if (mimeType.includes('wav')) extension = 'wav';
    else if (mimeType.includes('ogg')) extension = 'ogg';
    else if (mimeType.includes('flac')) extension = 'flac';
    else if (mimeType.includes('aac')) extension = 'aac';
    else if (mimeType.includes('m4a') || mimeType.includes('mp4')) extension = 'm4a';
    else if (mimeType.includes('webm')) extension = 'webm';
    else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) extension = 'mp3';

    const rawTitle = props.modelValue.title?.trim() || 'sound';
    const sanitizedTitle = rawTitle.replace(/[<>:"/\\|?*]/g, '_').trim() || 'sound';
    const baseName = sanitizedTitle.replace(new RegExp(`\\.${extension}$`, 'i'), '');
    const defaultFilename = `${baseName}.${extension}`;

    const arrayBuffer = await blob.arrayBuffer();
    const formatFilterMap: Record<string, { name: string; extensions: string[] }> = {
      mp3: { name: 'MP3 Audio (*.mp3)', extensions: ['mp3'] },
      wav: { name: 'WAV Audio (*.wav)', extensions: ['wav'] },
      ogg: { name: 'OGG Audio (*.ogg)', extensions: ['ogg'] },
      flac: { name: 'FLAC Audio (*.flac)', extensions: ['flac'] },
      m4a: { name: 'M4A Audio (*.m4a)', extensions: ['m4a'] },
      webm: { name: 'WebM Audio (*.webm)', extensions: ['webm'] },
    };
    const primaryFilter = formatFilterMap[extension] || {
      name: `${extension.toUpperCase()} Audio (*.${extension})`,
      extensions: [extension],
    };
    const filters = [primaryFilter, { name: 'All Files (*.*)', extensions: ['*'] }];

    if (window.electron?.saveFileDialog) {
      const saved = await window.electron.saveFileDialog(defaultFilename, arrayBuffer, filters);
      if (saved) {
        pulseBackStore.showToast(`Exported "${defaultFilename}"`);
      }
    } else {
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      pulseBackStore.showToast(`Exported "${defaultFilename}"`);
    }
  } catch (err) {
    console.error('Failed to export audio:', err);
    pulseBackStore.showToast('Failed to export audio');
  } finally {
    isExporting.value = false;
  }
}

async function exportSegmentAudio(segment: SoundSegment, segmentIndex?: number, notify = true): Promise<boolean> {
  if (!audioBuffer.value) {
    await loadAudioBuffer();
    if (!audioBuffer.value) return false;
  }
  const buffer = audioBuffer.value;
  const sampleRate = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(segment.start * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(segment.end * sampleRate));
  const length = Math.max(0, endSample - startSample);
  if (length <= 0) return false;

  const micSamples = new Float32Array(length);
  buffer.copyFromChannel(micSamples, 0, startSample);

  const isStereo = buffer.numberOfChannels >= 2;
  const inputSamples = isStereo ? new Float32Array(length) : null;
  if (isStereo && inputSamples) {
    buffer.copyFromChannel(inputSamples, 1, startSample);
  }

  const blob = await encodeMP3(micSamples, sampleRate, 192);

  const rawTitle = props.modelValue.title?.trim() || 'sound';
  const segLabel = segment.label?.trim() || (segmentIndex !== undefined ? `segment_${segmentIndex + 1}` : 'segment');
  const sanitizedTitle = rawTitle.replace(/[<>:"/\\|?*]/g, '_').trim() || 'sound';
  const sanitizedSeg = segLabel.replace(/[<>:"/\\|?*]/g, '_').trim();
  const defaultFilename = `${sanitizedTitle}_${sanitizedSeg}.mp3`;

  const arrayBuffer = await blob.arrayBuffer();
  const filters = [
    { name: 'MP3 Audio (*.mp3)', extensions: ['mp3'] },
    { name: 'All Files (*.*)', extensions: ['*'] },
  ];

  if (window.electron?.saveFileDialog) {
    const saved = await window.electron.saveFileDialog(defaultFilename, arrayBuffer, filters);
    if (saved && notify) {
      pulseBackStore.showToast(`Exported "${defaultFilename}"`);
    }
    return Boolean(saved);
  } else {
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
    if (notify) {
      pulseBackStore.showToast(`Exported "${defaultFilename}"`);
    }
    return true;
  }
}

async function exportTrimmedSegment(segment: SoundSegment, segmentIndex?: number) {
  isExporting.value = true;
  showExportMenu.value = false;
  try {
    await exportSegmentAudio(segment, segmentIndex, true);
  } catch (err) {
    console.error('Failed to export segment audio:', err);
    pulseBackStore.showToast('Failed to export segment audio');
  } finally {
    isExporting.value = false;
  }
}

async function exportAllSegments() {
  isExporting.value = true;
  showExportMenu.value = false;
  try {
    const segs = soundSegments.value;
    let savedCount = 0;
    for (let i = 0; i < segs.length; i++) {
      const saved = await exportSegmentAudio(segs[i], i, false);
      if (saved) {
        savedCount++;
      } else {
        // User cancelled the save dialog, stop asking for remaining files
        break;
      }
    }
    if (savedCount > 0) {
      pulseBackStore.showToast(`Exported ${savedCount} segment${savedCount > 1 ? 's' : ''}`);
    }
  } catch (err) {
    console.error('Failed to export all segments:', err);
    pulseBackStore.showToast('Failed to export segments');
  } finally {
    isExporting.value = false;
  }
}

function handleExportMenuClickOutside(event: MouseEvent) {
  if (showExportMenu.value && exportMenuRef.value && !exportMenuRef.value.contains(event.target as Node)) {
    showExportMenu.value = false;
  }
}

function handleExportMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showExportMenu.value) {
    showExportMenu.value = false;
  }
}

const isExportingImage = ref(false);

async function exportImage() {
  let url = props.modelValue.imageUrl;
  if (!url && props.modelValue.imageKey) {
    url = (await settingsStore.getFile(props.modelValue.imageKey)) ?? undefined;
  }
  if (!url || isExportingImage.value) return;

  isExportingImage.value = true;
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    const mimeType = (blob.type || '').toLowerCase();
    let extension = 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
    else if (mimeType.includes('png')) extension = 'png';
    else if (mimeType.includes('webp')) extension = 'webp';
    else if (mimeType.includes('gif')) extension = 'gif';
    else if (mimeType.includes('svg')) extension = 'svg';
    else if (mimeType.includes('avif')) extension = 'avif';

    const rawTitle = props.modelValue.title?.trim() || 'sound';
    const sanitizedTitle = rawTitle.replace(/[<>:"/\\|?*]/g, '_').trim() || 'sound';
    const baseName = sanitizedTitle.replace(new RegExp(`\\.${extension}$`, 'i'), '');
    const defaultFilename = `${baseName}.${extension}`;

    const arrayBuffer = await blob.arrayBuffer();
    const formatFilterMap: Record<string, { name: string; extensions: string[] }> = {
      png: { name: 'PNG Image (*.png)', extensions: ['png'] },
      jpg: { name: 'JPEG Image (*.jpg;*.jpeg)', extensions: ['jpg', 'jpeg'] },
      webp: { name: 'WebP Image (*.webp)', extensions: ['webp'] },
      gif: { name: 'GIF Image (*.gif)', extensions: ['gif'] },
      svg: { name: 'SVG Image (*.svg)', extensions: ['svg'] },
      avif: { name: 'AVIF Image (*.avif)', extensions: ['avif'] },
    };
    const primaryFilter = formatFilterMap[extension] || {
      name: `${extension.toUpperCase()} Image (*.${extension})`,
      extensions: [extension],
    };
    const filters = [
      primaryFilter,
      { name: 'All Images (*.png;*.jpg;*.jpeg;*.webp;*.gif)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      { name: 'All Files (*.*)', extensions: ['*'] },
    ];

    if (window.electron?.saveFileDialog) {
      const saved = await window.electron.saveFileDialog(defaultFilename, arrayBuffer, filters);
      if (saved) {
        pulseBackStore.showToast(`Exported "${defaultFilename}"`);
      }
    } else {
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      pulseBackStore.showToast(`Exported "${defaultFilename}"`);
    }
  } catch (err) {
    console.error('Failed to export image:', err);
    pulseBackStore.showToast('Failed to export image');
  } finally {
    isExportingImage.value = false;
  }
}

const audioBuffer = shallowRef<AudioBuffer | null>(null);
const currentTime = ref(0);
let audioContext: AudioContext | null = null;
let currentLoadId = 0;
let playheadRaf: number | null = null;

// Scrubbing & snippet preview state
let isScrubbing = false;
let wasPlayingBeforeScrub = false;
let lastScrubPlayTime = 0;
let scrubSourceNode: AudioBufferSourceNode | null = null;
let scrubGainNode: GainNode | null = null;

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
  if (now - lastScrubPlayTime < 45) return;
  lastScrubPlayTime = now;

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => { });
  }

  stopScrubSnippet();

  const durationSec = 0.08;
  const startSec = Math.max(0, Math.min(audioBuffer.value.duration - 0.02, sec));
  const snippetLen = Math.min(durationSec, audioBuffer.value.duration - startSec);
  if (snippetLen <= 0) return;

  const effectiveVol = props.modelValue.volume ?? settingsStore.defaultVolume;
  const sampleRate = audioBuffer.value.sampleRate;
  const sampleCount = Math.floor(snippetLen * sampleRate);
  if (sampleCount <= 0) return;

  const startSample = Math.floor(startSec * sampleRate);
  const snippetBuffer = audioContext.createBuffer(1, sampleCount, sampleRate);
  const channelData = snippetBuffer.getChannelData(0);

  const numChannels = audioBuffer.value.numberOfChannels;
  const ch0 = audioBuffer.value.getChannelData(0);
  const ch1 = numChannels >= 2 ? audioBuffer.value.getChannelData(1) : null;

  for (let i = 0; i < sampleCount; i++) {
    const idx = startSample + i;
    if (idx >= audioBuffer.value.length) break;
    let s = ch0[idx];
    if (ch1) s = (s + ch1[idx]) * 0.5;
    channelData[i] = s;
  }

  const fadeSamples = Math.min(Math.floor(sampleRate * 0.006), Math.floor(sampleCount / 4));
  for (let i = 0; i < fadeSamples; i++) {
    const ramp = i / fadeSamples;
    channelData[i] *= ramp;
    channelData[sampleCount - 1 - i] *= ramp;
  }

  const source = audioContext.createBufferSource();
  source.buffer = snippetBuffer;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(effectiveVol, audioContext.currentTime);

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

let activeSegmentBeforeScrub: SoundSegment | null = null;
let wasPreviewBeforeScrub = false;

function onScrubStart(sec: number) {
  isScrubbing = true;
  wasPlayingBeforeScrub = playingThisSound.value;
  activeSegmentBeforeScrub = soundStore.currentSound?.activeSegment ?? null;
  wasPreviewBeforeScrub = soundStore.currentSound?.activeSegment?.isSoundPreview === true;
  if (wasPlayingBeforeScrub) {
    soundStore.stopAllSounds();
  }
  currentTime.value = sec;
  playScrubSnippet(sec);
}

function onScrubMove(sec: number) {
  currentTime.value = sec;
  playScrubSnippet(sec);
}

function onScrubEnd(sec: number) {
  isScrubbing = false;
  stopScrubSnippet();
  currentTime.value = sec;
  if (wasPlayingBeforeScrub) {
    const resumeSegment = activeSegmentBeforeScrub;
    const resumePreview = wasPreviewBeforeScrub;
    wasPlayingBeforeScrub = false;
    activeSegmentBeforeScrub = null;
    wasPreviewBeforeScrub = false;
    playFromCurrentTime(resumePreview, resumeSegment);
  }
}

function playFromCurrentTime(preview = false, targetSegment?: SoundSegment | null) {
  const seg = targetSegment ?? props.modelValue.soundSegments?.[0];
  const start = Math.max(0, Math.min(duration.value, currentTime.value));
  const end = seg && start < seg.end ? seg.end : duration.value;

  const segment: SoundSegment = {
    id: seg?.id ?? crypto.randomUUID(),
    start,
    end,
  };
  if (preview) {
    segment.isSoundPreview = true;
  }

  soundStore.playSound(props.modelValue, null, null, preview, true, segment);
}

function handlePlayButtonClick() {
  if (playingThisSound.value) {
    soundStore.stopAllSounds();
    return;
  }
  if (currentTime.value > 0 && currentTime.value < duration.value) {
    playFromCurrentTime(false);
  } else {
    soundStore.playSound(props.modelValue, null, null, undefined, true);
  }
}

function handlePreviewButtonClick() {
  if (playingThisSound.value) {
    soundStore.stopAllSounds();
    return;
  }
  if (currentTime.value > 0 && currentTime.value < duration.value) {
    playFromCurrentTime(true);
  } else {
    soundStore.playSound(props.modelValue, null, null, true);
  }
}

function handleSegmentTrimStart(val: number, segment: SoundSegment) {
  const mult = Math.pow(10, precision.value);
  segment.start = Math.round(val * mult) / mult;
  emit('update:modelValue', props.modelValue);
}

function handleSegmentTrimEnd(val: number, segment: SoundSegment) {
  const mult = Math.pow(10, precision.value);
  segment.end = Math.round(val * mult) / mult;
  emit('update:modelValue', props.modelValue);
}

function isSegmentPlaying(segment: SoundSegment): boolean {
  return playingThisSound.value && soundStore.currentSound?.activeSegment?.id === segment.id;
}

function onSegmentScrubStart(sec: number, segment: SoundSegment) {
  isScrubbing = true;
  wasPlayingBeforeScrub = playingThisSound.value;
  activeSegmentBeforeScrub = segment;
  wasPreviewBeforeScrub = soundStore.currentSound?.activeSegment?.isSoundPreview === true;
  if (wasPlayingBeforeScrub) {
    soundStore.stopAllSounds();
  }
  currentTime.value = sec;
  playScrubSnippet(sec);
}

function onSegmentScrubEnd(sec: number, segment: SoundSegment) {
  isScrubbing = false;
  stopScrubSnippet();
  currentTime.value = sec;
  if (wasPlayingBeforeScrub) {
    const resumePreview = wasPreviewBeforeScrub;
    wasPlayingBeforeScrub = false;
    activeSegmentBeforeScrub = null;
    wasPreviewBeforeScrub = false;
    playFromCurrentTime(resumePreview, segment);
  }
}

async function loadAudioBuffer() {
  const loadId = ++currentLoadId;
  const url = props.modelValue?.audioUrl;
  if (!url) {
    audioBuffer.value = null;
    return;
  }

  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    if (loadId !== currentLoadId) return;

    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    if (loadId !== currentLoadId) return;

    audioBuffer.value = decoded;
  } catch (err) {
    if (loadId === currentLoadId) {
      console.error('Error decoding audio buffer for SoundEditor:', err);
      audioBuffer.value = null;
    }
  }
}

function updatePlayhead() {
  if (isScrubbing) return;

  if (!playingThisSound.value) {
    if (playheadRaf !== null) {
      cancelAnimationFrame(playheadRaf);
      playheadRaf = null;
    }
    return;
  }

  let foundAudio: HTMLAudioElement | null = null;
  for (const device of soundStore.outputDeviceData) {
    const audio = device.currentAudio?.find(a =>
      a.getAttribute('data-id')?.startsWith(`${props.modelValue.id}_`)
    );
    if (audio) {
      foundAudio = audio;
      break;
    }
  }

  if (foundAudio) {
    currentTime.value = foundAudio.currentTime;
  }

  playheadRaf = requestAnimationFrame(updatePlayhead);
}

watch(playingThisSound, isPlaying => {
  if (isPlaying) {
    if (playheadRaf !== null) cancelAnimationFrame(playheadRaf);
    playheadRaf = requestAnimationFrame(updatePlayhead);
  } else {
    if (playheadRaf !== null) {
      cancelAnimationFrame(playheadRaf);
      playheadRaf = null;
    }
    if (!isScrubbing) {
      currentTime.value = 0;
    }
  }
});

const scrollToSound = () => {
  if (!props.modelValue?.id) return;
  const soundButton = document.getElementById(`sound-${props.modelValue.id}`);
  if (soundButton) {
    soundButton.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

onMounted(async () => {
  document.addEventListener('click', handleExportMenuClickOutside);
  document.addEventListener('keydown', handleExportMenuKeydown);
  if (props.modelValue) {
    await settingsStore.ensureSoundLoaded(props.modelValue);
    loadAudioBuffer();
  }
});

watch(
  () => props.modelValue?.id,
  async (newId, oldId) => {
    if (newId !== oldId) {
      isScrubbing = false;
      stopScrubSnippet();
      wasPlayingBeforeScrub = false;
      activeSegmentBeforeScrub = null;
      wasPreviewBeforeScrub = false;
      currentTime.value = 0;
    }
    if (props.modelValue) {
      await settingsStore.ensureSoundLoaded(props.modelValue);
      loadAudioBuffer();
    }
  }
);

watch(
  () => props.modelValue?.audioUrl,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      currentTime.value = 0;
      loadAudioBuffer();
    }
  }
);

onUnmounted(() => {
  document.removeEventListener('click', handleExportMenuClickOutside);
  document.removeEventListener('keydown', handleExportMenuKeydown);
  stopScrubSnippet();
  if (playheadRaf !== null) {
    cancelAnimationFrame(playheadRaf);
    playheadRaf = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => { });
    audioContext = null;
  }
});
const imageFileInput = ref<HTMLInputElement | null>(null);
const audioFileInput = ref<HTMLInputElement | null>(null);
const tagInputRef = ref<TagInputRef | null>(null);
const focusVisible = ref(false);
/** how many decimal points should we round to */
const precision = ref(2);

let draggedIndexStart: number | null = null;
let draggedSegment: SoundSegment | null = null;
const cancelDragEnd = ref(false);

/**
 * Displays the volume as a percentage
 */
const volumeDisplay = computed({
  get: () => Math.round((props.modelValue.volume ?? settingsStore.defaultVolume) * 100),
  set: (value: number) => {
    value = Math.min(100, Math.max(0, Math.round(value)));
    soundStore.setVolume(value / 100, props.modelValue.id);
    saveVolumeDebounced(value);
  },
});

/** round the duration up to the nearest precision */
const duration = computed(() => {
  const multiplier = Math.pow(10, precision.value);
  return Math.ceil((props.modelValue.duration ?? 100) * multiplier) / multiplier;
});

const saveVolumeDebounced = useThrottleFn((value: number) => {
  const newValue = Math.round(value) / 100;
  if (props.modelValue.volume === newValue) return;
  // we don't need to handle this here, but if we don't, it will trigger once
  // when it's set to the same number as the default volume,
  // and then a second time when the volume is deleted,
  // because no volume will turn into the default volume
  if (newValue === settingsStore.defaultVolume) {
    delete props.modelValue.volume;
  } else {
    props.modelValue.volume = newValue;
  }
}, 100);

// Watch for changes to the title and update the modelValue
watch(
  () => [
    props.modelValue.title,
    props.modelValue.volume,
    props.modelValue.hideTitle,
    props.modelValue.hotkey,
    props.modelValue.tags,
    props.modelValue.color,
    props.modelValue.soundSegments,
  ],
  () => {
    // if hideTitle is false and modelValue has the property, delete it
    if (!props.modelValue.hideTitle && props.modelValue.hasOwnProperty('hideTitle')) {
      delete props.modelValue.hideTitle;
    }
    if (props.modelValue.color === '#ffffff') {
      delete props.modelValue.color;
    }
    volumeDisplay.value = Math.round((props.modelValue.volume ?? settingsStore.defaultVolume) * 100);
    if ((props.modelValue.volume ?? settingsStore.defaultVolume) === settingsStore.defaultVolume) {
      delete props.modelValue.volume;
    }
    if (props.modelValue.tags?.length === 0) {
      delete props.modelValue.tags;
    }
    emit('update:modelValue', props.modelValue);
  },
  { deep: true }
);

/**
 * Adds a segment to the segments array
 */
function addSegment() {
  if (!props.modelValue.soundSegments) props.modelValue.soundSegments = [];
  props.modelValue.soundSegments.push({ start: 0, end: duration.value, id: crypto.randomUUID() });
  emit('update:modelValue', props.modelValue);
}

/**
 * Removes a segment from the segments array
 * @param segment The segment to remove
 */
function removeSegment(segment: SoundSegment) {
  props.modelValue.soundSegments?.splice(props.modelValue.soundSegments?.indexOf(segment) ?? -1, 1);
  if (props.modelValue.soundSegments?.length === 0) {
    delete props.modelValue.soundSegments;
  }
  // delete props.modelValue.soundSegments
  emit('update:modelValue', props.modelValue);
}

/**
 * Handles the keyup event
 * The reason why we do this is to prevent the ptt_hotkey from accidentally triggering the soundButton to be focused
 * @param event The keyup event
 */
function handleKeyup(event: KeyboardEvent) {
  // if the soundStore is sending a ptt_hotkey and the keyup event is the ptt_hotkey, prevent the default action (which will focus it)
  if (soundStore.sendingPttHotkey && settingsStore.ptt_hotkey.includes(event.code)) {
    event.preventDefault();
    return;
  }
  focusVisible.value = true;
}

function updateHotkey(newKey: string[] | undefined, oldKey: string[] | undefined) {
  if (oldKey) {
    settingsStore.removeSoundHotkey(props.modelValue, oldKey);
  }
  setTimeout(() => {
    // we must delay this, otherwise it will play the sound when the hotkey is set
    settingsStore.addSoundHotkey(props.modelValue, newKey);
  }, 0);
}

async function handleAudioFileUpload(event: Event) {
  // Handle the file upload event
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.files || !target.files[0]) return;
  const file = target.files[0];
  const { fileUrl, fileKey } = await settingsStore.replaceFile(props.modelValue.audioKey, file);
  props.modelValue.title = stripFileExtension(file.name);
  props.modelValue.audioKey = fileKey;
  props.modelValue.audioUrl = fileUrl;
  props.modelValue.duration = await settingsStore.getAudioDuration(fileUrl);
  currentTime.value = 0;
  loadAudioBuffer();
  emit('update:modelValue', props.modelValue);
}

async function handleImageFileUpload(event: Event) {
  // Handle the file upload event
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.files || !target.files[0]) return;
  const file = target.files[0];
  const { fileUrl, fileKey } = await settingsStore.replaceFile(props.modelValue.imageKey, file);
  props.modelValue.imageKey = fileKey;
  props.modelValue.imageUrl = fileUrl;
  emit('update:modelValue', props.modelValue);
}

function removeImage() {
  // Remove the image from the modelValue
  settingsStore.deleteFile(props.modelValue.imageKey);
  delete props.modelValue.imageKey;
  delete props.modelValue.imageUrl;
  emit('update:modelValue', props.modelValue);
}

function close() {
  // Close the editor
  emit('close');
}

function dragStart(pSegment: SoundSegment, index: number) {
  draggedIndexStart = index;
  pSegment.isDragPreview = true;
  draggedSegment = pSegment;
}

function dragOver(pSegment: SoundSegment) {
  if (draggedSegment === null || props.modelValue.soundSegments === undefined) return;

  const index = props.modelValue.soundSegments.indexOf(pSegment);
  const draggedIndex = props.modelValue.soundSegments.indexOf(draggedSegment);
  if (index === draggedIndex) return;
  // const segmentsTemp = [...props.modelValue.soundSegments]
  props.modelValue.soundSegments.splice(draggedIndex, 1); // remove the previous tag preview
  props.modelValue.soundSegments.splice(index, 0, draggedSegment); // add the tag preview to the new index
}

/**
 * Handles the drag end event, which is when the drag is cancelled
 */
function dragEnd() {
  if (cancelDragEnd.value) {
    cancelDragEnd.value = false;
    return;
  }
  if (draggedIndexStart === null || draggedSegment === null) return;
  delete draggedSegment.isDragPreview;
  draggedIndexStart = null;
  draggedSegment = null;
  // no need to save, because we're resetting back to the original order
}
</script>

<style scoped>
.edit-dialog {
  height: calc(100% - 3.5rem);
}

.sound-properties {
  margin-bottom: 8rem;
  height: 100%;
  overflow: hidden auto;
  --scrollbar-width: 14px;
  scroll-margin-block: 50px;
  padding: 0.5rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sound-properties::-webkit-scrollbar {
  width: var(--scrollbar-width);
  padding-right: 1.5rem;
}

.sound-properties::-webkit-scrollbar-thumb {
  background: var(--text-color);
  border-radius: calc(var(--scrollbar-width) / 2);
  border: 4px solid var(--input-bg-color);
}

.sound-properties::-webkit-scrollbar-track {
  background: var(--input-bg-color);
}

.title-bar {
  position: sticky;
  top: 0;
  background: var(--top-toolbar-color);
  padding: 0.61rem 1rem;
  z-index: 1;
  gap: 0.5rem;
}

.title-bar h1:hover {
  opacity: 0.8;
}

.hide-title-checkbox-group {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: center;
  margin: 0.5rem 0;
}

.hide-title-checkbox-group>div {
  display: flex;
  align-items: center;
  justify-self: center;
  gap: 0.5rem;
}

.hide-title-checkbox-group>div>input[type='checkbox']:checked {
  background-color: var(--button-color);
}

input[type='checkbox'] {
  --tw-ring-offset-width: unset;
  --tw-ring-color: transparent;
  background-color: var(--input-bg-color);
}

input[type='checkbox']:focus-visible {
  --tw-ring-color: var(--active-color);
}

.volume-control-container {
  display: grid;
  align-items: center;
  grid-template-rows: auto auto;
  grid-template-columns: min-content auto;
  width: 100%;
}

.play-sound-button {
  grid-area: 2 / 1;
  width: max-content;
}

.sound-is-playing {
  animation: playing-sound-animation 1s infinite;
}

@keyframes playing-sound-animation {
  0% {
    filter: brightness(0.5);
  }

  50% {
    filter: brightness(1.3);
  }

  100% {
    filter: brightness(0.5);
  }
}

.close-button:focus-visible {
  outline: 2px solid var(--active-color);
  outline-offset: 2px;
}

.close-button>svg,
.play-sound-button>svg {
  fill: var(--text-color);
  stroke: none;
}

.play-sound-button>svg {
  fill: var(--button-color);
  stroke: none;
}

.play-sound-button.focusVisible>svg {
  stroke: var(--active-color);
  stroke-width: 0.12rem;
  overflow: visible;
  fill: var(--accent-text-color);
}

.play-sound-button:hover>svg {
  fill: var(--link-color);
}

.play-sound-button:active>svg {
  fill: var(--accent-text-color);
}

.volume-display {
  color: var(--text-color);
  background: var(--input-bg-color);
  padding: 0;
  margin-right: 0.5rem;
  margin-bottom: 0.25rem;
  width: 2.2rem;
  border-radius: 0.25rem;
  text-align: center;
  border: none;
}

.volume-label {
  text-align: left;
  grid-area: 1 / 2;
}

.volume-slider {
  grid-area: 2 / 2;
  width: 100%;
  cursor: pointer;
}

.image {
  object-fit: cover;
  width: 100%;
  aspect-ratio: 1 / 1;
}

.remove-image-button,
.image-action-button {
  opacity: 0.6;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
}

.remove-image-button:hover,
.remove-image-button:focus-visible,
.image-action-button:hover,
.image-action-button:focus-visible {
  opacity: 1;
}

.remove-image-button:active,
.image-action-button:active {
  transform: scale(0.95);
}

.input-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.input-group>span {
  margin-bottom: 0.25rem;
  text-align: left;
}

.input-group>input {
  width: 100%;
}

.preview-button {
  padding: 0.25rem;
  width: 2rem;
  aspect-ratio: 1;
  border-radius: 0.25rem;
}

.preview-button>svg {
  stroke: var(--text-color);
  width: 100%;
  height: 100%;
}

.preview-button:active>svg {
  stroke: var(--background-color);
}

h1 {
  color: var(--text-color);
}

input {
  color: var(--text-color);
  background: var(--background-color);
  border: none;
}

.dragging {
  opacity: 0.5;
}

.segment-card {
  transition: border-color 0.15s, background-color 0.15s;
}

.segment-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background-color: rgba(24, 24, 27, 0.7);
}

.segment-label-input {
  background: transparent !important;
  border: none !important;
  border-bottom: 1px solid transparent !important;
  border-radius: 0 !important;
  padding: 1px 4px !important;
  color: #d4d4d8 !important;
  outline: none !important;
  box-shadow: none !important;
  transition: border-color 0.15s;
}

.segment-label-input:hover {
  border-bottom-color: #3f3f46 !important;
}

.segment-label-input:focus {
  border-bottom-color: #38bdf8 !important;
  color: #ffffff !important;
}

.export-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  background-color: #18181b !important;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  padding: 0.65rem;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.95), 0 4px 12px rgba(0, 0, 0, 0.7);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 280px;
  overflow-y: auto;
}

.export-menu::-webkit-scrollbar {
  width: 6px;
}

.export-menu::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 3px;
}

.export-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid #27272a;
  margin-bottom: 0.2rem;
}

.export-menu-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #f4f4f5;
}

.export-menu-close {
  background: transparent;
  border: none;
  color: #a1a1aa;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
}

.export-menu-close:hover {
  color: #ffffff;
}

.export-section-title {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #a1a1aa;
  margin-top: 0.35rem;
  margin-bottom: 0.1rem;
  padding-left: 0.2rem;
}

.export-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.45rem 0.55rem;
  background-color: #27272a;
  border: 1px solid #333338;
  border-radius: 6px;
  color: #f4f4f5;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  text-align: left;
}

.export-menu-item:hover {
  background-color: #3f3f46;
  border-color: #52525b;
  color: #ffffff;
}

.export-menu-item:active {
  background-color: #23a459;
  border-color: #23a459;
  color: #ffffff;
}

.export-item-info {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  flex: 1;
}

.export-item-icon {
  width: 0.85rem;
  height: 0.85rem;
  flex-shrink: 0;
  color: #2ea32e;
}

.segment-num-badge {
  font-size: 0.7rem;
  font-weight: 700;
  font-family: monospace;
  background: rgba(255, 255, 255, 0.12);
  color: #d4d4d8;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  flex-shrink: 0;
}

.export-item-label {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.export-item-time {
  font-size: 0.7rem;
  color: #a1a1aa;
  font-family: monospace;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.export-menu-fade-enter-active,
.export-menu-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.export-menu-fade-enter-from,
.export-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
