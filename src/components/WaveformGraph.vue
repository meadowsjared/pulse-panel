<template>
  <div ref="containerRef"
       class="waveform-graph-container">
    <div class="waveform-wrapper"
         ref="waveformWrapperRef"
         :style="wrapperStyle"
         @mousedown="onWaveformMouseDown"
         @dragstart.prevent.stop>
      <canvas ref="canvasRef"
              class="waveform-canvas"></canvas>

      <!-- Dimmed Region Overlays -->
      <template v-if="showTrimHandles">
        <div class="trim-overlay start-overlay"
             :style="{ width: `${startPercent}%` }"></div>
        <div class="trim-overlay end-overlay"
             :style="{ left: `${endPercent}%`, width: `${100 - endPercent}%` }"></div>

        <!-- Start Trim Handle -->
        <div :class="['trim-handle', 'start-handle', { 'active-handle': activeDragHandle === 'start' }]"
             :style="{ left: `${startPercent}%` }"
             @mousedown.stop="onStartHandleMouseDown"
             @dblclick.stop="openTrimPopovers('start')"
             @contextmenu.prevent.stop="openTrimPopovers('start')"
             :title="`Start: ${formatSeconds(trimStart)} (Click to edit)`">
          <div v-if="showTrimLabels"
               class="handle-flag start-flag">In: {{ formatSeconds(trimStart) }}</div>
          <div class="handle-line"></div>
        </div>

        <!-- End Trim Handle -->
        <div :class="['trim-handle', 'end-handle', { 'active-handle': activeDragHandle === 'end' }]"
             :style="{ left: `${endPercent}%` }"
             @mousedown.stop="onEndHandleMouseDown"
             @dblclick.stop="openTrimPopovers('end')"
             @contextmenu.prevent.stop="openTrimPopovers('end')"
             :title="`End: ${formatSeconds(trimEnd > 0 ? trimEnd : effectiveDuration)} (Click to edit)`">
          <div v-if="showTrimLabels"
               class="handle-flag end-flag">Out: {{ formatSeconds(trimEnd > 0 ? trimEnd : effectiveDuration) }}</div>
          <div class="handle-line"></div>
        </div>
      </template>

      <!-- Playhead Scrub Line -->
      <div v-if="showPlayhead"
           class="playhead-line"
           :style="{ left: `${playheadPercent}%` }">
        <div class="playhead-cap"
             @mousedown.stop="onPlayheadMouseDown"
             title="Drag to Scrub Playhead"></div>
      </div>
    </div>

    <!-- Unified Trim Capsule Popover -->
    <div v-if="showTrimHandles"
         class="trim-capsule-card"
         :class="{ 'is-open': areTrimPopoversOpen, 'is-dragging': isDraggingHandle }"
         :style="capsuleCardStyle"
         @mousedown.stop
         @click.stop>
      <div class="capsule-content">
        <!-- Start Input Field -->
        <div class="capsule-field start-field"
             :class="{ 'is-focused': focusedPopoverHandle === 'start' }"
             @click="focusStartInput">
          <span class="capsule-badge start-badge">IN</span>
          <input ref="startInputRef"
                 v-model="startInputValue"
                 class="capsule-time-input start"
                 placeholder="0:00.00"
                 @focus="onInputFocus('start')"
                 @input="onStartInput"
                 @blur="onPopoverBlur($event)"
                 @keydown="onPopoverKeydown('start', $event)" />
        </div>

        <span class="capsule-divider">→</span>

        <!-- End Input Field -->
        <div class="capsule-field end-field"
             :class="{ 'is-focused': focusedPopoverHandle === 'end' }"
             @click="focusEndInput">
          <span class="capsule-badge end-badge">OUT</span>
          <input ref="endInputRef"
                 v-model="endInputValue"
                 class="capsule-time-input end"
                 placeholder="0:00.00"
                 @focus="onInputFocus('end')"
                 @input="onEndInput"
                 @blur="onPopoverBlur($event)"
                 @keydown="onPopoverKeydown('end', $event)" />
        </div>
      </div>
      <div class="capsule-arrow" :style="capsuleArrowStyle"></div>
    </div>

    <!-- Time Ticks along bottom -->
    <div v-if="showTimeTicks"
         class="time-ticks">
      <span>0:00</span>
      <span>{{ formatSeconds(effectiveDuration * 0.25) }}</span>
      <span>{{ formatSeconds(effectiveDuration * 0.5) }}</span>
      <span>{{ formatSeconds(effectiveDuration * 0.75) }}</span>
      <span>{{ formatSeconds(effectiveDuration) }}</span>
    </div>
    <span v-if="showTrimHandles && showTrimInstructions"
          class="text-xs text-zinc-400">Drag green handle for Start, red handle for End</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

