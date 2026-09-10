<template>
  <div class="pulse-back-view">
    <!-- Top Header -->
    <div class="view-header">
      <div class="header-left">
        <h1 class="view-title">
          <svg class="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l3 3" />
          </svg>
          Pulse Back Studio
        </h1>
        <span class="header-subtitle">Review, trim, and publish audio replay clips to your soundboard</span>
      </div>

      <div class="header-right">
        <div class="buffer-indicator" :class="{ active: pulseBackStore.isBufferRunning }">
          <span class="status-indicator-dot"></span>
          <span>Buffer: {{ pulseBackStore.isBufferRunning ? 'Active (Listening)' : 'Disabled' }}</span>
        </div>

        <button
          :class="['trigger-clip-btn', { disabled: !pulseBackStore.isBufferRunning }]"
          :disabled="!pulseBackStore.isBufferRunning"
          @click="pulseBackStore.triggerQuickClip(settingsStore.pulse_back_default_duration || 30)"
          :title="`Capture past ${settingsStore.pulse_back_default_duration || 30} seconds right now`">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 19 2 12 11 5 11 19"></polygon>
            <polygon points="22 19 13 12 22 5 22 19"></polygon>
          </svg>
          Quick Clip ({{ settingsStore.pulse_back_default_duration || 30 }}s)
        </button>
      </div>
    </div>

    <!-- Main Workspace Split -->
    <div class="workspace">
      <!-- Left Rail: Clips List -->
      <div class="clips-rail">
        <div class="rail-header">
          <span class="rail-title">Captured Clips ({{ pulseBackStore.clips.length }})</span>
        </div>

        <div v-if="pulseBackStore.clips.length === 0" class="empty-clips">
          <svg class="w-10 h-10 text-zinc-600 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          <p class="font-medium text-zinc-300">No clips captured yet</p>
          <p class="text-xs text-zinc-500 mt-1">Press <kbd class="px-1 py-0.5 bg-zinc-800 rounded border border-zinc-700">F12</kbd> or click <strong>Clip</strong> in the top bar when audio happens.</p>
        </div>

        <div v-else class="clips-list">
          <div
            v-for="clip in pulseBackStore.clips"
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
            <button class="delete-clip-btn" @click.stop="deleteClip(clip.id)" title="Delete clip">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Right Area: Waveform Studio & Soundboard Export -->
      <div v-if="selectedClip" class="studio-main">
        <!-- Clip Details & Title -->
        <div class="clip-info-bar">
          <div class="title-input-group">
            <label for="clip-title-input">Clip Title:</label>
            <input
              id="clip-title-input"
              type="text"
              v-model="clipTitle"
              placeholder="Give your sound a name..."
              class="clip-title-input" />
          </div>

          <div class="playback-controls">
            <button
              class="play-btn"
              :class="{ playing: isPlaying }"
              @click="togglePlayPreview"
              title="Preview trimmed region">
              <svg v-if="!isPlaying" class="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            </button>
            <button class="stop-btn" @click="onStopBtnClick" title="Stop">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12"></rect>
              </svg>
            </button>
            <span class="time-readout">
              {{ formatSeconds(currentTime) }} / {{ formatSeconds(trimmedDuration) }}
            </span>
          </div>
        </div>

        <!-- Audio Tracks Selector (Mic & Input Device Mute/Unmute) -->
        <div v-if="hasDualChannels" class="audio-tracks-bar">
          <div class="tracks-heading">
            <span class="tracks-title">Audio Tracks in Clip:</span>
            <span class="tracks-subtitle">Toggle either track to mute or exclude it from the soundboard</span>
          </div>
          <div class="tracks-buttons">
            <button
              :class="['track-toggle-btn', { active: includeMic, muted: !includeMic }]"
              @click="toggleMicTrack"
              :title="includeMic ? 'Mute Microphone in this clip' : 'Unmute Microphone in this clip'">
              <inline-svg :src="includeMic ? MicrophoneIcon : MicrophoneSlashIcon" class="w-4 h-4" />
              <span class="track-name">Microphone</span>
              <span class="track-badge">{{ includeMic ? 'INCLUDED' : 'MUTED' }}</span>
            </button>

            <button
              :class="['track-toggle-btn', { active: includeInput, muted: !includeInput }]"
              @click="toggleInputTrack"
              :title="includeInput ? 'Mute Input Device in this clip' : 'Unmute Input Device in this clip'">
              <inline-svg :src="includeInput ? SpeakerIcon : HeadphonesIcon" class="w-4 h-4" />
              <span class="track-name">Input</span>
              <span class="track-badge">{{ includeInput ? 'INCLUDED' : 'MUTED' }}</span>
            </button>
          </div>
        </div>

        <!-- Waveform Visualizer & Trimmer -->
        <div class="waveform-container" ref="waveformContainerRef">
          <div class="waveform-labels">
            <span>Waveform Trimmer</span>
            <span class="text-xs text-zinc-400">Drag green handle for Start, red handle for End</span>
          </div>

          <div
            class="waveform-wrapper"
            ref="waveformWrapperRef"
            @mousedown="onWaveformMouseDown">
            <canvas ref="canvasRef" class="waveform-canvas"></canvas>

            <!-- Dimmed Region Overlays -->
            <div
              class="trim-overlay start-overlay"
              :style="{ width: `${startPercent}%` }"></div>
            <div
              class="trim-overlay end-overlay"
              :style="{ left: `${endPercent}%`, width: `${100 - endPercent}%` }"></div>

            <!-- Start Trim Handle -->
            <div
              class="trim-handle start-handle"
              :style="{ left: `${startPercent}%` }"
              @mousedown.stop="onStartHandleMouseDown"
              title="Drag Start Trim">
              <div class="handle-flag start-flag">In: {{ formatSeconds(trimStart) }}</div>
              <div class="handle-line"></div>
            </div>

            <!-- End Trim Handle -->
            <div
              class="trim-handle end-handle"
              :style="{ left: `${endPercent}%` }"
              @mousedown.stop="onEndHandleMouseDown"
              title="Drag End Trim">
              <div class="handle-flag end-flag">Out: {{ formatSeconds(trimEnd) }}</div>
              <div class="handle-line"></div>
            </div>

            <!-- Playhead Scrub Line -->
            <div
              class="playhead-line"
              :style="{ left: `${playheadPercent}%` }">
              <div class="playhead-cap"></div>
            </div>
          </div>

          <!-- Time Ticks along bottom -->
          <div class="time-ticks">
            <span>0:00</span>
            <span>{{ formatSeconds(selectedClip.duration * 0.25) }}</span>
            <span>{{ formatSeconds(selectedClip.duration * 0.5) }}</span>
            <span>{{ formatSeconds(selectedClip.duration * 0.75) }}</span>
            <span>{{ formatSeconds(selectedClip.duration) }}</span>
          </div>
        </div>

        <!-- Native Audio Element for 1:1 hardware clock playback -->
        <audio
          ref="audioElementRef"
          :src="selectedClip?.audioUrl"
          crossorigin="anonymous"
          preload="auto"
          style="display: none"
          @ended="onAudioEnded"></audio>

        <!-- Trim Range Summary Bar -->
        <div class="trim-summary-bar">
          <div class="trim-stats">
            <span class="stat-pill"><strong>Selected:</strong> {{ formatSeconds(trimmedDuration) }}</span>
            <span class="stat-pill"><strong>Start:</strong> {{ formatSeconds(trimStart) }}</span>
            <span class="stat-pill"><strong>End:</strong> {{ formatSeconds(trimEnd) }}</span>
          </div>

          <div class="trim-quick-actions">
            <button class="secondary-btn" @click="resetTrim">Reset Trim</button>
            <button class="secondary-btn" @click="playTrimmedOnly">Play Trimmed</button>
          </div>
        </div>

        <!-- Soundboard Publish Card -->
        <div class="publish-card">
          <h2 class="publish-heading">Add to Soundboard</h2>
          <div class="publish-grid">
            <div class="publish-field">
              <label>Button Color:</label>
              <div class="flex items-center gap-2">
                <input type="color" v-model="clipColor" class="color-picker-input cursor-pointer" />
                <span class="text-xs text-zinc-400 uppercase font-mono">{{ clipColor }}</span>
              </div>
            </div>

            <div class="publish-field">
              <label>Tags (comma separated):</label>
              <input
                type="text"
                v-model="clipTagsString"
                placeholder="e.g. funny, meme, scream"
                class="tags-input" />
            </div>

            <div class="publish-field">
              <label>Volume: {{ clipVolume }}%</label>
              <input type="range" min="0" max="100" v-model="clipVolume" class="volume-slider cursor-pointer" />
            </div>
          </div>

          <div class="publish-actions">
            <button class="publish-btn" :disabled="isPublishing" @click="publishToSoundboard">
              <svg class="w-5 h-5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {{ isPublishing ? 'Publishing...' : 'Add to Soundboard' }}
            </button>
          </div>
        </div>
      </div>

      <!-- No Clip Selected -->
      <div v-else class="studio-empty">
        <p class="text-zinc-400">Select a clip on the left to edit and publish</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import InlineSvg from 'vue-inline-svg'
