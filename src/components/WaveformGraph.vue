<template>
  <div class="waveform-graph-container">
    <div class="waveform-wrapper"
         ref="waveformWrapperRef"
         :style="wrapperStyle"
         @mousedown="onWaveformMouseDown">
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
             title="Drag Start Trim">
          <div class="handle-flag start-flag">In: {{ formatSeconds(trimStart) }}</div>
          <div class="handle-line"></div>
        </div>

        <!-- End Trim Handle -->
        <div :class="['trim-handle', 'end-handle', { 'active-handle': activeDragHandle === 'end' }]"
             :style="{ left: `${endPercent}%` }"
             @mousedown.stop="onEndHandleMouseDown"
             title="Drag End Trim">
          <div class="handle-flag end-flag">Out: {{ formatSeconds(trimEnd) }}</div>
          <div class="handle-line"></div>
        </div>
      </template>

      <!-- Playhead Scrub Line -->
      <div class="playhead-line"
           :style="{ left: `${playheadPercent}%` }">
        <div class="playhead-cap"
             @mousedown.stop="onPlayheadMouseDown"
             title="Drag to Scrub Playhead"></div>
      </div>
    </div>

    <!-- Time Ticks along bottom -->
    <div class="time-ticks">
      <span>0:00</span>
      <span>{{ formatSeconds(effectiveDuration * 0.25) }}</span>
      <span>{{ formatSeconds(effectiveDuration * 0.5) }}</span>
      <span>{{ formatSeconds(effectiveDuration * 0.75) }}</span>
      <span>{{ formatSeconds(effectiveDuration) }}</span>
    </div>
    <span v-if="showTrimHandles"
          class="text-xs text-zinc-400">Drag green handle for Start, red handle for End</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

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

const canvasRef = ref<HTMLCanvasElement | null>(null);
const waveformWrapperRef = ref<HTMLDivElement | null>(null);

const activeDragHandle = ref<'start' | 'end' | null>(null);
let isScrubbing = false;
let resizeObserver: ResizeObserver | null = null;

const effectiveDuration = computed(() => {
  if (props.duration > 0) return props.duration;
  if (props.audioBuffer?.duration) return props.audioBuffer.duration;
  return 1;
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
  return Math.max(0, Math.min(100, (props.currentTime / effectiveDuration.value) * 100));
});

const wrapperStyle = computed(() => {
  if (!props.height) return undefined;
  return {
    height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  };
});

function formatSeconds(sec: number): string {
  if (isNaN(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
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

function onStartHandleMouseDown(e: MouseEvent) {
  e.preventDefault();
  activeDragHandle.value = 'start';
  window.addEventListener('mousemove', onHandleMouseMove);
  window.addEventListener('mouseup', onHandleMouseUp);
}

function onEndHandleMouseDown(e: MouseEvent) {
  e.preventDefault();
  activeDragHandle.value = 'end';
  window.addEventListener('mousemove', onHandleMouseMove);
  window.addEventListener('mouseup', onHandleMouseUp);
}

function onPlayheadMouseDown(e: MouseEvent) {
  e.preventDefault();
  onWaveformMouseDown(e);
}

function onWaveformMouseDown(e: MouseEvent) {
  e.preventDefault();
  isScrubbing = true;

  const clickSec = getSecondsFromMouseEvent(e);
  const clamped = Math.max(0, Math.min(effectiveDuration.value, clickSec));
  emit('update:currentTime', clamped);
  emit('scrubStart', clamped);
  emit('scrubMove', clamped);

  window.addEventListener('mousemove', onScrubMouseMove);
  window.addEventListener('mouseup', onScrubMouseUp);
}

function onScrubMouseMove(e: MouseEvent) {
  if (!isScrubbing) return;
  // Ignore synthetic/invalid (0, 0) coordinates from Chromium native drag
  if (e.clientX === 0 && e.clientY === 0) return;
  if (e.buttons === 0) {
    onScrubMouseUp();
    return;
  }
  const sec = getSecondsFromMouseEvent(e);
  const clamped = Math.max(0, Math.min(effectiveDuration.value, sec));
  emit('update:currentTime', clamped);
  emit('scrubMove', clamped);
}

function onScrubMouseUp() {
  if (isScrubbing) {
    isScrubbing = false;
    window.removeEventListener('mousemove', onScrubMouseMove);
    window.removeEventListener('mouseup', onScrubMouseUp);
    emit('scrubEnd', props.currentTime);
  }
}

function onHandleMouseMove(e: MouseEvent) {
  if (!activeDragHandle.value) return;
  if (e.clientX === 0 && e.clientY === 0) return;
  if (e.buttons === 0) {
    onHandleMouseUp();
    return;
  }
  const maxDur = effectiveDuration.value;
  if (maxDur <= 0) return;
  const sec = getSecondsFromMouseEvent(e);
  const minGap = Math.min(0.05, maxDur * 0.02);

  if (activeDragHandle.value === 'start') {
    const end = props.trimEnd > 0 ? props.trimEnd : maxDur;
    const newStart = Math.max(0, Math.min(sec, end - minGap));
    emit('update:trimStart', newStart);
    emit('trimChange', { start: newStart, end });
  } else if (activeDragHandle.value === 'end') {
    const newEnd = Math.min(maxDur, Math.max(sec, props.trimStart + minGap));
    emit('update:trimEnd', newEnd);
    emit('trimChange', { start: props.trimStart, end: newEnd });
  }
}

function onHandleMouseUp() {
  if (activeDragHandle.value) {
    activeDragHandle.value = null;
    window.removeEventListener('mousemove', onHandleMouseMove);
    window.removeEventListener('mouseup', onHandleMouseUp);
    emit('trimEndChange', {
      start: props.trimStart,
      end: props.trimEnd > 0 ? props.trimEnd : effectiveDuration.value,
    });
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
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  window.removeEventListener('resize', drawWaveform);
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
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
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