// Shared across all WaveformGraph instances so opening one closes all other popovers
let graphInstanceCounter = 0;
const globalActiveGraphInstanceId = ref<number | null>(null);

export interface WaveformTrack {
  /** Label displayed in the watermark badge pill (e.g. '🎤 MIC (VOICE)'). If empty or undefined, badge is omitted. */
  label?: string;
  /** AudioBuffer channel index or indices to sample. If undefined, samples all available channels. */
  channelIndex?: number | number[];
  /** Whether the track is enabled/active. When false, the track is rendered dimmed/muted. Defaults to true. */
  enabled?: boolean;
  /** Custom gradient colors [startColor, endColor] for the bars. */
  colors?: [string, string];
}

interface Props {
  audioBuffer: AudioBuffer | null;
  duration?: number;
  currentTime?: number;
  trimStart?: number;
  trimEnd?: number;
  showTrimHandles?: boolean;
  showTrimLabels?: boolean;
  showTrimInstructions?: boolean;
  showTimeTicks?: boolean;
  showPlayhead?: boolean;
  isPlaying?: boolean;
  playheadOnlyOnDrag?: boolean;
  playheadOnlyWhenActive?: boolean;
  enableScrubbing?: boolean;
  tracks?: WaveformTrack[];
  height?: number | string;
  includeMic?: boolean;
  includeInput?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  duration: 0,
  currentTime: 0,
  trimStart: 0,
  trimEnd: 0,
  showTrimHandles: true,
  showTrimLabels: true,
  showTrimInstructions: false,
  showTimeTicks: true,
  showPlayhead: true,
  isPlaying: false,
  playheadOnlyOnDrag: false,
  playheadOnlyWhenActive: false,
  enableScrubbing: true,
  includeMic: true,
  includeInput: true,
});

const emit = defineEmits<{
  (e: 'update:currentTime', time: number): void;
  (e: 'update:trimStart', time: number): void;
  (e: 'update:trimEnd', time: number): void;
  (e: 'scrubStart', time: number): void;
  (e: 'scrubMove', time: number): void;
  (e: 'scrubEnd', time: number): void;
  (e: 'trimChange', payload: { start: number; end: number; }): void;
  (e: 'trimEndChange', payload: { start: number; end: number; }): void;
}>();

const instanceId = ++graphInstanceCounter;
const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const waveformWrapperRef = ref<HTMLDivElement | null>(null);

const activeDragHandle = ref<'start' | 'end' | null>(null);
const isScrubbing = ref(false);
const internalScrubTime = ref<number | null>(null);
let resizeObserver: ResizeObserver | null = null;

const effectiveDuration = computed(() => {
  if (props.duration > 0) return props.duration;
  if (props.audioBuffer?.duration) return props.audioBuffer.duration;
  return 1;
});

const displayCurrentTime = computed(() => {
  if (isScrubbing.value && internalScrubTime.value !== null) {
    return internalScrubTime.value;
  }
  return props.currentTime;
});

const showPlayhead = computed(() => {
  if (!props.showPlayhead) return false;
  if (props.playheadOnlyWhenActive || props.playheadOnlyOnDrag) {
    return isScrubbing.value || Boolean(props.isPlaying);
  }
  return isScrubbing.value || props.currentTime > 0;
});

const startPercent = computed(() => {
  if (effectiveDuration.value <= 0) return 0;
  return Math.max(0, Math.min(100, (props.trimStart / effectiveDuration.value) * 100));
});

const endPercent = computed(() => {
  if (effectiveDuration.value <= 0) return 100;
  const end = props.trimEnd > 0 ? props.trimEnd : effectiveDuration.value;
  return Math.max(0, Math.min(100, (end / effectiveDuration.value) * 100));
});

const playheadPercent = computed(() => {
  if (effectiveDuration.value <= 0) return 0;
  return Math.max(0, Math.min(100, (displayCurrentTime.value / effectiveDuration.value) * 100));
});

const wrapperStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.height) {
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height;
  }
  if (!props.enableScrubbing) {
    style.cursor = props.showTrimHandles ? 'pointer' : 'default';
  }
  return Object.keys(style).length > 0 ? style : undefined;
});

function formatSeconds(sec: number): string {
  if (isNaN(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function parseTimeInput(input: string): number | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const m = parseFloat(parts[0]);
    const s = parts[1] === '' ? 0 : parseFloat(parts[1]);
    if (isNaN(m) && isNaN(s)) return null;
    return Math.max(0, (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s));
  }
  const sec = parseFloat(trimmed);
  if (isNaN(sec)) return null;
  return Math.max(0, sec);
}

const areTrimPopoversOpen = ref(false);
const focusedPopoverHandle = ref<'start' | 'end' | null>(null);
const startInputValue = ref('');
const endInputValue = ref('');
const startInputRef = ref<HTMLInputElement | null>(null);
const endInputRef = ref<HTMLInputElement | null>(null);

function openTrimPopovers(focusHandle?: 'start' | 'end') {
  globalActiveGraphInstanceId.value = instanceId;
  areTrimPopoversOpen.value = true;
  focusedPopoverHandle.value = focusHandle ?? null;
  startInputValue.value = formatSeconds(props.trimStart);
  endInputValue.value = formatSeconds(props.trimEnd > 0 ? props.trimEnd : effectiveDuration.value);

  if (focusHandle === 'start') {
    nextTick(() => {
      startInputRef.value?.focus();
      startInputRef.value?.select();
    });
  } else if (focusHandle === 'end') {
    nextTick(() => {
      endInputRef.value?.focus();
      endInputRef.value?.select();
    });
  }
}

function closePopover() {
  if (globalActiveGraphInstanceId.value === instanceId) {
    globalActiveGraphInstanceId.value = null;
  }
  areTrimPopoversOpen.value = false;
  focusedPopoverHandle.value = null;
}

watch(globalActiveGraphInstanceId, (activeId) => {
  if (activeId !== instanceId && areTrimPopoversOpen.value) {
    areTrimPopoversOpen.value = false;
    focusedPopoverHandle.value = null;
  }
});

watch(
  () => [props.trimStart, props.trimEnd, effectiveDuration.value],
  () => {
    if (document.activeElement !== startInputRef.value) {
      startInputValue.value = formatSeconds(props.trimStart);
    }
    if (document.activeElement !== endInputRef.value) {
      const endVal = props.trimEnd > 0 ? props.trimEnd : effectiveDuration.value;
      endInputValue.value = formatSeconds(endVal);
    }
  },
  { immediate: true }
);

function onStartInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  startInputValue.value = val;
  const parsed = parseTimeInput(val);
  if (parsed !== null && !isNaN(parsed)) {
    const maxDur = effectiveDuration.value;
    const minGap = Math.min(0.05, maxDur * 0.02);
    const end = props.trimEnd > 0 ? props.trimEnd : maxDur;
    const newStart = Math.max(0, Math.min(parsed, end - minGap));
    emit('update:trimStart', newStart);
    emit('trimChange', { start: newStart, end });
    emit('trimEndChange', { start: newStart, end });
  }
}

function onEndInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  endInputValue.value = val;
  const parsed = parseTimeInput(val);
  if (parsed !== null && !isNaN(parsed)) {
    const maxDur = effectiveDuration.value;
    const minGap = Math.min(0.05, maxDur * 0.02);
    const newEnd = Math.min(maxDur, Math.max(parsed, props.trimStart + minGap));
    emit('update:trimEnd', newEnd);
    emit('trimChange', { start: props.trimStart, end: newEnd });
    emit('trimEndChange', { start: props.trimStart, end: newEnd });
  }
}

function focusStartInput() {
  focusedPopoverHandle.value = 'start';
  startInputRef.value?.focus();
}

function focusEndInput() {
  focusedPopoverHandle.value = 'end';
  endInputRef.value?.focus();
}