import { usePulseBackStore, PulseBackClip } from '../store/pulseBack'
import { useSettingsStore } from '../store/settings'
import { encodeWAV } from '../services/pulseBackBuffer'
import MicrophoneIcon from '../assets/images/microphone.svg'
import MicrophoneSlashIcon from '../assets/images/microphone-slash.svg'
import SpeakerIcon from '../assets/images/speaker.svg'
import HeadphonesIcon from '../assets/images/headphones.svg'

const pulseBackStore = usePulseBackStore()
const settingsStore = useSettingsStore()

const selectedClip = computed(() => pulseBackStore.selectedClip)

// Editor State
const clipTitle = ref('')
const clipColor = ref('#3b82f6')
const clipTagsString = ref('clip')
const clipVolume = ref(100)
const isPublishing = ref(false)

// Trimming State
const trimStart = ref(0)
const trimEnd = ref(0)

// Waveform & Audio State
const canvasRef = ref<HTMLCanvasElement | null>(null)
const waveformWrapperRef = ref<HTMLDivElement | null>(null)
const audioElementRef = ref<HTMLAudioElement | null>(null)
let audioBuffer: AudioBuffer | null = null
let audioContext: AudioContext | null = null
let mediaSourceNode: MediaElementAudioSourceNode | null = null
let splitterNode: ChannelSplitterNode | null = null
let micGainNode: GainNode | null = null
let inputGainNode: GainNode | null = null

