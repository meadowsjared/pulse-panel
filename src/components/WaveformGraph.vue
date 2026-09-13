<template>
  <div class="waveform-graph-container">
    <div class="waveform-wrapper"
         ref="waveformWrapperRef"
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
    <span v-if="showTrimHandles" class="text-xs text-zinc-400">Drag green handle for Start, red handle for End</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

interface Props {
  audioBuffer: AudioBuffer | null;
  duration?: number;
  currentTime?: number;
  trimStart?: number;
  trimEnd?: number;
  includeMic?: boolean;
  includeInput?: boolean;
  showTrimHandles?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  duration: 0,
  currentTime: 0,
  trimStart: 0,
  trimEnd: 0,
  includeMic: true,
  includeInput: true,
  showTrimHandles: true,
});

const emit = defineEmits<{
  (e: 'update:currentTime', time: number): void;
  (e: 'update:trimStart', time: number): void;
  (e: 'update:trimEnd', time: number): void;
  (e: 'scrubStart', time: number): void;
  (e: 'scrubMove', time: number): void;
  (e: 'scrubEnd', time: number): void;
  (e: 'trimChange', payload: { start: number; end: number }): void;
  (e: 'trimEndChange', payload: { start: number; end: number }): void;
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

  const isDual = buffer.numberOfChannels >= 2;
  const targetBarWidth = 2 * dpr;
  const targetBarGap = 1 * dpr;
  const nominalStep = targetBarWidth + targetBarGap;
  const numBars = Math.max(10, Math.floor(width / nominalStep));
  const barStep = width / numBars;
  const barWidth = Math.max(1, barStep - targetBarGap);
  const minBarH = Math.max(2, 1.5 * dpr);
  const cornerRadius = Math.max(1, 1 * dpr);

  if (isDual) {
    const micData = buffer.getChannelData(0);
    const inputData = buffer.getChannelData(1);
    const halfHeight = height / 2;
    const maxTrackHeight = halfHeight * 0.88;

    // Center dividing line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, halfHeight);
    ctx.lineTo(width, halfHeight);
    ctx.stroke();

    // Sample peaks for both tracks
    const micPeaks = new Float32Array(numBars);
    const inputPeaks = new Float32Array(numBars);
    let maxMicPeak = 0.001;
    let maxInputPeak = 0.001;

    for (let i = 0; i < numBars; i++) {
      const start = Math.floor((i / numBars) * micData.length);
      const end = Math.min(micData.length, Math.floor(((i + 1) / numBars) * micData.length));

      let pMic = 0;
      let pInput = 0;
      for (let j = start; j < end; j++) {
        const vMic = Math.abs(micData[j]);
        if (vMic > pMic) pMic = vMic;
        const vIn = Math.abs(inputData[j]);
        if (vIn > pInput) pInput = vIn;
      }
      micPeaks[i] = pMic;
      inputPeaks[i] = pInput;
      if (pMic > maxMicPeak) maxMicPeak = pMic;
      if (pInput > maxInputPeak) maxInputPeak = pInput;
    }

    // Auto-normalize tracks independently with a floor to avoid boosting noise
    const micNormFactor = Math.max(0.06, maxMicPeak);
    const inputNormFactor = Math.max(0.06, maxInputPeak);

    // 1. Draw Mic Track (Top Half)
    const micBaseline = halfHeight * 0.5;
    for (let i = 0; i < numBars; i++) {
      const normVal = Math.min(1, micPeaks[i] / micNormFactor);
      const curved = Math.pow(normVal, 0.65);
      const x = i * barStep;
      const barH = Math.max(minBarH, curved * maxTrackHeight);
      const y = micBaseline - barH / 2;

      if (props.includeMic) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#0284c7');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = 'rgba(113, 113, 122, 0.35)';
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, cornerRadius);
      ctx.fill();
    }

    // 2. Draw Input Device Track (Bottom Half)
    const inputBaseline = halfHeight + halfHeight * 0.5;
    for (let i = 0; i < numBars; i++) {
      const normVal = Math.min(1, inputPeaks[i] / inputNormFactor);
      const curved = Math.pow(normVal, 0.65);
      const x = i * barStep;
      const barH = Math.max(minBarH, curved * maxTrackHeight);
      const y = inputBaseline - barH / 2;

      if (props.includeInput) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, '#34d399');
        grad.addColorStop(1, '#059669');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = 'rgba(113, 113, 122, 0.35)';
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, cornerRadius);
      ctx.fill();
    }

    // Watermark track badges inside canvas with subtle backdrop pill
    const fontSize = Math.round(9.5 * dpr);
    ctx.font = `600 ${fontSize}px sans-serif`;

    const micText = '🎤 MIC (VOICE)';
    const micTextWidth = ctx.measureText(micText).width;
    ctx.fillStyle = 'rgba(15, 15, 17, 0.72)';
    ctx.beginPath();
    ctx.roundRect(6 * dpr, 4 * dpr, micTextWidth + 10 * dpr, fontSize + 8 * dpr, 3 * dpr);
    ctx.fill();
    ctx.fillStyle = props.includeMic ? 'rgba(56, 189, 248, 0.95)' : 'rgba(161, 161, 170, 0.6)';
    ctx.fillText(micText, 11 * dpr, 4 * dpr + fontSize);

    const inText = '🔊 INPUT DEVICE (AUDIO)';
    const inTextWidth = ctx.measureText(inText).width;
    ctx.fillStyle = 'rgba(15, 15, 17, 0.72)';
    ctx.beginPath();
    ctx.roundRect(6 * dpr, halfHeight + 4 * dpr, inTextWidth + 10 * dpr, fontSize + 8 * dpr, 3 * dpr);
    ctx.fill();
    ctx.fillStyle = props.includeInput ? 'rgba(52, 211, 153, 0.95)' : 'rgba(161, 161, 170, 0.6)';
    ctx.fillText(inText, 11 * dpr, halfHeight + 4 * dpr + fontSize);
  } else {
    // Single mono channel
    const channelData = buffer.getChannelData(0);
    const amp = height / 2;
    const maxTrackHeight = amp * 0.92;

    const monoPeaks = new Float32Array(numBars);
    let maxPeak = 0.001;

    for (let i = 0; i < numBars; i++) {
      const start = Math.floor((i / numBars) * channelData.length);
      const end = Math.min(channelData.length, Math.floor(((i + 1) / numBars) * channelData.length));
      let peak = 0;
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > peak) peak = val;
      }
      monoPeaks[i] = peak;
      if (peak > maxPeak) maxPeak = peak;
    }

    const normFactor = Math.max(0.06, maxPeak);

    for (let i = 0; i < numBars; i++) {
      const normVal = Math.min(1, monoPeaks[i] / normFactor);
      const curved = Math.pow(normVal, 0.65);
      const x = i * barStep;
      const barHeight = Math.max(minBarH, curved * maxTrackHeight);
      const y = amp - barHeight / 2;

      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, '#38bdf8');
      gradient.addColorStop(1, '#2563eb');
      ctx.fillStyle = gradient;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, cornerRadius);
      ctx.fill();
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