function onInputFocus(handle: 'start' | 'end') {
  focusedPopoverHandle.value = handle;
  if (!areTrimPopoversOpen.value) {
    globalActiveGraphInstanceId.value = instanceId;
    areTrimPopoversOpen.value = true;
    startInputValue.value = formatSeconds(props.trimStart);
    endInputValue.value = formatSeconds(props.trimEnd > 0 ? props.trimEnd : effectiveDuration.value);
  }
  nextTick(() => {
    if (handle === 'start') {
      startInputRef.value?.select();
    } else {
      endInputRef.value?.select();
    }
  });
}

function onPopoverBlur(e: FocusEvent) {
  const related = e.relatedTarget as HTMLElement | null;
  if (
    related &&
    (related === startInputRef.value ||
      related === endInputRef.value ||
      related.closest?.('.trim-capsule-card'))
  ) {
    return;
  }

  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active === startInputRef.value || active === endInputRef.value) {
      return;
    }
    if (activeDragHandle.value) {
      return;
    }
    closePopover();
  });
}

function onPopoverKeydown(handle: 'start' | 'end', e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === 'Escape') {
    closePopover();
    (e.target as HTMLInputElement).blur();
    return;
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    const step = e.shiftKey ? 0.5 : (e.altKey ? 0.01 : 0.05);
    const delta = e.key === 'ArrowUp' ? step : -step;
    const maxDur = effectiveDuration.value;
    const minGap = Math.min(0.05, maxDur * 0.02);

    if (handle === 'start') {
      const current = parseTimeInput(startInputValue.value) ?? props.trimStart;
      const updated = Math.max(0, current + delta);
      startInputValue.value = formatSeconds(updated);
      const end = props.trimEnd > 0 ? props.trimEnd : maxDur;
      const newStart = Math.max(0, Math.min(updated, end - minGap));
      emit('update:trimStart', newStart);
      emit('trimChange', { start: newStart, end });
      emit('trimEndChange', { start: newStart, end });
      nextTick(() => {
        startInputRef.value?.select();
      });
    } else {
      const endVal = props.trimEnd > 0 ? props.trimEnd : maxDur;
      const current = parseTimeInput(endInputValue.value) ?? endVal;
      const updated = Math.max(0, current + delta);
      endInputValue.value = formatSeconds(updated);
      const newEnd = Math.min(maxDur, Math.max(updated, props.trimStart + minGap));
      emit('update:trimEnd', newEnd);
      emit('trimChange', { start: props.trimStart, end: newEnd });
      emit('trimEndChange', { start: props.trimStart, end: newEnd });
      nextTick(() => {
        endInputRef.value?.select();
      });
    }
  }
}

const capsuleCardStyle = computed(() => {
  const midPct = (startPercent.value + endPercent.value) / 2;
  return {
    left: `clamp(90px, ${midPct}%, calc(100% - 90px))`,
    transform: 'translateX(-50%)',
  };
});

const capsuleArrowStyle = computed(() => {
  const activePct = (focusedPopoverHandle.value === 'end' || activeDragHandle.value === 'end')
    ? endPercent.value
    : startPercent.value;
  const midPct = (startPercent.value + endPercent.value) / 2;
  const offset = (activePct - midPct) * 1.3;
  return {
    left: `clamp(14px, calc(50% + ${offset}%), calc(100% - 14px))`,
    transform: 'translateX(-50%)',
  };
});

function handleDocumentMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (target && containerRef.value?.contains(target)) {
    return;
  }
  closePopover();
}