// Dual-Track State
const includeMic = ref(true)
const includeInput = ref(true)
const hasDualChannels = ref(false)

// Playback State
const isPlaying = ref(false)
const currentTime = ref(0)
let playbackEndSec = 0
let playbackAnimationId: number | null = null

const audioDuration = computed(() => audioBuffer?.duration || selectedClip.value?.duration || 1)

const trimmedDuration = computed(() => Math.max(0, trimEnd.value - trimStart.value))

const startPercent = computed(() => {
  if (audioDuration.value <= 0) return 0
  return Math.max(0, Math.min(100, (trimStart.value / audioDuration.value) * 100))
})

const endPercent = computed(() => {
  if (audioDuration.value <= 0) return 100
  return Math.max(0, Math.min(100, (trimEnd.value / audioDuration.value) * 100))
})

const playheadPercent = computed(() => {
  if (audioDuration.value <= 0) return 0
  return Math.max(0, Math.min(100, (currentTime.value / audioDuration.value) * 100))
})

watch(
  () => selectedClip.value?.id,
  async newId => {
    stopPreview()
    if (!selectedClip.value) return

    clipTitle.value = selectedClip.value.title
    clipTagsString.value = (selectedClip.value.tags || ['clip']).join(', ')
    trimStart.value = 0
    trimEnd.value = selectedClip.value.duration
    currentTime.value = 0
    includeMic.value = true
    includeInput.value = true

    if (audioElementRef.value) {
      audioElementRef.value.currentTime = 0
    }

    await loadAudioData(selectedClip.value.blob)
  },
  { immediate: true }
)