function drawWaveform() {
  const canvas = canvasRef.value;
  const buffer = props.audioBuffer;
  if (!canvas || !buffer) return;

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    requestAnimationFrame(drawWaveform);
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = (canvas.width = Math.round(rect.width * dpr));
  const height = (canvas.height = Math.round(rect.height * dpr));

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  // 1. Resolve active tracks
  let activeTracks: WaveformTrack[] = [];
  if (props.tracks && props.tracks.length > 0) {
    activeTracks = props.tracks;
  } else if (buffer.numberOfChannels >= 2 && (!props.includeMic || !props.includeInput)) {
    // Fallback if legacy includeMic / includeInput are explicitly toggled without tracks prop
    activeTracks = [
      {
        label: '🎤 MIC (VOICE)',
        channelIndex: 0,
        enabled: props.includeMic,
        colors: ['#38bdf8', '#0284c7'],
      },
      {
        label: '🔊 INPUT DEVICE (AUDIO)',
        channelIndex: 1,
        enabled: props.includeInput,
        colors: ['#34d399', '#059669'],
      },
    ];
  } else {
    // Single unified track (mono or stereo merged)
    activeTracks = [
      {
        label: '',
        channelIndex: buffer.numberOfChannels >= 2 ? [0, 1] : 0,
        enabled: true,
        colors: ['#38bdf8', '#0284c7'],
      },
    ];
  }

  const numTracks = activeTracks.length;
  const trackLaneHeight = height / numTracks;

  const targetBarWidth = 2 * dpr;
  const targetBarGap = 1 * dpr;
  const nominalStep = targetBarWidth + targetBarGap;
  const numBars = Math.max(10, Math.floor(width / nominalStep));
  const barStep = width / numBars;
  const barWidth = Math.max(1, barStep - targetBarGap);
  const minBarH = Math.max(2, 1.5 * dpr);
  const cornerRadius = Math.max(1, 1 * dpr);

  for (let t = 0; t < numTracks; t++) {
    const track = activeTracks[t];
    const trackTop = t * trackLaneHeight;
    const trackBaseline = trackTop + trackLaneHeight / 2;
    const maxTrackHeight = (trackLaneHeight / 2) * (numTracks > 1 ? 0.88 : 0.92);

    // Separator line between multiple tracks
    if (numTracks >= 2 && t > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, trackTop);
      ctx.lineTo(width, trackTop);
      ctx.stroke();
    }

    // Resolve channel data arrays for this track
    let channelsToSample: Float32Array[] = [];
    if (Array.isArray(track.channelIndex)) {
      channelsToSample = track.channelIndex
        .filter(idx => idx >= 0 && idx < buffer.numberOfChannels)
        .map(idx => buffer.getChannelData(idx));
    } else if (typeof track.channelIndex === 'number') {
      if (track.channelIndex >= 0 && track.channelIndex < buffer.numberOfChannels) {
        channelsToSample = [buffer.getChannelData(track.channelIndex)];
      }
    }

    if (channelsToSample.length === 0) {
      if (numTracks === 1 && buffer.numberOfChannels >= 2) {
        channelsToSample = [buffer.getChannelData(0), buffer.getChannelData(1)];
      } else {
        channelsToSample = [buffer.getChannelData(Math.min(t, buffer.numberOfChannels - 1))];
      }
    }

    // Sample peaks across all channels for this track
    const primaryLen = channelsToSample[0].length;
    const trackPeaks = new Float32Array(numBars);
    let maxPeak = 0.001;

    for (let i = 0; i < numBars; i++) {
      const start = Math.floor((i / numBars) * primaryLen);
      const end = Math.min(primaryLen, Math.floor(((i + 1) / numBars) * primaryLen));

      let p = 0;
      for (let j = start; j < end; j++) {
        for (let c = 0; c < channelsToSample.length; c++) {
          const val = Math.abs(channelsToSample[c][j]);
          if (val > p) p = val;
        }
      }
      trackPeaks[i] = p;
      if (p > maxPeak) maxPeak = p;
    }

    // Independent track normalization with a floor to avoid boosting background noise
    const normFactor = Math.max(0.06, maxPeak);
    const isEnabled = track.enabled !== false;
    const colors = track.colors || (t % 2 === 0 ? ['#38bdf8', '#0284c7'] : ['#34d399', '#059669']);

    // Draw bars
    for (let i = 0; i < numBars; i++) {
      const normVal = Math.min(1, trackPeaks[i] / normFactor);
      const curved = Math.pow(normVal, 0.65);
      const x = i * barStep;
      const barH = Math.max(minBarH, curved * maxTrackHeight);
      const y = trackBaseline - barH / 2;

      if (isEnabled) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(1, colors[1]);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = 'rgba(113, 113, 122, 0.35)';
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, cornerRadius);
      ctx.fill();
    }

    // Draw track label badge pill only if label is provided and non-empty
    if (track.label && track.label.trim().length > 0) {
      const labelText = track.label.trim();
      const fontSize = Math.round(9.5 * dpr);
      ctx.font = `600 ${fontSize}px sans-serif`;
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = 'rgba(15, 15, 17, 0.72)';
      ctx.beginPath();
      ctx.roundRect(6 * dpr, trackTop + 4 * dpr, textWidth + 10 * dpr, fontSize + 8 * dpr, 3 * dpr);
      ctx.fill();

      ctx.fillStyle = isEnabled ? (colors[0] || 'rgba(56, 189, 248, 0.95)') : 'rgba(161, 161, 170, 0.6)';
      ctx.fillText(labelText, 11 * dpr, trackTop + 4 * dpr + fontSize);
    }
  }
}