function setupAudioGraph() {
  const audioEl = audioElementRef.value
  if (!audioEl || mediaSourceNode) return

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!audioContext) {
      audioContext = new AudioContextClass()
    }
    mediaSourceNode = audioContext.createMediaElementSource(audioEl)
    splitterNode = audioContext.createChannelSplitter(2)
    micGainNode = audioContext.createGain()
    inputGainNode = audioContext.createGain()

    micGainNode.gain.value = includeMic.value ? 1 : 0
    inputGainNode.gain.value = includeInput.value ? 1 : 0

    mediaSourceNode.connect(splitterNode)

    // Route Left (Mic) -> micGainNode -> destination (centers mono output in stereo headphones)
    splitterNode.connect(micGainNode, 0)
    micGainNode.connect(audioContext.destination)

    // Route Right (Input) -> inputGainNode -> destination (centers mono output in stereo headphones)
    splitterNode.connect(inputGainNode, 1)
    inputGainNode.connect(audioContext.destination)
  } catch (err) {
    console.warn('AudioGraph setup warning (audio will play directly):', err)
  }
}

async function loadAudioData(blob: Blob) {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!audioContext) {
      audioContext = new AudioContextClass()
    }
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    hasDualChannels.value = audioBuffer.numberOfChannels >= 2
    trimEnd.value = audioBuffer.duration
    await nextTick()
    requestAnimationFrame(() => {
      drawWaveform()
    })
  } catch (err) {
    console.error('Failed to decode audio data for waveform:', err)
  }
}

function toggleMicTrack() {
  includeMic.value = !includeMic.value
  setupAudioGraph()
  if (micGainNode && audioContext) {
    micGainNode.gain.setValueAtTime(includeMic.value ? 1 : 0, audioContext.currentTime)
  }
  drawWaveform()
}

function toggleInputTrack() {
  includeInput.value = !includeInput.value
  setupAudioGraph()
  if (inputGainNode && audioContext) {
    inputGainNode.gain.setValueAtTime(includeInput.value ? 1 : 0, audioContext.currentTime)
  }
  drawWaveform()
}