function getSecondsFromMouseEvent(e: MouseEvent): number {
  if (!waveformWrapperRef.value) return 0;
  const rect = waveformWrapperRef.value.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const percent = relX / rect.width;
  return percent * effectiveDuration.value;
}

let handleDownX = 0;
let handleDownTime = 0;
let clickedHandle: 'start' | 'end' | null = null;
const isDraggingHandle = ref(false);
let dragInitialStart = 0;
let dragInitialEnd = 0;

function onStartHandleMouseDown(e: MouseEvent) {
  e.preventDefault();
  handleDownX = e.clientX;
  handleDownTime = Date.now();
  clickedHandle = 'start';
  activeDragHandle.value = 'start';
  isDraggingHandle.value = false;
  dragInitialStart = props.trimStart;
  dragInitialEnd = props.trimEnd > 0 ? props.trimEnd : effectiveDuration.value;
  openTrimPopovers();
  window.addEventListener('mousemove', onHandleMouseMove);
  window.addEventListener('mouseup', onHandleMouseUp);
}

function onEndHandleMouseDown(e: MouseEvent) {
  e.preventDefault();
  handleDownX = e.clientX;
  handleDownTime = Date.now();
  clickedHandle = 'end';
  activeDragHandle.value = 'end';
  isDraggingHandle.value = false;
  dragInitialStart = props.trimStart;
  dragInitialEnd = props.trimEnd > 0 ? props.trimEnd : effectiveDuration.value;
  openTrimPopovers();
  window.addEventListener('mousemove', onHandleMouseMove);
  window.addEventListener('mouseup', onHandleMouseUp);
}

function onPlayheadMouseDown(e: MouseEvent) {
  e.preventDefault();
  onWaveformMouseDown(e);
}

function onWaveformMouseDown(e: MouseEvent) {
  if (activeDragHandle.value) return;
  e.preventDefault();

  if (!props.enableScrubbing) {
    if (props.showTrimHandles) {
      const clickSec = getSecondsFromMouseEvent(e);
      const effectiveEnd = props.trimEnd > 0 ? props.trimEnd : effectiveDuration.value;
      const startDist = Math.abs(clickSec - props.trimStart);
      const endDist = Math.abs(clickSec - effectiveEnd);
      const minGap = Math.min(0.05, effectiveDuration.value * 0.02);

      if (startDist <= endDist) {
        activeDragHandle.value = 'start';
        handleDownX = e.clientX;
        handleDownTime = Date.now();
        isDraggingHandle.value = true;
        dragInitialStart = props.trimStart;
        dragInitialEnd = effectiveEnd;
        const newStart = Math.max(0, Math.min(clickSec, effectiveEnd - minGap));
        openTrimPopovers();
        startInputValue.value = formatSeconds(newStart);
        emit('update:trimStart', newStart);
        emit('trimChange', { start: newStart, end: effectiveEnd });
      } else {
        activeDragHandle.value = 'end';
        handleDownX = e.clientX;
        handleDownTime = Date.now();
        isDraggingHandle.value = true;
        dragInitialStart = props.trimStart;
        dragInitialEnd = effectiveEnd;
        const newEnd = Math.min(effectiveDuration.value, Math.max(clickSec, props.trimStart + minGap));
        openTrimPopovers();
        endInputValue.value = formatSeconds(newEnd);
        emit('update:trimEnd', newEnd);
        emit('trimChange', { start: props.trimStart, end: newEnd });
      }

      window.addEventListener('mousemove', onHandleMouseMove);
      window.addEventListener('mouseup', onHandleMouseUp);
    }
    return;
  }

  isScrubbing.value = true;

  const clickSec = getSecondsFromMouseEvent(e);
  const clamped = Math.max(0, Math.min(effectiveDuration.value, clickSec));
  internalScrubTime.value = clamped;
  emit('update:currentTime', clamped);
  emit('scrubStart', clamped);
  emit('scrubMove', clamped);

  window.addEventListener('mousemove', onScrubMouseMove);
  window.addEventListener('mouseup', onScrubMouseUp);
}