function drawWaveform() {
  const canvas = canvasRef.value
  if (!canvas || !audioBuffer) return

  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    requestAnimationFrame(drawWaveform)
    return
  }

  const dpr = window.devicePixelRatio || 1
  const width = (canvas.width = Math.round(rect.width * dpr))
  const height = (canvas.height = Math.round(rect.height * dpr))

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, width, height)

  const isDual = audioBuffer.numberOfChannels >= 2
  const barWidth = 2 * (window.devicePixelRatio || 1)
  const barGap = 1 * (window.devicePixelRatio || 1)
  const totalBarWidth = barWidth + barGap
  const numBars = Math.floor(width / totalBarWidth)

  if (isDual) {
    const micData = audioBuffer.getChannelData(0)
    const inputData = audioBuffer.getChannelData(1)
    const halfHeight = height / 2
    const samplesPerBar = Math.floor(micData.length / numBars)

    // Center dividing line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.lineWidth = 1 * (window.devicePixelRatio || 1)
    ctx.beginPath()
    ctx.moveTo(0, halfHeight)
    ctx.lineTo(width, halfHeight)
    ctx.stroke()

    // 1. Draw Mic Track (Top Half)
    const micBaseline = halfHeight * 0.5
    for (let i = 0; i < numBars; i++) {
      const start = i * samplesPerBar
      let peak = 0
      for (let j = 0; j < samplesPerBar; j++) {
        const val = Math.abs(micData[start + j])
        if (val > peak) peak = val
      }
      const x = i * totalBarWidth
      const barH = Math.max(2, peak * (halfHeight * 0.88))
      const y = micBaseline - barH / 2

      if (includeMic.value) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barH)
        grad.addColorStop(0, '#38bdf8')
        grad.addColorStop(1, '#0284c7')
        ctx.fillStyle = grad
      } else {
        ctx.fillStyle = 'rgba(113, 113, 122, 0.35)'
      }

      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barH, 1)
      ctx.fill()
    }

    // 2. Draw Input Device Track (Bottom Half)
    const inputBaseline = halfHeight + halfHeight * 0.5
    for (let i = 0; i < numBars; i++) {
      const start = i * samplesPerBar
      let peak = 0
      for (let j = 0; j < samplesPerBar; j++) {
        const val = Math.abs(inputData[start + j])
        if (val > peak) peak = val
      }
      const x = i * totalBarWidth
      const barH = Math.max(2, peak * (halfHeight * 0.88))
      const y = inputBaseline - barH / 2

      if (includeInput.value) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barH)
        grad.addColorStop(0, '#34d399')
        grad.addColorStop(1, '#059669')
        ctx.fillStyle = grad
      } else {
        ctx.fillStyle = 'rgba(113, 113, 122, 0.35)'
      }

      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barH, 1)
      ctx.fill()
    }

    // Watermark track labels inside canvas
    ctx.font = `600 ${10 * (window.devicePixelRatio || 1)}px sans-serif`
    ctx.fillStyle = includeMic.value ? 'rgba(56, 189, 248, 0.85)' : 'rgba(113, 113, 122, 0.5)'
    ctx.fillText('🎤 MIC (VOICE)', 10 * (window.devicePixelRatio || 1), 16 * (window.devicePixelRatio || 1))

    ctx.fillStyle = includeInput.value ? 'rgba(52, 211, 153, 0.85)' : 'rgba(113, 113, 122, 0.5)'
    ctx.fillText('🔊 INPUT DEVICE (AUDIO)', 10 * (window.devicePixelRatio || 1), halfHeight + 16 * (window.devicePixelRatio || 1))
  } else {
    // Single mono channel
    const channelData = audioBuffer.getChannelData(0)
    const amp = height / 2
    const samplesPerBar = Math.floor(channelData.length / numBars)

    for (let i = 0; i < numBars; i++) {
      const start = i * samplesPerBar
      let peak = 0
      for (let j = 0; j < samplesPerBar; j++) {
        const val = Math.abs(channelData[start + j])
        if (val > peak) peak = val
      }

      const x = i * totalBarWidth
      const barHeight = Math.max(3, peak * amp * 0.95)
      const y = amp - barHeight / 2

      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight)
      gradient.addColorStop(0, '#38bdf8')
      gradient.addColorStop(1, '#2563eb')
      ctx.fillStyle = gradient

      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, 2)
      ctx.fill()
    }
  }
}

function selectClip(clip: PulseBackClip) {
  pulseBackStore.selectedClipId = clip.id
}

async function deleteClip(id: string) {
  stopPreview()
  await pulseBackStore.deleteClip(id)
}

function resetTrim() {
  if (!selectedClip.value) return
  trimStart.value = 0
  trimEnd.value = selectedClip.value.duration
}

function playTrimmedOnly() {
  stopPreview()
  startPlayback(trimStart.value, trimEnd.value)
}

function togglePlayPreview() {
  if (isPlaying.value) {
    stopPreview()
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
  if (audioElementRef.value) {
    audioElementRef.value.currentTime = trimStart.value
  }
}

async function startPlayback(offsetSec: number, endSec: number) {
  const audioEl = audioElementRef.value
  if (!audioEl || !selectedClip.value) return

  setupAudioGraph()

  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume().catch(() => {})
  }

  playbackEndSec = endSec
  audioEl.currentTime = offsetSec
  currentTime.value = offsetSec

  try {
    await audioEl.play()
    isPlaying.value = true
    updatePlaybackAnimation()
  } catch (err) {
    console.error('Audio play error:', err)
  }
}

function updatePlaybackAnimation() {
  const audioEl = audioElementRef.value
  if (!isPlaying.value || !audioEl) return

  // Playhead directly tracks native HTML5 audio clock with zero latency
  currentTime.value = audioEl.currentTime

  if (currentTime.value >= playbackEndSec || audioEl.ended) {
    stopPreview()
    currentTime.value = trimStart.value
    audioEl.currentTime = trimStart.value
    return
  }

  playbackAnimationId = requestAnimationFrame(updatePlaybackAnimation)
}