function onScrubMouseMove(e: MouseEvent) {
  if (!isScrubbing.value) return;
  // Ignore synthetic/invalid (0, 0) coordinates from Chromium native drag
  if (e.clientX === 0 && e.clientY === 0) return;
  if (e.buttons === 0) {
    onScrubMouseUp();
    return;
  }
  const sec = getSecondsFromMouseEvent(e);
  const clamped = Math.max(0, Math.min(effectiveDuration.value, sec));
  internalScrubTime.value = clamped;
  emit('update:currentTime', clamped);
  emit('scrubMove', clamped);
}

function onScrubMouseUp() {
  if (isScrubbing.value) {
    const finalTime = internalScrubTime.value ?? props.currentTime;
    isScrubbing.value = false;
    internalScrubTime.value = null;
    window.removeEventListener('mousemove', onScrubMouseMove);
    window.removeEventListener('mouseup', onScrubMouseUp);
    emit('scrubEnd', finalTime);
  }
}

function onHandleMouseMove(e: MouseEvent) {
  if (!activeDragHandle.value) return;
  if (e.clientX === 0 && e.clientY === 0) return;
  if (e.buttons === 0) {
    onHandleMouseUp(e);
    return;
  }

  // Deadband threshold: do not update position until mouse has moved at least 4px
  const dist = Math.abs(e.clientX - handleDownX);
  if (!isDraggingHandle.value && dist < 4) {
    return;
  }
  isDraggingHandle.value = true;

  if (!waveformWrapperRef.value) return;
  const rect = waveformWrapperRef.value.getBoundingClientRect();
  if (rect.width <= 0) return;

  const maxDur = effectiveDuration.value;
  if (maxDur <= 0) return;

  const deltaSec = ((e.clientX - handleDownX) / rect.width) * maxDur;
  const minGap = Math.min(0.05, maxDur * 0.02);

  if (activeDragHandle.value === 'start') {
    const end = dragInitialEnd;
    const newStart = Math.max(0, Math.min(dragInitialStart + deltaSec, end - minGap));
    startInputValue.value = formatSeconds(newStart);
    emit('update:trimStart', newStart);
    emit('trimChange', { start: newStart, end });
  } else if (activeDragHandle.value === 'end') {
    const newEnd = Math.min(maxDur, Math.max(dragInitialEnd + deltaSec, dragInitialStart + minGap));
    endInputValue.value = formatSeconds(newEnd);
    emit('update:trimEnd', newEnd);
    emit('trimChange', { start: props.trimStart, end: newEnd });
  }
}

function onHandleMouseUp(e?: MouseEvent) {
  if (activeDragHandle.value) {
    const wasDragging = isDraggingHandle.value;
    activeDragHandle.value = null;
    isDraggingHandle.value = false;
    window.removeEventListener('mousemove', onHandleMouseMove);
    window.removeEventListener('mouseup', onHandleMouseUp);

    if (wasDragging) {
      emit('trimEndChange', {
        start: props.trimStart,
        end: props.trimEnd > 0 ? props.trimEnd : effectiveDuration.value,
      });
    }

    if (e && clickedHandle) {
      const dist = Math.abs(e.clientX - handleDownX);
      const elapsed = Date.now() - handleDownTime;
      if (dist < 4 && elapsed < 350) {
        if (clickedHandle === 'start') {
          focusedPopoverHandle.value = 'start';
          nextTick(() => {
            startInputRef.value?.focus();
            startInputRef.value?.select();
          });
        } else {
          focusedPopoverHandle.value = 'end';
          nextTick(() => {
            endInputRef.value?.focus();
            endInputRef.value?.select();
          });
        }
      }
    }
    clickedHandle = null;
  }
}

watch(
  () => [props.audioBuffer, props.includeMic, props.includeInput],
  () => {
    nextTick(() => {
      drawWaveform();
    });
  }
);

onMounted(() => {
  window.addEventListener('resize', drawWaveform);
  window.addEventListener('mousedown', handleDocumentMouseDown, true);
  if (waveformWrapperRef.value) {
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          drawWaveform();
        }
      }
    });
    resizeObserver.observe(waveformWrapperRef.value);
  }
  nextTick(() => {
    requestAnimationFrame(drawWaveform);
  });
});