function stopPreview() {
  const audioEl = audioElementRef.value
  if (audioEl) {
    audioEl.pause()
  }
  if (playbackAnimationId) {
    cancelAnimationFrame(playbackAnimationId)
    playbackAnimationId = null
  }
  isPlaying.value = false
}

function onAudioEnded() {
  stopPreview()
  currentTime.value = trimStart.value
  if (audioElementRef.value) {
    audioElementRef.value.currentTime = trimStart.value
  }
}

// Dragging Trim Handles & Scrubbing
let isDraggingStart = false
let isDraggingEnd = false
let isScrubbing = false

function getSecondsFromMouseEvent(e: MouseEvent): number {
  if (!waveformWrapperRef.value || !selectedClip.value) return 0
  const rect = waveformWrapperRef.value.getBoundingClientRect()
  const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const percent = relX / rect.width
  return percent * audioDuration.value
}

function onStartHandleMouseDown(e: MouseEvent) {
  isDraggingStart = true
  window.addEventListener('mousemove', onHandleMouseMove)
  window.addEventListener('mouseup', onHandleMouseUp)
}

function onEndHandleMouseDown(e: MouseEvent) {
  isDraggingEnd = true
  window.addEventListener('mousemove', onHandleMouseMove)
  window.addEventListener('mouseup', onHandleMouseUp)
}

function onWaveformMouseDown(e: MouseEvent) {
  isScrubbing = true
  const clickSec = getSecondsFromMouseEvent(e)
  currentTime.value = Math.max(0, Math.min(audioDuration.value, clickSec))
  if (audioElementRef.value) {
    audioElementRef.value.currentTime = currentTime.value
  }
  if (isPlaying.value) {
    startPlayback(currentTime.value, trimEnd.value)
  }
  window.addEventListener('mousemove', onScrubMouseMove)
  window.addEventListener('mouseup', onScrubMouseUp)
}

function onScrubMouseMove(e: MouseEvent) {
  if (!isScrubbing) return
  const sec = getSecondsFromMouseEvent(e)
  currentTime.value = Math.max(0, Math.min(audioDuration.value, sec))
  if (audioElementRef.value) {
    audioElementRef.value.currentTime = currentTime.value
  }
}

function onScrubMouseUp() {
  if (isScrubbing) {
    isScrubbing = false
    if (isPlaying.value && audioElementRef.value) {
      startPlayback(currentTime.value, trimEnd.value)
    }
    window.removeEventListener('mousemove', onScrubMouseMove)
    window.removeEventListener('mouseup', onScrubMouseUp)
  }
}

function onHandleMouseMove(e: MouseEvent) {
  const sec = getSecondsFromMouseEvent(e)
  if (isDraggingStart) {
    trimStart.value = Math.max(0, Math.min(sec, trimEnd.value - 0.2))
  } else if (isDraggingEnd) {
    trimEnd.value = Math.min(selectedClip.value?.duration || 0, Math.max(sec, trimStart.value + 0.2))
  }
}

function onHandleMouseUp() {
  isDraggingStart = false
  isDraggingEnd = false
  window.removeEventListener('mousemove', onHandleMouseMove)
  window.removeEventListener('mouseup', onHandleMouseUp)
}