onUnmounted(() => {
  if (globalActiveGraphInstanceId.value === instanceId) {
    globalActiveGraphInstanceId.value = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  window.removeEventListener('resize', drawWaveform);
  window.removeEventListener('mousedown', handleDocumentMouseDown, true);
  window.removeEventListener('mousemove', onHandleMouseMove);
  window.removeEventListener('mouseup', onHandleMouseUp);
  window.removeEventListener('mousemove', onScrubMouseMove);
  window.removeEventListener('mouseup', onScrubMouseUp);
});

defineExpose({
  drawWaveform,
});
</script>

<style scoped>
.waveform-graph-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

/* Unified Trim Capsule Card */
.trim-capsule-card {
  position: absolute;
  top: -34px;
  z-index: 100;
  user-select: none;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.trim-capsule-card.is-open {
  opacity: 1;
  pointer-events: auto;
}

.trim-capsule-card.is-dragging {
  pointer-events: none;
}

.capsule-content {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  padding: 3px 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.85), 0 0 1px rgba(255, 255, 255, 0.15);
  white-space: nowrap;
}

.capsule-field {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 4px;
  padding: 1px 5px;
  cursor: text;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.capsule-field.start-field.is-focused {
  border-color: #22c55e;
  box-shadow: 0 0 0 1px #22c55e, 0 0 8px rgba(34, 197, 94, 0.25);
}

.capsule-field.end-field.is-focused {
  border-color: #ef4444;
  box-shadow: 0 0 0 1px #ef4444, 0 0 8px rgba(239, 68, 68, 0.25);
}

.capsule-badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  user-select: none;
}

.capsule-badge.start-badge {
  color: #22c55e;
}

.capsule-badge.end-badge {
  color: #ef4444;
}

.capsule-time-input {
  width: 58px;
  background: transparent !important;
  color: #f4f4f5 !important;
  border: none !important;
  outline: none !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
  font-size: 0.72rem !important;
  font-weight: 600 !important;
  padding: 0 !important;
  text-align: center !important;
  box-shadow: none !important;
}

.capsule-divider {
  color: #71717a;
  font-size: 0.75rem;
  font-weight: 600;
  user-select: none;
}

.capsule-arrow {
  position: absolute;
  top: 100%;
  width: 10px;
  height: 5px;
  background: #18181b;
  clip-path: polygon(0% 0%, 100% 0%, 50% 100%);
  margin-top: -1px;
}

.waveform-wrapper {
  position: relative;
  height: 140px;
  background: #0f0f11;
  border: 1px solid #27272a;
  border-radius: 8px;
  overflow: hidden;
  cursor: crosshair;
  user-select: none;
  width: 100%;
}

.waveform-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.trim-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.65);
  pointer-events: none;
}

.trim-overlay.start-overlay {
  left: 0;
}

.trim-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 16px;
  margin-left: -8px;
  cursor: ew-resize;
  z-index: 10;
  transition: z-index 0.1s;
  user-select: none;
  -webkit-user-drag: none;
}

.trim-handle:hover {
  z-index: 15;
}

.trim-handle.active-handle {
  z-index: 20;
}

.handle-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 7px;
  width: 2px;
}

.start-handle .handle-line {
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}

.end-handle .handle-line {
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
}

.handle-flag {
  position: absolute;
  top: 4px;
  font-size: 0.68rem;
  font-family: monospace;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  color: white;
  white-space: nowrap;
  pointer-events: none;
}

.start-flag {
  left: 8px;
  background: #15803d;
}

.end-flag {
  right: 8px;
  background: #b91c1c;
}

.playhead-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ffffff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.9), 0 0 12px rgba(56, 189, 248, 0.6);
  pointer-events: none;
  z-index: 25;
}

.playhead-cap {
  position: absolute;
  top: 0;
  left: -7px;
  width: 16px;
  height: 16px;
  background: #ffffff;
  clip-path: polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
  cursor: ew-resize;
  pointer-events: auto;
  transition: transform 0.1s ease;
  user-select: none;
  -webkit-user-drag: none;
}

.playhead-cap:hover {
  transform: scale(1.15);
}

.time-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  font-family: monospace;
  color: #71717a;
  padding: 0 0.25rem;
}
</style>