async function publishToSoundboard() {
  if (!selectedClip.value || !audioBuffer || isPublishing.value) return

  isPublishing.value = true
  try {
    // Slice the audio buffer to the trimmed range
    const sampleRate = audioBuffer.sampleRate
    const startSample = Math.max(0, Math.floor(trimStart.value * sampleRate))
    const endSample = Math.min(audioBuffer.length, Math.floor(trimEnd.value * sampleRate))
    const length = Math.max(0, endSample - startSample)

    const slicedSamples = new Float32Array(length)
    const micData = audioBuffer.getChannelData(0).subarray(startSample, endSample)
    const hasSecondChannel = audioBuffer.numberOfChannels >= 2
    const inputData = hasSecondChannel ? audioBuffer.getChannelData(1).subarray(startSample, endSample) : null

    if (includeMic.value && (!hasSecondChannel || !includeInput.value || !inputData)) {
      slicedSamples.set(micData)
    } else if (!includeMic.value && hasSecondChannel && includeInput.value && inputData) {
      slicedSamples.set(inputData)
    } else if (hasSecondChannel && inputData && includeMic.value && includeInput.value) {
      for (let i = 0; i < length; i++) {
        slicedSamples[i] = Math.max(-1, Math.min(1, (micData[i] + inputData[i]) * 0.75))
      }
    } else {
      slicedSamples.set(micData)
    }

    const trimmedBlob = encodeWAV(slicedSamples, sampleRate)
    const duration = slicedSamples.length / sampleRate

    const tags = clipTagsString.value
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    await pulseBackStore.publishToSoundboard(selectedClip.value.id, trimmedBlob, duration, {
      title: clipTitle.value.trim() || selectedClip.value.title,
      tags,
      color: clipColor.value,
      volume: clipVolume.value,
    })
  } catch (err) {
    console.error('Failed to publish clip to soundboard:', err)
  } finally {
    isPublishing.value = false
  }
}

function formatSeconds(secs: number): string {
  if (isNaN(secs) || secs < 0) secs = 0
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  const ms = Math.floor((secs % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

let waveformResizeObserver: ResizeObserver | null = null

onMounted(() => {
  window.addEventListener('resize', drawWaveform)
  if (waveformWrapperRef.value) {
    waveformResizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          drawWaveform()
        }
      }
    })
    waveformResizeObserver.observe(waveformWrapperRef.value)
  }
  nextTick(() => {
    requestAnimationFrame(drawWaveform)
  })
})

onUnmounted(() => {
  stopPreview()
  if (waveformResizeObserver) {
    waveformResizeObserver.disconnect()
    waveformResizeObserver = null
  }
  window.removeEventListener('resize', drawWaveform)
  window.removeEventListener('mousemove', onHandleMouseMove)
  window.removeEventListener('mouseup', onHandleMouseUp)
  window.removeEventListener('mousemove', onScrubMouseMove)
  window.removeEventListener('mouseup', onScrubMouseUp)
})
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

.buffer-indicator {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
  padding: 0.35rem 0.65rem;
  background: #27272a;
  border-radius: 9999px;
  color: #a1a1aa;
}

.buffer-indicator.active {
  color: #34d399;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.status-indicator-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #71717a;
}

.buffer-indicator.active .status-indicator-dot {
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.trigger-clip-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  background: #2563eb;
  color: white;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.trigger-clip-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.trigger-clip-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

.delete-clip-btn {
  background: transparent;
  border: none;
  color: #71717a;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.15s ease;
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

.playback-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
}

.waveform-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 600;
  color: #e4e4e7;
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
  width: 12px;
  margin-left: -6px;
  cursor: ew-resize;
  z-index: 10;
}

.handle-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 5px;
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
  left: -5px;
  width: 12px;
  height: 12px;
  background: #ffffff;
  clip-path: polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
}

.time-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  font-family: monospace;
  color: #71717a;
  padding: 0 0.25rem;
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

.secondary-btn:hover {
  background: #3f3f46;
  color: white;
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

.tags-input {
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  padding: 0.4rem 0.65rem;
  color: white;
  font-size: 0.85rem;
}

.volume-slider {
  width: 100%;
}

.publish-actions {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #27272a;
  padding-top: 1rem;
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
  align-items: center;
  justify-content: space-between;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 10px;
  padding: 0.75rem 1.25rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.tracks-heading {
  display: flex;
  flex-direction: column;
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
  gap: 0.5rem;
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  background: #27272a;
  border: 1px solid #3f3f46;
  color: #d4d4d8;
  transition: all 0.15s ease;
  user-select: none;
}

.track-toggle-btn:hover {
  background: #3f3f46;
}

.track-toggle-btn.active {
  background: rgba(56, 189, 248, 0.12);
  border-color: #38bdf8;
  color: #38bdf8;
}

.track-toggle-btn:nth-child(2).active {
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

.track-toggle-btn:nth-child(2).active .track-badge {
  background: rgba(52, 211, 153, 0.2);
  color: #34d399;
}

.track-toggle-btn.muted .track-badge {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
</style>
