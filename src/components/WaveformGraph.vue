<template>
  <div ref="containerRef" :class="['waveform-graph-container', { 'is-dragging-handle': isDraggingHandle }]">
    <div
      :class="['waveform-wrapper', { 'is-dragging-handle': isDraggingHandle }]"
      ref="waveformWrapperRef"
      :style="wrapperStyle"
      @mousedown="onWaveformMouseDown"
      @dblclick="onWaveformDblClick"
      @dragstart.prevent.stop>
      <canvas ref="canvasRef" class="waveform-canvas"></canvas>

      <!-- Dimmed Region Overlays -->
      <template v-if="showTrimHandles">
        <!-- Dimmed region before Start Handle (spans full height) -->
        <div class="trim-overlay start-overlay" :style="{ width: `${startPercent}%` }"></div>

        <!-- Dimmed region after End Handle (spans full height) -->
        <div
          class="trim-overlay end-overlay"
          :style="{
            left: `${endPercent}%`,
            width: `${100 - endPercent}%`,
          }"></div>

        <!-- Active Selection Range Window (between In and Out points) -->
        <div
          class="selection-range-window"
          :style="{
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`,
          }">
          <!-- Top dimmed curtain (anchored to top: 0, shrinks/grows as spotlight moves) -->
          <div v-if="isDualTrackLayout" class="selection-dim-curtain dim-top" :style="topDimStyle"></div>

          <!-- Active Selection Spotlight (glides vertically between tracks) -->
          <div
            class="selection-spotlight"
            :class="['track-' + (activeTrack || 'both')]"
            :style="selectionLaneStyle"></div>

          <!-- Bottom dimmed curtain (anchored to bottom: 0, shrinks/grows as spotlight moves) -->
          <div v-if="isDualTrackLayout" class="selection-dim-curtain dim-bottom" :style="bottomDimStyle"></div>
        </div>
      </template>

      <!-- Segment Boundary Divider Lines (Interactive White Clip Handles) -->
      <template v-if="segmentBoundaries && segmentBoundaries.length">
        <div
          v-for="(boundarySec, idx) in segmentBoundaries"
          :key="'boundary-' + idx"
          class="segment-boundary-line"
          :class="{
            'is-snapped': snappedBoundarySec !== null && Math.abs(snappedBoundarySec - boundarySec) < 0.002,
            'is-dragging-handle': isDraggingHandle,
          }"
          :style="{ left: `${(boundarySec / effectiveDuration) * 100}%` }"
          @mousedown.stop
          @click.stop="onBoundaryClick(boundarySec, $event)"
          @contextmenu.prevent.stop="onBoundaryContextMenu(boundarySec, $event)"
          :title="`Clip boundary at ${formatSeconds(boundarySec)} — Click for options`">
          <div class="segment-boundary-hit-area"></div>
        </div>
      </template>

      <!-- Start & End Trim Handles -->
      <template v-if="showTrimHandles">
        <!-- Start Trim Handle -->
        <div
          :class="[
            'trim-handle',
            'start-handle',
            {
              'active-handle': activeDragHandle === 'start',
              'is-snapped':
                (activeSnapLineSec !== null && activeDragHandle === 'start') ||
                (isSnappedToStationaryHandle && activeDragHandle === 'end'),
            },
          ]"
          :style="{ left: `${startPercent}%` }"
          @mousedown.stop="onStartHandleMouseDown"
          @dblclick.stop="openTrimPopovers('start')"
          @contextmenu.prevent.stop="openTrimPopovers('start')"
          :title="`Start: ${formatSeconds(trimStart)} (Drag to trim, hold Shift to snap, click to edit)`">
          <div
            v-if="showTrimLabels"
            class="handle-flag start-flag"
            @mousedown.stop="onStartHandleMouseDown"
            @click.stop="openTrimPopovers('start')">
            In: {{ formatSeconds(trimStart) }}
          </div>
          <div class="handle-line"></div>
        </div>

        <!-- End Trim Handle -->
        <div
          :class="[
            'trim-handle',
            'end-handle',
            {
              'active-handle': activeDragHandle === 'end',
              'is-snapped':
                (activeSnapLineSec !== null && activeDragHandle === 'end') ||
                (isSnappedToStationaryHandle && activeDragHandle === 'start'),
            },
          ]"
          :style="{ left: `${endPercent}%` }"
          @mousedown.stop="onEndHandleMouseDown"
          @dblclick.stop="openTrimPopovers('end')"
          @contextmenu.prevent.stop="openTrimPopovers('end')"
          :title="`End: ${formatSeconds(trimEnd)} (Drag to trim, hold Shift to snap, click to edit)`">
          <div
            v-if="showTrimLabels"
            class="handle-flag end-flag"
            @mousedown.stop="onEndHandleMouseDown"
            @click.stop="openTrimPopovers('end')">
            Out: {{ formatSeconds(trimEnd) }}
          </div>
          <div class="handle-line"></div>
        </div>
      </template>

      <!-- Active Snap Guideline (Clean Amber Line with Lock Emoji Below) -->
      <div
        v-if="activeSnapLineSec !== null"
        class="active-snap-guideline"
        :style="{ left: `${Math.max(0, Math.min(100, (activeSnapLineSec / effectiveDuration) * 100))}%` }">
        <div class="snap-lock-foot" title="Snapped to boundary">🔒</div>
      </div>

      <!-- Playhead Scrub Line -->
      <div
        v-if="showPlayhead"
        class="playhead-line"
        :class="{ 'is-snapped': isSnappedToPlayhead }"
        :style="{ left: `${playheadPercent}%` }">
        <div
          class="playhead-hit-area"
          @mousedown.stop="onPlayheadMouseDown"
          @contextmenu.prevent.stop="onPlayheadContextMenu"
          title="Left-click to edit time, Right-click for options, Drag to scrub"></div>
        <div
          class="playhead-cap"
          @mousedown.stop="onPlayheadMouseDown"
          @contextmenu.prevent.stop="onPlayheadContextMenu"
          title="Left-click to edit time, Right-click for options, Drag to scrub"></div>
      </div>
    </div>

    <!-- Segment Boundary Quick Actions Popover -->
    <div v-if="activeBoundaryMenu" class="boundary-menu-popover" :style="boundaryMenuStyle" @mousedown.stop @click.stop>
      <div class="boundary-menu-header">
        <span class="boundary-menu-title">Clip Boundary: {{ formatSeconds(activeBoundaryMenu.sec) }}</span>
        <button type="button" class="boundary-menu-close" @click="closeBoundaryMenu">✕</button>
      </div>
      <div class="boundary-menu-items">
        <button type="button" class="boundary-menu-btn" @click="joinAtBoundary(activeBoundaryMenu.sec)">
          <span class="btn-icon">🔗</span>
          Join Audio Clips Here
        </button>
        <div class="boundary-menu-divider"></div>
        <button type="button" class="boundary-menu-btn" @click="selectLeftOfBoundary(activeBoundaryMenu.sec)">
          <span class="btn-icon">◀</span>
          Select Left Clip (In ➔ Divider)
        </button>
        <button type="button" class="boundary-menu-btn" @click="selectRightOfBoundary(activeBoundaryMenu.sec)">
          <span class="btn-icon">▶</span>
          Select Right Clip (Divider ➔ Out)
        </button>
        <div class="boundary-menu-divider"></div>
        <button type="button" class="boundary-menu-btn" @click="setInAtBoundary(activeBoundaryMenu.sec)">
          <span class="badge in">IN</span>
          Set Green Handle (In) Here
        </button>
        <button type="button" class="boundary-menu-btn" @click="setOutAtBoundary(activeBoundaryMenu.sec)">
          <span class="badge out">OUT</span>
          Set Red Handle (Out) Here
        </button>
        <div class="boundary-menu-divider"></div>
        <button type="button" class="boundary-menu-btn" @click="seekToBoundary(activeBoundaryMenu.sec)">
          <span class="btn-icon">⏱</span>
          Move Playhead Here
        </button>
      </div>
    </div>

    <!-- Unified Trim Capsule Popover -->
    <div
      v-if="showTrimHandles && areTrimPopoversOpen"
      class="trim-capsule-card is-open"
      :class="{ 'is-dragging': isDraggingHandle }"
      :style="capsuleCardStyle"
      @mousedown.stop
      @click.stop>
      <div class="capsule-content">
        <!-- Start Input Field -->
        <div
          class="capsule-field start-field"
          :class="{ 'is-focused': focusedPopoverHandle === 'start' }"
          @click="focusStartInput">
          <span class="capsule-badge start-badge">IN</span>
          <input
            ref="startInputRef"
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
        <div
          class="capsule-field end-field"
          :class="{ 'is-focused': focusedPopoverHandle === 'end' }"
          @click="focusEndInput">
          <span class="capsule-badge end-badge">OUT</span>
          <input
            ref="endInputRef"
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

    <!-- Playhead Quick Actions Context Menu Popover (Right-click) -->
    <div
      v-if="activePlayheadMenu"
      class="boundary-menu-popover playhead-menu-popover"
      :style="playheadMenuStyle"
      @mousedown.stop
      @click.stop>
      <div class="boundary-menu-header">
        <span class="boundary-menu-title">Cursor: {{ formatSeconds(activePlayheadMenu.sec) }}</span>
        <button type="button" class="boundary-menu-close" @click="closePlayheadMenu">✕</button>
      </div>
      <div class="boundary-menu-items">
        <button type="button" class="boundary-menu-btn" @click="setInAtPlayhead(activePlayheadMenu.sec)">
          <span class="badge in">IN</span>
          Set In to Cursor
        </button>
        <button type="button" class="boundary-menu-btn" @click="setOutAtPlayhead(activePlayheadMenu.sec)">
          <span class="badge out">OUT</span>
          Set Out to Cursor
        </button>
        <div class="boundary-menu-divider"></div>
        <button type="button" class="boundary-menu-btn" @click="splitAtPlayhead(activePlayheadMenu.sec)">
          <span class="btn-icon">✂</span>
          Split Clip at Cursor
        </button>
        <button
          v-if="playheadNearBoundary !== null"
          type="button"
          class="boundary-menu-btn"
          @click="joinAtBoundary(playheadNearBoundary)">
          <span class="btn-icon">🔗</span>
          Join Audio Clips at Boundary
        </button>
        <div class="boundary-menu-divider"></div>
        <button type="button" class="boundary-menu-btn" @click="openTimeInputFromMenu(activePlayheadMenu.sec)">
          <span class="btn-icon">⌨</span>
          Type Cursor Time...
        </button>
        <button type="button" class="boundary-menu-btn" @click="togglePlayFromPlayhead(activePlayheadMenu.sec)">
          <span class="btn-icon">{{ isPlaying ? '⏸' : '▶' }}</span>
          {{ isPlaying ? 'Pause Playback' : 'Play from Cursor' }}
        </button>
        <button
          v-if="canPaste"
          type="button"
          class="boundary-menu-btn"
          @click="pasteAtPlayhead(activePlayheadMenu.sec)">
          <span class="btn-icon">📋</span>
          Paste Audio at Cursor
        </button>
        <button type="button" class="boundary-menu-btn" @click="jumpCursorToIn">
          <span class="btn-icon">⏮</span>
          Jump Cursor to In Point
        </button>
      </div>
    </div>

    <!-- Playhead Time Capsule Card (Left-click to edit cursor location) -->
    <div
      v-if="isPlayheadPopoverOpen"
      class="trim-capsule-card playhead-capsule-card is-open"
      :style="playheadCapsuleStyle"
      @mousedown.stop
      @click.stop>
      <div class="capsule-content">
        <div class="capsule-field playhead-field is-focused" @click="focusPlayheadInput">
          <span class="capsule-badge playhead-badge">CURSOR</span>
          <input
            ref="playheadInputRef"
            v-model="playheadInputValue"
            class="capsule-time-input playhead"
            placeholder="0:00.00"
            @focus="onPlayheadInputFocus"
            @input="onPlayheadInput"
            @blur="onPlayheadBlur($event)"
            @keydown="onPlayheadKeydown($event)" />
        </div>
      </div>
      <div class="capsule-arrow playhead-arrow"></div>
    </div>

    <!-- Time Ticks along bottom -->
    <div v-if="showTimeTicks" class="time-ticks">
      <span>0:00</span>
      <span>{{ formatSeconds(effectiveDuration * 0.25) }}</span>
      <span>{{ formatSeconds(effectiveDuration * 0.5) }}</span>
      <span>{{ formatSeconds(effectiveDuration * 0.75) }}</span>
      <span>{{ formatSeconds(effectiveDuration) }}</span>
    </div>
    <span v-if="showTrimHandles && showTrimInstructions" class="text-xs text-zinc-400"
      >Drag green handle for Start, red handle for End</span
    >
  </div>
</template>

<script lang="ts">
// Shared across all WaveformGraph instances so opening one closes all other popovers
let graphInstanceCounter = 0
const globalActiveGraphInstanceId = ref<number | null>(null)

export interface WaveformTrack {
  /** Label displayed in the watermark badge pill (e.g. '🎤 MIC (VOICE)'). If empty or undefined, badge is omitted. */
  label?: string
  /** AudioBuffer channel index or indices to sample. If undefined, samples all available channels. */
  channelIndex?: number | number[]
  /** Whether the track is enabled/active. When false, the track is rendered dimmed/muted. Defaults to true. */
  enabled?: boolean
  /** Custom gradient colors [startColor, endColor] for the bars. */
  colors?: [string, string]
}
</script>

<script setup lang="ts">
interface Props {
  audioBuffer: AudioBuffer | null
  duration?: number
  currentTime?: number
  trimStart?: number
  trimEnd?: number
  showTrimHandles?: boolean
  showTrimLabels?: boolean
  showTrimInstructions?: boolean
  showTimeTicks?: boolean
  showPlayhead?: boolean
  isPlaying?: boolean
  playheadOnlyOnDrag?: boolean
  playheadOnlyWhenActive?: boolean
  enableScrubbing?: boolean
  tracks?: WaveformTrack[]
  height?: number | string
  includeMic?: boolean
  includeInput?: boolean
  activeTrack?: 'both' | 'mic' | 'input'
  segmentBoundaries?: number[]
  canPaste?: boolean
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
  activeTrack: 'both',
  segmentBoundaries: () => [],
  canPaste: false,
})

const emit = defineEmits<{
  (e: 'update:currentTime', time: number): void
  (e: 'update:trimStart', time: number): void
  (e: 'update:trimEnd', time: number): void
  (e: 'scrubStart', time: number): void
  (e: 'scrubMove', time: number): void
  (e: 'scrubEnd', time: number): void
  (e: 'trimChange', payload: { start: number; end: number; handle?: 'start' | 'end' }): void
  (e: 'trimEndChange', payload: { start: number; end: number; handle?: 'start' | 'end' }): void
  (e: 'splitAt', sec: number): void
  (e: 'joinAt', sec: number): void
  (e: 'playFromCursor', sec: number): void
  (e: 'pasteAtCursor', sec: number): void
}>()

const instanceId = ++graphInstanceCounter
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const waveformWrapperRef = ref<HTMLDivElement | null>(null)

const activeDragHandle = ref<'start' | 'end' | null>(null)
const internalDragStartTime = ref<number | null>(null)
const isScrubbing = ref(false)
const internalScrubTime = ref<number | null>(null)
let resizeObserver: ResizeObserver | null = null

const effectiveDuration = computed(() => {
  if (props.duration > 0) return props.duration
  if (props.audioBuffer?.duration) return props.audioBuffer.duration
  return 1
})

const displayCurrentTime = computed(() => {
  if (isScrubbing.value && internalScrubTime.value !== null) {
    return internalScrubTime.value
  }
  if (isDraggingHandle.value && activeDragHandle.value === 'start' && internalDragStartTime.value !== null) {
    return internalDragStartTime.value
  }
  return props.currentTime
})

const isAtStartPosition = computed(() => {
  const t = displayCurrentTime.value
  return t <= 0.02 || (props.showTrimHandles && Math.abs(t - props.trimStart) <= 0.02)
})

const showPlayhead = computed(() => {
  if (!props.showPlayhead) return false
  if (!isScrubbing.value && !props.isPlaying && isAtStartPosition.value) {
    return false
  }
  if (props.playheadOnlyWhenActive || props.playheadOnlyOnDrag) {
    return isScrubbing.value || Boolean(props.isPlaying)
  }
  return isScrubbing.value || Boolean(props.isPlaying) || !isAtStartPosition.value
})

const startPercent = computed(() => {
  if (effectiveDuration.value <= 0) return 0
  return Math.max(0, Math.min(100, (props.trimStart / effectiveDuration.value) * 100))
})

const endPercent = computed(() => {
  if (effectiveDuration.value <= 0) return 0
  return Math.max(0, Math.min(100, (props.trimEnd / effectiveDuration.value) * 100))
})

const playheadPercent = computed(() => {
  if (effectiveDuration.value <= 0) return 0
  return Math.max(0, Math.min(100, (displayCurrentTime.value / effectiveDuration.value) * 100))
})

const wrapperStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.height) {
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }
  if (!props.enableScrubbing) {
    style.cursor = props.showTrimHandles ? 'pointer' : 'default'
  }
  return Object.keys(style).length > 0 ? style : undefined
})

const isDualTrackLayout = computed(() => {
  if (props.tracks && props.tracks.length >= 2) return true
  if (props.audioBuffer && props.audioBuffer.numberOfChannels >= 2) return true
  return false
})

const selectionLaneStyle = computed(() => {
  if (!isDualTrackLayout.value || props.activeTrack === 'both' || !props.activeTrack) {
    return { top: '0', height: '100%' }
  }
  if (props.activeTrack === 'mic') {
    return { top: '0', height: '50%' }
  }
  if (props.activeTrack === 'input') {
    return { top: '50%', height: '50%' }
  }
  return { top: '0', height: '100%' }
})

// Top dimmed curtain: anchored to top: 0. Grows when spotlight moves down, shrinks when spotlight moves up.
const topDimStyle = computed(() => {
  if (!isDualTrackLayout.value || props.activeTrack === 'both' || !props.activeTrack || props.activeTrack === 'mic') {
    return { height: '0%' }
  }
  return { height: '50%' }
})

// Bottom dimmed curtain: anchored to bottom: 0. Shrinks when spotlight moves down, grows when spotlight moves up.
const bottomDimStyle = computed(() => {
  if (!isDualTrackLayout.value || props.activeTrack === 'both' || !props.activeTrack || props.activeTrack === 'input') {
    return { height: '0%' }
  }
  return { height: '50%' }
})

function formatSeconds(sec: number): string {
  if (isNaN(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 100)
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

function parseTimeInput(input: string): number | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':')
    const m = parseFloat(parts[0])
    const s = parts[1] === '' ? 0 : parseFloat(parts[1])
    if (isNaN(m) && isNaN(s)) return null
    return Math.max(0, (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s))
  }
  const sec = parseFloat(trimmed)
  if (isNaN(sec)) return null
  return Math.max(0, sec)
}

const areTrimPopoversOpen = ref(false)
const focusedPopoverHandle = ref<'start' | 'end' | null>(null)
const startInputValue = ref('')
const endInputValue = ref('')
const startInputRef = ref<HTMLInputElement | null>(null)
const endInputRef = ref<HTMLInputElement | null>(null)

function openTrimPopovers(focusHandle?: 'start' | 'end') {
  globalActiveGraphInstanceId.value = instanceId
  closePlayheadPopover()
  closePlayheadMenu()
  areTrimPopoversOpen.value = true
  focusedPopoverHandle.value = focusHandle ?? null
  startInputValue.value = formatSeconds(props.trimStart)
  endInputValue.value = formatSeconds(props.trimEnd)

  if (focusHandle === 'start') {
    nextTick(() => {
      startInputRef.value?.focus({ preventScroll: true })
      startInputRef.value?.select()
    })
  } else if (focusHandle === 'end') {
    nextTick(() => {
      endInputRef.value?.focus({ preventScroll: true })
      endInputRef.value?.select()
    })
  }
}

function closePopover() {
  if (globalActiveGraphInstanceId.value === instanceId) {
    globalActiveGraphInstanceId.value = null
  }
  areTrimPopoversOpen.value = false
  focusedPopoverHandle.value = null
}

watch(globalActiveGraphInstanceId, activeId => {
  if (activeId !== instanceId) {
    if (areTrimPopoversOpen.value) {
      areTrimPopoversOpen.value = false
      focusedPopoverHandle.value = null
    }
    if (isPlayheadPopoverOpen.value) {
      isPlayheadPopoverOpen.value = false
    }
    if (activePlayheadMenu.value) {
      activePlayheadMenu.value = null
    }
  }
})

watch(
  () => [props.trimStart, props.trimEnd, effectiveDuration.value],
  () => {
    if (document.activeElement !== startInputRef.value) {
      startInputValue.value = formatSeconds(props.trimStart)
    }
    if (document.activeElement !== endInputRef.value) {
      const endVal = props.trimEnd
      endInputValue.value = formatSeconds(endVal)
    }
  },
  { immediate: true }
)

function onStartInput(e: Event) {
  if (!(e.target instanceof HTMLInputElement)) return
  const val = e.target.value
  startInputValue.value = val
  const parsed = parseTimeInput(val)
  if (parsed !== null && !isNaN(parsed)) {
    const maxDur = effectiveDuration.value
    const end = props.trimEnd
    const newStart = Math.max(0, Math.min(parsed, maxDur))
    const newEnd = Math.max(newStart, end)
    emit('update:trimStart', newStart)
    emit('update:trimEnd', newEnd)
    emit('update:currentTime', newStart)
    emit('trimChange', { start: newStart, end: newEnd, handle: 'start' })
    emit('trimEndChange', { start: newStart, end: newEnd, handle: 'start' })
  }
}

function onEndInput(e: Event) {
  if (!(e.target instanceof HTMLInputElement)) return
  const val = e.target.value
  endInputValue.value = val
  const parsed = parseTimeInput(val)
  if (parsed !== null && !isNaN(parsed)) {
    const maxDur = effectiveDuration.value
    const newEnd = Math.max(0, Math.min(maxDur, parsed))
    const newStart = Math.min(props.trimStart, newEnd)
    emit('update:trimStart', newStart)
    emit('update:trimEnd', newEnd)
    if (props.currentTime > newEnd) {
      emit('update:currentTime', newStart)
    }
    emit('trimChange', { start: newStart, end: newEnd, handle: 'end' })
    emit('trimEndChange', { start: newStart, end: newEnd, handle: 'end' })
  }
}

function focusStartInput() {
  focusedPopoverHandle.value = 'start'
  startInputRef.value?.focus({ preventScroll: true })
}

function focusEndInput() {
  focusedPopoverHandle.value = 'end'
  endInputRef.value?.focus({ preventScroll: true })
}

function onInputFocus(handle: 'start' | 'end') {
  focusedPopoverHandle.value = handle
  if (!areTrimPopoversOpen.value) {
    globalActiveGraphInstanceId.value = instanceId
    areTrimPopoversOpen.value = true
    startInputValue.value = formatSeconds(props.trimStart)
    endInputValue.value = formatSeconds(props.trimEnd)
  }
  nextTick(() => {
    if (handle === 'start') {
      startInputRef.value?.focus({ preventScroll: true })
      startInputRef.value?.select()
    } else {
      endInputRef.value?.focus({ preventScroll: true })
      endInputRef.value?.select()
    }
  })
}

function onPopoverBlur(e: FocusEvent) {
  const related = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null
  if (
    related &&
    (related === startInputRef.value || related === endInputRef.value || related.closest?.('.trim-capsule-card'))
  ) {
    return
  }

  requestAnimationFrame(() => {
    const active = document.activeElement
    if (active === startInputRef.value || active === endInputRef.value) {
      return
    }
    if (activeDragHandle.value) {
      return
    }
    closePopover()
  })
}

function onPopoverKeydown(handle: 'start' | 'end', e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === 'Escape') {
    closePopover()
    if (e.target instanceof HTMLElement) {
      e.target.blur()
    }
    return
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    const step = e.shiftKey ? 0.5 : e.altKey ? 0.01 : 0.05
    const delta = e.key === 'ArrowUp' ? step : -step
    const maxDur = effectiveDuration.value

    if (handle === 'start') {
      const current = parseTimeInput(startInputValue.value) ?? props.trimStart
      const end = props.trimEnd
      const newStart = Math.max(0, Math.min(current + delta, end))
      startInputValue.value = formatSeconds(newStart)
      emit('update:trimStart', newStart)
      emit('update:currentTime', newStart)
      emit('trimChange', { start: newStart, end, handle: 'start' })
      emit('trimEndChange', { start: newStart, end, handle: 'start' })
      nextTick(() => {
        startInputRef.value?.select()
      })
    } else {
      const current = parseTimeInput(endInputValue.value) ?? props.trimEnd
      const newEnd = Math.max(0, Math.min(maxDur, current + delta))
      const newStart = Math.min(props.trimStart, newEnd)
      endInputValue.value = formatSeconds(newEnd)
      emit('update:trimStart', newStart)
      emit('update:trimEnd', newEnd)
      if (props.currentTime > newEnd) {
        emit('update:currentTime', newStart)
      }
      emit('trimChange', { start: newStart, end: newEnd, handle: 'end' })
      emit('trimEndChange', { start: newStart, end: newEnd, handle: 'end' })
      nextTick(() => {
        endInputRef.value?.select()
      })
    }
  }
}

const capsuleCardStyle = computed(() => {
  const midPct = (startPercent.value + endPercent.value) / 2
  return {
    left: `clamp(90px, ${midPct}%, calc(100% - 90px))`,
    transform: 'translateX(-50%)',
  }
})

const capsuleArrowStyle = computed(() => {
  const activePct =
    focusedPopoverHandle.value === 'end' || activeDragHandle.value === 'end' ? endPercent.value : startPercent.value
  const midPct = (startPercent.value + endPercent.value) / 2
  const offset = (activePct - midPct) * 1.3
  return {
    left: `clamp(14px, calc(50% + ${offset}%), calc(100% - 14px))`,
    transform: 'translateX(-50%)',
  }
})

// Interactive Clip Boundary Menu State
const activeBoundaryMenu = ref<{ sec: number; x: number; y: number } | null>(null)
const snappedBoundarySec = ref<number | null>(null)
const activeSnapLineSec = ref<number | null>(null)
const snapBadgeText = ref<string>('')
const isSnappedToStationaryHandle = ref(false)
const isSnappedToPlayhead = ref(false)

const boundaryMenuStyle = computed(() => {
  if (!activeBoundaryMenu.value || !containerRef.value) return {}
  const containerRect = containerRef.value.getBoundingClientRect()
  const relX = activeBoundaryMenu.value.x - containerRect.left
  const clampedX = Math.max(120, Math.min(containerRect.width - 120, relX))
  return {
    left: `${clampedX}px`,
    top: '12px',
    transform: 'translateX(-50%)',
  }
})

function onBoundaryClick(sec: number, e: MouseEvent) {
  if (isDraggingHandle.value) return
  activeBoundaryMenu.value = {
    sec,
    x: e.clientX,
    y: e.clientY,
  }
}

function onBoundaryContextMenu(sec: number, e: MouseEvent) {
  activeBoundaryMenu.value = {
    sec,
    x: e.clientX,
    y: e.clientY,
  }
}

function closeBoundaryMenu() {
  activeBoundaryMenu.value = null
}

function selectLeftOfBoundary(boundarySec: number) {
  const maxDur = effectiveDuration.value
  const boundaries =
    props.segmentBoundaries && props.segmentBoundaries.length > 0
      ? [0, ...props.segmentBoundaries, maxDur].sort((a, b) => a - b)
      : [0, maxDur]

  let prev = 0
  for (const b of boundaries) {
    if (b < boundarySec - 0.01) {
      prev = b
    } else {
      break
    }
  }

  startInputValue.value = formatSeconds(prev)
  endInputValue.value = formatSeconds(boundarySec)
  emit('update:trimStart', prev)
  emit('update:trimEnd', boundarySec)
  emit('update:currentTime', prev)
  emit('trimChange', { start: prev, end: boundarySec, handle: 'start' })
  emit('trimEndChange', { start: prev, end: boundarySec, handle: 'start' })
  closeBoundaryMenu()
}

function selectRightOfBoundary(boundarySec: number) {
  const maxDur = effectiveDuration.value
  const boundaries =
    props.segmentBoundaries && props.segmentBoundaries.length > 0
      ? [0, ...props.segmentBoundaries, maxDur].sort((a, b) => a - b)
      : [0, maxDur]

  let next = maxDur
  for (let i = boundaries.length - 1; i >= 0; i--) {
    const b = boundaries[i]
    if (b > boundarySec + 0.01) {
      next = b
    } else {
      break
    }
  }

  startInputValue.value = formatSeconds(boundarySec)
  endInputValue.value = formatSeconds(next)
  emit('update:trimStart', boundarySec)
  emit('update:trimEnd', next)
  emit('update:currentTime', boundarySec)
  emit('trimChange', { start: boundarySec, end: next, handle: 'start' })
  emit('trimEndChange', { start: boundarySec, end: next, handle: 'start' })
  closeBoundaryMenu()
}

function setInAtBoundary(boundarySec: number) {
  let newStart = boundarySec
  let newEnd = props.trimEnd
  if (newStart > newEnd) {
    newEnd = newStart
  }
  startInputValue.value = formatSeconds(newStart)
  endInputValue.value = formatSeconds(newEnd)
  emit('update:trimStart', newStart)
  emit('update:trimEnd', newEnd)
  emit('update:currentTime', newStart)
  emit('trimChange', { start: newStart, end: newEnd, handle: 'start' })
  emit('trimEndChange', { start: newStart, end: newEnd, handle: 'start' })
  closeBoundaryMenu()
}

function setOutAtBoundary(boundarySec: number) {
  let newStart = props.trimStart
  let newEnd = boundarySec
  if (newEnd < newStart) {
    newStart = newEnd
  }
  startInputValue.value = formatSeconds(newStart)
  endInputValue.value = formatSeconds(newEnd)
  emit('update:trimStart', newStart)
  emit('update:trimEnd', newEnd)
  if (props.currentTime > newEnd) {
    emit('update:currentTime', newStart)
  }
  emit('trimChange', { start: newStart, end: newEnd, handle: 'end' })
  emit('trimEndChange', { start: newStart, end: newEnd, handle: 'end' })
  closeBoundaryMenu()
}

function joinAtBoundary(boundarySec: number) {
  emit('joinAt', boundarySec)
  closeBoundaryMenu()
  closePlayheadMenu()
}

function seekToBoundary(boundarySec: number) {
  emit('update:currentTime', boundarySec)
  emit('scrubStart', boundarySec)
  emit('scrubMove', boundarySec)
  emit('scrubEnd', boundarySec)
  closeBoundaryMenu()
}

// Playhead Time Capsule & Context Menu State
const isPlayheadPopoverOpen = ref(false)
const playheadInputValue = ref('')
const playheadInputRef = ref<HTMLInputElement | null>(null)
const activePlayheadMenu = ref<{ sec: number; x: number; y: number } | null>(null)

const playheadNearBoundary = computed(() => {
  if (!activePlayheadMenu.value || !props.segmentBoundaries || props.segmentBoundaries.length === 0) return null
  const sec = activePlayheadMenu.value.sec
  const match = props.segmentBoundaries.find(b => Math.abs(b - sec) <= 0.05)
  return match !== undefined ? match : null
})

const playheadCapsuleStyle = computed(() => {
  return {
    left: `clamp(65px, ${playheadPercent.value}%, calc(100% - 65px))`,
    transform: 'translateX(-50%)',
  }
})

const playheadMenuStyle = computed(() => {
  if (!activePlayheadMenu.value || !containerRef.value) return {}
  const containerRect = containerRef.value.getBoundingClientRect()
  const relX = activePlayheadMenu.value.x - containerRect.left
  const clampedX = Math.max(120, Math.min(containerRect.width - 120, relX))
  return {
    left: `${clampedX}px`,
    top: '12px',
    transform: 'translateX(-50%)',
  }
})

function openPlayheadPopover() {
  globalActiveGraphInstanceId.value = instanceId
  closePopover()
  closeBoundaryMenu()
  closePlayheadMenu()
  isPlayheadPopoverOpen.value = true
  playheadInputValue.value = formatSeconds(displayCurrentTime.value)
  nextTick(() => {
    playheadInputRef.value?.focus({ preventScroll: true })
    playheadInputRef.value?.select()
  })
}

function closePlayheadPopover() {
  if (globalActiveGraphInstanceId.value === instanceId) {
    globalActiveGraphInstanceId.value = null
  }
  isPlayheadPopoverOpen.value = false
}

function focusPlayheadInput() {
  playheadInputRef.value?.focus({ preventScroll: true })
}

function onPlayheadInputFocus() {
  playheadInputRef.value?.select()
}

function onPlayheadBlur(e: FocusEvent) {
  const related = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null
  if (related && (related === playheadInputRef.value || related.closest?.('.playhead-capsule-card'))) {
    return
  }

  requestAnimationFrame(() => {
    const active = document.activeElement
    if (active === playheadInputRef.value) {
      return
    }
    closePlayheadPopover()
  })
}

function onPlayheadInput(e: Event) {
  if (!(e.target instanceof HTMLInputElement)) return
  const val = e.target.value
  playheadInputValue.value = val
  const parsed = parseTimeInput(val)
  if (parsed !== null && !isNaN(parsed)) {
    const maxDur = effectiveDuration.value
    const clamped = Math.max(0, Math.min(maxDur, parsed))
    emit('update:currentTime', clamped)
    emit('scrubStart', clamped)
    emit('scrubMove', clamped)
    emit('scrubEnd', clamped)
  }
}

function onPlayheadKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === 'Escape') {
    closePlayheadPopover()
    if (e.target instanceof HTMLElement) {
      e.target.blur()
    }
    return
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    const step = e.shiftKey ? 0.5 : e.altKey ? 0.01 : 0.05
    const delta = e.key === 'ArrowUp' ? step : -step
    const maxDur = effectiveDuration.value
    const current = parseTimeInput(playheadInputValue.value) ?? props.currentTime
    const newTime = Math.max(0, Math.min(maxDur, current + delta))
    playheadInputValue.value = formatSeconds(newTime)
    emit('update:currentTime', newTime)
    emit('scrubStart', newTime)
    emit('scrubMove', newTime)
    emit('scrubEnd', newTime)
    nextTick(() => {
      playheadInputRef.value?.select()
    })
  }
}

watch(
  () => props.currentTime,
  newTime => {
    if (isPlayheadPopoverOpen.value && document.activeElement !== playheadInputRef.value) {
      playheadInputValue.value = formatSeconds(newTime)
    }
  }
)

function onPlayheadContextMenu(e: MouseEvent) {
  e.preventDefault()
  closePopover()
  closeBoundaryMenu()
  closePlayheadPopover()
  const sec = displayCurrentTime.value
  activePlayheadMenu.value = {
    sec,
    x: e.clientX,
    y: e.clientY,
  }
}

function closePlayheadMenu() {
  activePlayheadMenu.value = null
}

function setInAtPlayhead(sec: number) {
  let newStart = sec
  let newEnd = props.trimEnd
  if (newStart > newEnd) {
    newEnd = newStart
  }
  startInputValue.value = formatSeconds(newStart)
  endInputValue.value = formatSeconds(newEnd)
  emit('update:trimStart', newStart)
  emit('update:trimEnd', newEnd)
  emit('trimChange', { start: newStart, end: newEnd, handle: 'start' })
  emit('trimEndChange', { start: newStart, end: newEnd, handle: 'start' })
  closePlayheadMenu()
}

function setOutAtPlayhead(sec: number) {
  let newStart = props.trimStart
  let newEnd = sec
  if (newEnd < newStart) {
    newStart = newEnd
  }
  startInputValue.value = formatSeconds(newStart)
  endInputValue.value = formatSeconds(newEnd)
  emit('update:trimStart', newStart)
  emit('update:trimEnd', newEnd)
  emit('trimChange', { start: newStart, end: newEnd, handle: 'end' })
  emit('trimEndChange', { start: newStart, end: newEnd, handle: 'end' })
  closePlayheadMenu()
}

function splitAtPlayhead(sec: number) {
  emit('splitAt', sec)
  closePlayheadMenu()
}

function openTimeInputFromMenu(_sec: number) {
  closePlayheadMenu()
  openPlayheadPopover()
}

function togglePlayFromPlayhead(sec: number) {
  emit('playFromCursor', sec)
  closePlayheadMenu()
}

function pasteAtPlayhead(sec: number) {
  emit('pasteAtCursor', sec)
  closePlayheadMenu()
}

function jumpCursorToIn() {
  const inSec = props.trimStart
  emit('update:currentTime', inSec)
  emit('scrubStart', inSec)
  emit('scrubMove', inSec)
  emit('scrubEnd', inSec)
  closePlayheadMenu()
}

function handleDocumentMouseDown(e: MouseEvent) {
  const target = e.target instanceof Node ? e.target : null
  if (target && containerRef.value?.contains(target)) {
    return
  }
  closePopover()
  closeBoundaryMenu()
  closePlayheadPopover()
  closePlayheadMenu()
}

const DOWNSAMPLE_RESOLUTION = 2000
const bufferPeaksCache = new WeakMap<AudioBuffer, Map<number, Float32Array>>()

function getDownsampledChannelPeaks(buffer: AudioBuffer, channelIdx: number): Float32Array {
  let cache = bufferPeaksCache.get(buffer)
  if (!cache) {
    cache = new Map()
    bufferPeaksCache.set(buffer, cache)
  }
  let peaks = cache.get(channelIdx)
  if (!peaks) {
    const rawData = buffer.getChannelData(channelIdx)
    const len = rawData.length
    const res = Math.min(len, DOWNSAMPLE_RESOLUTION)
    peaks = new Float32Array(res)
    const step = len / res
    for (let i = 0; i < res; i++) {
      const start = Math.floor(i * step)
      const end = Math.min(len, Math.floor((i + 1) * step))
      let max = 0
      for (let j = start; j < end; j++) {
        const val = Math.abs(rawData[j])
        if (val > max) max = val
      }
      peaks[i] = max
    }
    cache.set(channelIdx, peaks)
  }
  return peaks
}

let cachedWidth = 0
let cachedHeight = 0
let drawRaf: number | null = null

function scheduleDrawWaveform() {
  if (drawRaf !== null) return
  drawRaf = requestAnimationFrame(() => {
    drawRaf = null
    drawWaveform()
  })
}

const renderedWaveformCache = new WeakMap<AudioBuffer, Map<string, HTMLCanvasElement>>()

function renderWaveformBars(
  ctx: CanvasRenderingContext2D,
  buffer: AudioBuffer,
  width: number,
  height: number,
  activeTracks: WaveformTrack[],
  dpr: number,
  themeColors: { blue: [string, string]; green: [string, string] }
) {
  const numTracks = activeTracks.length
  const trackLaneHeight = height / numTracks

  const targetBarWidth = 2 * dpr
  const targetBarGap = 1 * dpr
  const nominalStep = targetBarWidth + targetBarGap
  const numBars = Math.max(10, Math.floor(width / nominalStep))
  const barStep = width / numBars
  const barWidth = Math.max(1, barStep - targetBarGap)
  const minBarH = Math.max(2, 1.5 * dpr)
  const cornerRadius = Math.max(1, 1 * dpr)

  for (let t = 0; t < numTracks; t++) {
    const track = activeTracks[t]
    const trackTop = t * trackLaneHeight
    const trackBaseline = trackTop + trackLaneHeight / 2
    const maxTrackHeight = (trackLaneHeight / 2) * (numTracks > 1 ? 0.88 : 0.92)

    // Separator line between multiple tracks
    if (numTracks >= 2 && t > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.lineWidth = 1 * dpr
      ctx.beginPath()
      ctx.moveTo(0, trackTop)
      ctx.lineTo(width, trackTop)
      ctx.stroke()
    }

    // Resolve channel indices for this track
    let channelIndices: number[] = []
    if (Array.isArray(track.channelIndex)) {
      channelIndices = track.channelIndex.filter(idx => idx >= 0 && idx < buffer.numberOfChannels)
    } else if (typeof track.channelIndex === 'number') {
      if (track.channelIndex >= 0 && track.channelIndex < buffer.numberOfChannels) {
        channelIndices = [track.channelIndex]
      }
    }

    if (channelIndices.length === 0) {
      if (numTracks === 1 && buffer.numberOfChannels >= 2) {
        channelIndices = [0, 1]
      } else {
        channelIndices = [Math.min(t, buffer.numberOfChannels - 1)]
      }
    }

    // Sample peaks using cached channel downsamples
    const channelPeaksList = channelIndices.map(cIdx => getDownsampledChannelPeaks(buffer, cIdx))
    const cachedLen = channelPeaksList[0].length
    const trackPeaks = new Float32Array(numBars)
    let maxPeak = 0.001

    for (let i = 0; i < numBars; i++) {
      const start = Math.floor((i / numBars) * cachedLen)
      const end = Math.min(cachedLen, Math.floor(((i + 1) / numBars) * cachedLen))

      let p = 0
      for (let j = start; j < end; j++) {
        for (let c = 0; c < channelPeaksList.length; c++) {
          const val = channelPeaksList[c][j]
          if (val > p) p = val
        }
      }
      trackPeaks[i] = p
      if (p > maxPeak) maxPeak = p
    }

    // Independent track normalization with a floor to avoid boosting background noise
    const normFactor = Math.max(0.06, maxPeak)
    const isEnabled = track.enabled !== false
    const colors = track.colors || (t % 2 === 0 ? themeColors.blue : themeColors.green)

    // Draw bars
    for (let i = 0; i < numBars; i++) {
      const normVal = Math.min(1, trackPeaks[i] / normFactor)
      const curved = Math.pow(normVal, 0.65)
      const x = i * barStep
      const barH = Math.max(minBarH, curved * maxTrackHeight)
      const y = trackBaseline - barH / 2

      if (isEnabled) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barH)
        grad.addColorStop(0, colors[0])
        grad.addColorStop(1, colors[1])
        ctx.fillStyle = grad
      } else {
        ctx.fillStyle = 'rgba(113, 113, 122, 0.35)'
      }

      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barH, cornerRadius)
      ctx.fill()
    }

    // Draw track label badge pill only if label is provided and non-empty
    if (track.label && track.label.trim().length > 0) {
      const labelText = track.label.trim()
      const fontSize = Math.round(9.5 * dpr)
      ctx.font = `600 ${fontSize}px sans-serif`
      const textWidth = ctx.measureText(labelText).width

      // Position badge so it never collides with start-flag (top: 4px) when handles are visible
      const badgeY =
        props.showTrimHandles && t === 0 ? trackTop + trackLaneHeight - fontSize - 7 * dpr : trackTop + 4 * dpr

      ctx.fillStyle = 'rgba(15, 15, 17, 0.72)'
      ctx.beginPath()
      ctx.roundRect(6 * dpr, badgeY, textWidth + 10 * dpr, fontSize + 8 * dpr, 3 * dpr)
      ctx.fill()

      ctx.fillStyle = isEnabled ? colors[0] || 'rgba(56, 189, 248, 0.95)' : 'rgba(161, 161, 170, 0.6)'
      ctx.fillText(labelText, 11 * dpr, badgeY + fontSize)
    }
  }
}

function getResolvedThemeColor(varName: string): string {
  if (typeof window === 'undefined') return ''
  const el = waveformWrapperRef.value || document.documentElement

  // Resolve any nested var() or relative color expressions (oklch, color-mix) via computed style
  const dummy = document.createElement('span')
  dummy.style.color = `var(${varName})`
  el.appendChild(dummy)
  const resolved = getComputedStyle(dummy).color
  dummy.remove()

  if (!resolved) {
    console.error(`[WaveformGraph] Missing or invalid CSS variable: ${varName}`)
  }

  return resolved
}

function drawWaveform() {
  const canvas = canvasRef.value
  const buffer = props.audioBuffer
  if (!canvas || !buffer) return

  if (cachedWidth <= 0 || cachedHeight <= 0) {
    return
  }

  const w = cachedWidth
  const h = cachedHeight

  const dpr = window.devicePixelRatio || 1
  const targetWidth = Math.round(w * dpr)
  const targetHeight = Math.round(h * dpr)

  if (canvas.width !== targetWidth) {
    canvas.width = targetWidth
  }
  if (canvas.height !== targetHeight) {
    canvas.height = targetHeight
  }
  const width = canvas.width
  const height = canvas.height

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, width, height)

  // 1. Resolve active tracks
  let activeTracks: WaveformTrack[] = []
  if (props.tracks && props.tracks.length > 0) {
    activeTracks = props.tracks
  } else if (buffer.numberOfChannels >= 2 && (!props.includeMic || !props.includeInput)) {
    // Fallback if legacy includeMic / includeInput are explicitly toggled without tracks prop
    activeTracks = [
      {
        label: '🎤 MIC (VOICE)',
        channelIndex: 0,
        enabled: props.includeMic,
      },
      {
        label: '🔊 INPUT DEVICE (AUDIO)',
        channelIndex: 1,
        enabled: props.includeInput,
      },
    ]
  } else {
    // Single unified track (mono or stereo merged)
    activeTracks = [
      {
        label: '',
        channelIndex: buffer.numberOfChannels >= 2 ? [0, 1] : 0,
        enabled: true,
      },
    ]
  }

  const primaryGreen = getResolvedThemeColor('--primary-color-gradient-light')
  const primaryGreenDark = getResolvedThemeColor('--primary-color-gradient-dark')
  const primaryBlue = getResolvedThemeColor('--primary-color-blue-gradient-light')
  const primaryBlueDark = getResolvedThemeColor('--primary-color-blue-gradient-dark')
  const themeKey = `${primaryBlue}_${primaryBlueDark}_${primaryGreen}_${primaryGreenDark}`
  const themeColors: { blue: [string, string]; green: [string, string] } = {
    blue: [primaryBlue, primaryBlueDark],
    green: [primaryGreen, primaryGreenDark],
  }

  const trackKey = activeTracks
    .map(
      t =>
        `${
          Array.isArray(t.channelIndex) ? t.channelIndex.join(',') : t.channelIndex
        }:${t.enabled !== false}:${t.label || ''}:${(t.colors || []).join(',')}`
    )
    .join(';')
  const cacheKey = `${width}x${height}_${trackKey}_${themeKey}`

  let bufferCache = renderedWaveformCache.get(buffer)
  if (!bufferCache) {
    bufferCache = new Map()
    renderedWaveformCache.set(buffer, bufferCache)
  }

  let cachedCanvas = bufferCache.get(cacheKey)
  if (!cachedCanvas) {
    cachedCanvas = document.createElement('canvas')
    cachedCanvas.width = width
    cachedCanvas.height = height
    const offCtx = cachedCanvas.getContext('2d')
    if (offCtx) {
      renderWaveformBars(offCtx, buffer, width, height, activeTracks, dpr, themeColors)
      bufferCache.set(cacheKey, cachedCanvas)
    }
  }

  if (cachedCanvas) {
    ctx.drawImage(cachedCanvas, 0, 0)
  }
}

function getSecondsFromMouseEvent(e: MouseEvent): number {
  if (!waveformWrapperRef.value) return 0
  const rect = waveformWrapperRef.value.getBoundingClientRect()
  if (rect.width <= 0) return 0
  const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const percent = relX / rect.width
  return percent * effectiveDuration.value
}

let handleDownX = 0
let clickedHandle: 'start' | 'end' | null = null
const isDraggingHandle = ref(false)
let dragInitialStart = 0
let dragInitialEnd = 0
let dragStationarySec = 0

let lastHandleDragEvent: MouseEvent | null = null

function onHandleDragKeyChange(ke: KeyboardEvent) {
  if (!activeDragHandle.value || !lastHandleDragEvent) return
  if (ke.repeat) return
  if (ke.key === 'Shift' || ke.key === 'Alt') {
    const syntheticEvent = new MouseEvent('mousemove', {
      clientX: lastHandleDragEvent.clientX,
      clientY: lastHandleDragEvent.clientY,
      shiftKey: ke.shiftKey,
      altKey: ke.altKey,
      buttons: 1,
    })
    onHandleMouseMove(syntheticEvent)
  }
}

function onStartHandleMouseDown(e: MouseEvent) {
  e.preventDefault()
  handleDownX = e.clientX
  clickedHandle = 'start'
  activeDragHandle.value = 'start'
  internalDragStartTime.value = props.trimStart
  isDraggingHandle.value = false
  dragInitialStart = props.trimStart
  dragInitialEnd = props.trimEnd
  dragStationarySec = dragInitialEnd
  lastHandleDragEvent = e
  window.addEventListener('mousemove', onHandleMouseMove)
  window.addEventListener('mouseup', onHandleMouseUp)
  window.addEventListener('keydown', onHandleDragKeyChange)
  window.addEventListener('keyup', onHandleDragKeyChange)
}

function onEndHandleMouseDown(e: MouseEvent) {
  e.preventDefault()
  handleDownX = e.clientX
  clickedHandle = 'end'
  activeDragHandle.value = 'end'
  isDraggingHandle.value = false
  dragInitialStart = props.trimStart
  dragInitialEnd = props.trimEnd
  dragStationarySec = dragInitialStart
  lastHandleDragEvent = e
  window.addEventListener('mousemove', onHandleMouseMove)
  window.addEventListener('mouseup', onHandleMouseUp)
  window.addEventListener('keydown', onHandleDragKeyChange)
  window.addEventListener('keyup', onHandleDragKeyChange)
}

let playheadDownX = 0
let playheadDownY = 0
let isPlayheadDragging = false
let playheadClickTimer: ReturnType<typeof setTimeout> | null = null
let lastPlayheadDragEvent: MouseEvent | null = null

function cancelPlayheadClickTimer() {
  if (playheadClickTimer !== null) {
    clearTimeout(playheadClickTimer)
    playheadClickTimer = null
  }
}

function calculatePlayheadSnap(
  rawSec: number,
  shiftHeld: boolean
): {
  snappedSec: number
  snapTarget: number | null
  boundarySec: number | null
} {
  if (!shiftHeld || !waveformWrapperRef.value) {
    return { snappedSec: rawSec, snapTarget: null, boundarySec: null }
  }

  const rect = waveformWrapperRef.value.getBoundingClientRect()
  if (rect.width <= 0) return { snappedSec: rawSec, snapTarget: null, boundarySec: null }

  const maxDur = effectiveDuration.value
  if (maxDur <= 0) return { snappedSec: rawSec, snapTarget: null, boundarySec: null }

  const snapPixelThreshold = 24
  const snapSecThreshold = (snapPixelThreshold / rect.width) * maxDur

  interface SnapTarget {
    sec: number
    isBoundary: boolean
    boundarySec?: number
  }

  const targets: SnapTarget[] = []

  // Segment boundaries (divider lines)
  if (props.segmentBoundaries && props.segmentBoundaries.length > 0) {
    for (const b of props.segmentBoundaries) {
      targets.push({ sec: b, isBoundary: true, boundarySec: b })
    }
  }

  // Trim handles
  if (props.showTrimHandles) {
    targets.push({ sec: props.trimStart, isBoundary: false })
    targets.push({ sec: props.trimEnd, isBoundary: false })
  }

  // Timeline start and end
  targets.push({ sec: 0, isBoundary: false })
  targets.push({ sec: maxDur, isBoundary: false })

  let closestDist = Infinity
  let closestTarget: SnapTarget | null = null

  for (const t of targets) {
    const d = Math.abs(rawSec - t.sec)
    if (d <= snapSecThreshold && d < closestDist) {
      closestDist = d
      closestTarget = t
    }
  }

  if (closestTarget) {
    return {
      snappedSec: closestTarget.sec,
      snapTarget: closestTarget.sec,
      boundarySec:
        closestTarget.isBoundary && closestTarget.boundarySec !== undefined ? closestTarget.boundarySec : null,
    }
  }

  return { snappedSec: rawSec, snapTarget: null, boundarySec: null }
}

function onPlayheadDragKeyChange(ke: KeyboardEvent) {
  if (!isPlayheadDragging && !isScrubbing.value) return
  if (!lastPlayheadDragEvent) return
  if (ke.repeat) return
  if (ke.key === 'Shift' || ke.key === 'Alt') {
    const syntheticEvent = new MouseEvent('mousemove', {
      clientX: lastPlayheadDragEvent.clientX,
      clientY: lastPlayheadDragEvent.clientY,
      shiftKey: ke.shiftKey,
      altKey: ke.altKey,
      buttons: 1,
    })
    if (isPlayheadDragging) {
      onPlayheadMouseMove(syntheticEvent)
    } else if (isScrubbing.value) {
      onScrubMouseMove(syntheticEvent)
    }
  }
}

function onPlayheadMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  cancelPlayheadClickTimer()

  // If this is part of a double-click gesture (detail >= 2), keep cursor input box closed
  if (e.detail >= 2) {
    closePlayheadPopover()
    return
  }

  e.preventDefault()
  closeBoundaryMenu()
  closePlayheadMenu()

  playheadDownX = e.clientX
  playheadDownY = e.clientY
  isPlayheadDragging = false
  lastPlayheadDragEvent = e

  window.addEventListener('mousemove', onPlayheadMouseMove)
  window.addEventListener('mouseup', onPlayheadMouseUp)
  window.addEventListener('keydown', onPlayheadDragKeyChange)
  window.addEventListener('keyup', onPlayheadDragKeyChange)
}

function onPlayheadMouseMove(e: MouseEvent) {
  if (e.clientX === 0 && e.clientY === 0) return
  if (e.buttons === 0) {
    onPlayheadMouseUp(e)
    return
  }

  lastPlayheadDragEvent = e

  const dist = Math.hypot(e.clientX - playheadDownX, e.clientY - playheadDownY)
  if (!isPlayheadDragging && (e.shiftKey || dist >= 3)) {
    isPlayheadDragging = true
    cancelPlayheadClickTimer()
    closePlayheadPopover()
    isScrubbing.value = true
    const sec = getSecondsFromMouseEvent(e)
    const clamped = Math.max(0, Math.min(effectiveDuration.value, sec))
    const snap = calculatePlayheadSnap(clamped, e.shiftKey)
    const finalSec = snap.snappedSec

    activeSnapLineSec.value = snap.snapTarget
    snappedBoundarySec.value = snap.boundarySec
    isSnappedToPlayhead.value = snap.snapTarget !== null
    snapBadgeText.value = snap.snapTarget !== null ? formatSeconds(snap.snapTarget) : ''

    internalScrubTime.value = finalSec
    emit('update:currentTime', finalSec)
    emit('scrubStart', finalSec)
    emit('scrubMove', finalSec)
  } else if (isPlayheadDragging) {
    const sec = getSecondsFromMouseEvent(e)
    const clamped = Math.max(0, Math.min(effectiveDuration.value, sec))
    const snap = calculatePlayheadSnap(clamped, e.shiftKey)
    const finalSec = snap.snappedSec

    activeSnapLineSec.value = snap.snapTarget
    snappedBoundarySec.value = snap.boundarySec
    isSnappedToPlayhead.value = snap.snapTarget !== null
    snapBadgeText.value = snap.snapTarget !== null ? formatSeconds(snap.snapTarget) : ''

    internalScrubTime.value = finalSec
    emit('update:currentTime', finalSec)
    emit('scrubMove', finalSec)
  }
}

function onPlayheadMouseUp(e: MouseEvent) {
  window.removeEventListener('mousemove', onPlayheadMouseMove)
  window.removeEventListener('mouseup', onPlayheadMouseUp)
  window.removeEventListener('keydown', onPlayheadDragKeyChange)
  window.removeEventListener('keyup', onPlayheadDragKeyChange)

  activeSnapLineSec.value = null
  snappedBoundarySec.value = null
  isSnappedToPlayhead.value = false
  snapBadgeText.value = ''
  lastPlayheadDragEvent = null

  if (isPlayheadDragging) {
    cancelPlayheadClickTimer()
    const finalTime = internalScrubTime.value ?? props.currentTime
    isScrubbing.value = false
    internalScrubTime.value = null
    isPlayheadDragging = false
    emit('scrubEnd', finalTime)
  } else if (e.detail <= 1) {
    // Single Left-Click! Use a small delay so a subsequent double-click cancels opening the popover
    cancelPlayheadClickTimer()
    playheadClickTimer = setTimeout(() => {
      playheadClickTimer = null
      openPlayheadPopover()
    }, 220)
  } else {
    // Double click / multi-click: cancel timer and ensure popover stays closed
    cancelPlayheadClickTimer()
    closePlayheadPopover()
  }
}

function onWaveformDblClick(e: MouseEvent) {
  cancelPlayheadClickTimer()
  closePlayheadPopover()
  closePlayheadMenu()
  closeBoundaryMenu()

  if (!props.showTrimHandles) return
  const clickSec = getSecondsFromMouseEvent(e)
  const maxDur = effectiveDuration.value
  if (maxDur <= 0) return

  const boundaries =
    props.segmentBoundaries && props.segmentBoundaries.length > 0
      ? [0, ...props.segmentBoundaries, maxDur].sort((a, b) => a - b)
      : [0, maxDur]

  let segStart = 0
  let segEnd = maxDur

  for (let i = 0; i < boundaries.length - 1; i++) {
    const bStart = boundaries[i]
    const bEnd = boundaries[i + 1]
    if (clickSec >= bStart - 0.01 && clickSec <= bEnd + 0.01) {
      segStart = bStart
      segEnd = bEnd
      break
    }
  }

  const currentEnd = props.trimEnd
  if (Math.abs(props.trimStart - segStart) < 0.05 && Math.abs(currentEnd - segEnd) < 0.05) {
    segStart = 0
    segEnd = maxDur
  }

  startInputValue.value = formatSeconds(segStart)
  endInputValue.value = formatSeconds(segEnd)
  emit('update:trimStart', segStart)
  emit('update:trimEnd', segEnd)
  emit('update:currentTime', segStart)
  emit('trimChange', { start: segStart, end: segEnd, handle: 'start' })
  emit('trimEndChange', { start: segStart, end: segEnd, handle: 'start' })
}

function onWaveformMouseDown(e: MouseEvent) {
  cancelPlayheadClickTimer()
  if (activeDragHandle.value) return
  closePlayheadPopover()
  closePlayheadMenu()
  closeBoundaryMenu()
  e.preventDefault()

  if (e.shiftKey && props.showTrimHandles) {
    const clickSec = getSecondsFromMouseEvent(e)
    const maxDur = effectiveDuration.value
    const clamped = Math.max(0, Math.min(maxDur, clickSec))
    const effectiveEnd = props.trimEnd
    const startDist = Math.abs(clamped - props.trimStart)
    const endDist = Math.abs(clamped - effectiveEnd)
    let newStart = props.trimStart
    let newEnd = effectiveEnd
    let handle: 'start' | 'end'

    if (clamped < props.trimStart) {
      newStart = clamped
      handle = 'start'
    } else if (clamped > effectiveEnd) {
      newEnd = clamped
      handle = 'end'
    } else if (startDist <= endDist) {
      newStart = clamped
      handle = 'start'
    } else {
      newEnd = clamped
      handle = 'end'
    }

    startInputValue.value = formatSeconds(newStart)
    endInputValue.value = formatSeconds(newEnd)
    emit('update:trimStart', newStart)
    emit('update:trimEnd', newEnd)
    emit('update:currentTime', clamped)
    emit('trimChange', { start: newStart, end: newEnd, handle })
    emit('trimEndChange', { start: newStart, end: newEnd, handle })
    return
  }

  if (!props.enableScrubbing) {
    if (props.showTrimHandles) {
      const clickSec = getSecondsFromMouseEvent(e)
      const effectiveEnd = props.trimEnd
      const startDist = Math.abs(clickSec - props.trimStart)
      const endDist = Math.abs(clickSec - effectiveEnd)
      if (startDist <= endDist) {
        clickedHandle = 'start'
        activeDragHandle.value = 'start'
        handleDownX = e.clientX
        isDraggingHandle.value = true
        const newStart = Math.max(0, Math.min(clickSec, effectiveEnd))
        dragInitialStart = newStart
        dragInitialEnd = effectiveEnd
        dragStationarySec = effectiveEnd
        internalDragStartTime.value = newStart
        startInputValue.value = formatSeconds(newStart)
        emit('update:trimStart', newStart)
        emit('update:currentTime', newStart)
        emit('trimChange', { start: newStart, end: effectiveEnd, handle: 'start' })
      } else {
        clickedHandle = 'end'
        activeDragHandle.value = 'end'
        handleDownX = e.clientX
        isDraggingHandle.value = true
        const newEnd = Math.min(effectiveDuration.value, Math.max(clickSec, props.trimStart))
        dragInitialStart = props.trimStart
        dragInitialEnd = newEnd
        dragStationarySec = props.trimStart
        endInputValue.value = formatSeconds(newEnd)
        emit('update:trimEnd', newEnd)
        if (props.currentTime > newEnd) {
          emit('update:currentTime', props.trimStart)
        }
        emit('trimChange', { start: props.trimStart, end: newEnd, handle: 'end' })
      }

      window.addEventListener('mousemove', onHandleMouseMove)
      window.addEventListener('mouseup', onHandleMouseUp)
    }
    return
  }

  isScrubbing.value = true

  const clickSec = getSecondsFromMouseEvent(e)
  const clamped = Math.max(0, Math.min(effectiveDuration.value, clickSec))
  const snap = calculatePlayheadSnap(clamped, e.shiftKey)
  const finalSec = snap.snappedSec

  activeSnapLineSec.value = snap.snapTarget
  snappedBoundarySec.value = snap.boundarySec
  isSnappedToPlayhead.value = snap.snapTarget !== null
  snapBadgeText.value = snap.snapTarget !== null ? formatSeconds(snap.snapTarget) : ''

  internalScrubTime.value = finalSec
  emit('update:currentTime', finalSec)
  emit('scrubStart', finalSec)
  emit('scrubMove', finalSec)

  lastPlayheadDragEvent = e
  window.addEventListener('mousemove', onScrubMouseMove)
  window.addEventListener('mouseup', onScrubMouseUp)
  window.addEventListener('keydown', onPlayheadDragKeyChange)
  window.addEventListener('keyup', onPlayheadDragKeyChange)
}

function onScrubMouseMove(e: MouseEvent) {
  if (!isScrubbing.value) return
  // Ignore synthetic/invalid (0, 0) coordinates from Chromium native drag
  if (e.clientX === 0 && e.clientY === 0) return
  if (e.buttons === 0) {
    onScrubMouseUp()
    return
  }
  lastPlayheadDragEvent = e
  const sec = getSecondsFromMouseEvent(e)
  const clamped = Math.max(0, Math.min(effectiveDuration.value, sec))
  const snap = calculatePlayheadSnap(clamped, e.shiftKey)
  const finalSec = snap.snappedSec

  activeSnapLineSec.value = snap.snapTarget
  snappedBoundarySec.value = snap.boundarySec
  isSnappedToPlayhead.value = snap.snapTarget !== null
  snapBadgeText.value = snap.snapTarget !== null ? formatSeconds(snap.snapTarget) : ''

  internalScrubTime.value = finalSec
  emit('update:currentTime', finalSec)
  emit('scrubMove', finalSec)
}

function onScrubMouseUp() {
  if (isScrubbing.value) {
    activeSnapLineSec.value = null
    snappedBoundarySec.value = null
    isSnappedToPlayhead.value = false
    snapBadgeText.value = ''
    lastPlayheadDragEvent = null
    window.removeEventListener('keydown', onPlayheadDragKeyChange)
    window.removeEventListener('keyup', onPlayheadDragKeyChange)
    const finalTime = internalScrubTime.value ?? props.currentTime
    isScrubbing.value = false
    internalScrubTime.value = null
    window.removeEventListener('mousemove', onScrubMouseMove)
    window.removeEventListener('mouseup', onScrubMouseUp)
    emit('scrubEnd', finalTime)
  }
}

function onHandleMouseMove(e: MouseEvent) {
  if (!activeDragHandle.value) return
  if (e.clientX === 0 && e.clientY === 0) return
  if (e.buttons === 0) {
    onHandleMouseUp(e)
    return
  }

  lastHandleDragEvent = e

  // Deadband threshold: do not update position until mouse has moved at least 3px or user is holding Shift
  const dist = Math.abs(e.clientX - handleDownX)
  if (!isDraggingHandle.value && (e.shiftKey || dist >= 3)) {
    isDraggingHandle.value = true
  }
  if (!isDraggingHandle.value) {
    return
  }

  if (!waveformWrapperRef.value) return
  const rect = waveformWrapperRef.value.getBoundingClientRect()
  if (rect.width <= 0) return

  const maxDur = effectiveDuration.value
  if (maxDur <= 0) return

  const deltaSec = ((e.clientX - handleDownX) / rect.width) * maxDur
  const initialPos = clickedHandle === 'start' ? dragInitialStart : dragInitialEnd
  let rawCurrentSec = Math.max(0, Math.min(maxDur, initialPos + deltaSec))

  let snappedBoundary: number | null = null
  let activeSnapSec: number | null = null
  let activeSnapLabel = ''

  // Shift-Snapping: ONLY snap when holding Shift AND close to a clip boundary handle (or timeline start/end)
  // Does NOT snap to playhead or arbitrary grid intervals. If too far from a handle, does not snap.
  if (e.shiftKey) {
    const snapPixelThreshold = 24 // doubled snapping distance (24px)
    const snapSecThreshold = (snapPixelThreshold / rect.width) * maxDur

    interface SnapHandle {
      sec: number
      isBoundary: boolean
      boundarySec?: number
      isStationary?: boolean
      isPlayhead?: boolean
    }

    const handles: SnapHandle[] = []

    // Clip boundary divider handles (white divider lines)
    if (props.segmentBoundaries && props.segmentBoundaries.length > 0) {
      for (const b of props.segmentBoundaries) {
        handles.push({ sec: b, isBoundary: true, boundarySec: b })
      }
    }

    // Opposite trim handle
    handles.push({ sec: dragStationarySec, isBoundary: false, isStationary: true })

    // Playhead cursor
    handles.push({ sec: props.currentTime, isBoundary: false, isPlayhead: true })

    // Timeline start and end
    handles.push({ sec: 0, isBoundary: false })
    handles.push({ sec: maxDur, isBoundary: false })

    let closestDist = Infinity
    let closestHandle: SnapHandle | null = null

    for (const h of handles) {
      const d = Math.abs(rawCurrentSec - h.sec)
      if (d <= snapSecThreshold && d < closestDist) {
        closestDist = d
        closestHandle = h
      }
    }

    if (closestHandle) {
      rawCurrentSec = closestHandle.sec
      activeSnapSec = closestHandle.sec
      activeSnapLabel = formatSeconds(closestHandle.sec)
      if (closestHandle.isBoundary && closestHandle.boundarySec !== undefined) {
        snappedBoundary = closestHandle.boundarySec
      }
      isSnappedToStationaryHandle.value = !!closestHandle.isStationary
      isSnappedToPlayhead.value = !!closestHandle.isPlayhead
    } else {
      isSnappedToStationaryHandle.value = false
      isSnappedToPlayhead.value = false
    }
  } else {
    isSnappedToStationaryHandle.value = false
    isSnappedToPlayhead.value = false
  }

  snappedBoundarySec.value = snappedBoundary
  activeSnapLineSec.value = activeSnapSec
  snapBadgeText.value = activeSnapLabel

  let newStart: number
  let newEnd: number
  let activeRole: 'start' | 'end'

  if (rawCurrentSec < dragStationarySec) {
    newStart = rawCurrentSec
    newEnd = dragStationarySec
    activeRole = 'start'
  } else if (rawCurrentSec > dragStationarySec) {
    newStart = dragStationarySec
    newEnd = rawCurrentSec
    activeRole = 'end'
  } else {
    newStart = rawCurrentSec
    newEnd = rawCurrentSec
    activeRole = clickedHandle || 'start'
  }

  activeDragHandle.value = activeRole
  focusedPopoverHandle.value = activeRole
  startInputValue.value = formatSeconds(newStart)
  endInputValue.value = formatSeconds(newEnd)

  if (activeRole === 'start') {
    internalDragStartTime.value = newStart
  } else {
    internalDragStartTime.value = null
  }

  emit('update:trimStart', newStart)
  emit('update:trimEnd', newEnd)
  if (activeRole === 'start') {
    emit('update:currentTime', newStart)
  } else if (activeRole === 'end' && props.currentTime > newEnd) {
    emit('update:currentTime', newStart)
  }
  emit('trimChange', { start: newStart, end: newEnd, handle: activeRole })
}

function onHandleMouseUp(_e?: MouseEvent) {
  snappedBoundarySec.value = null
  activeSnapLineSec.value = null
  snapBadgeText.value = ''
  isSnappedToStationaryHandle.value = false
  isSnappedToPlayhead.value = false
  lastHandleDragEvent = null
  window.removeEventListener('keydown', onHandleDragKeyChange)
  window.removeEventListener('keyup', onHandleDragKeyChange)
  if (activeDragHandle.value) {
    const wasDragging = isDraggingHandle.value
    const targetHandle = clickedHandle
    const handleType = activeDragHandle.value
    activeDragHandle.value = null
    isDraggingHandle.value = false
    internalDragStartTime.value = null
    window.removeEventListener('mousemove', onHandleMouseMove)
    window.removeEventListener('mouseup', onHandleMouseUp)

    if (wasDragging) {
      emit('trimEndChange', {
        start: props.trimStart,
        end: props.trimEnd,
        handle: handleType,
      })
    } else if (targetHandle) {
      openTrimPopovers(targetHandle)
    }
    clickedHandle = null
  }
}

watch(
  () => [props.audioBuffer, props.tracks, props.includeMic, props.includeInput],
  () => {
    scheduleDrawWaveform()
  },
  { deep: true }
)

onMounted(() => {
  window.addEventListener('mousedown', handleDocumentMouseDown, true)
  if (waveformWrapperRef.value) {
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          cachedWidth = entry.contentRect.width
          cachedHeight = entry.contentRect.height
          scheduleDrawWaveform()
        }
      }
    })
    resizeObserver.observe(waveformWrapperRef.value)
  }
})

onUnmounted(() => {
  if (drawRaf !== null) {
    cancelAnimationFrame(drawRaf)
    drawRaf = null
  }
  if (globalActiveGraphInstanceId.value === instanceId) {
    globalActiveGraphInstanceId.value = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  window.removeEventListener('mousedown', handleDocumentMouseDown, true)
  window.removeEventListener('mousemove', onHandleMouseMove)
  window.removeEventListener('mouseup', onHandleMouseUp)
  window.removeEventListener('keydown', onHandleDragKeyChange)
  window.removeEventListener('keyup', onHandleDragKeyChange)
  window.removeEventListener('keydown', onPlayheadDragKeyChange)
  window.removeEventListener('keyup', onPlayheadDragKeyChange)
  window.removeEventListener('mousemove', onScrubMouseMove)
  window.removeEventListener('mouseup', onScrubMouseUp)
  window.removeEventListener('mousemove', onPlayheadMouseMove)
  window.removeEventListener('mouseup', onPlayheadMouseUp)
  cancelPlayheadClickTimer()
})

defineExpose({
  drawWaveform,
})
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
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.85),
    0 0 1px rgba(255, 255, 255, 0.15);
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
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.capsule-field.start-field.is-focused {
  border-color: var(--primary-color);
  box-shadow:
    0 0 0 1px var(--primary-color),
    0 0 8px rgba(34, 197, 94, 0.25);
}

.capsule-field.end-field.is-focused {
  border-color: var(--primary-red);
  box-shadow:
    0 0 0 1px var(--primary-red),
    0 0 8px rgba(239, 68, 68, 0.25);
}

.capsule-badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  user-select: none;
}

.capsule-badge.start-badge {
  color: var(--primary-color);
}

.capsule-badge.end-badge {
  color: var(--primary-red);
}

.capsule-badge.playhead-badge {
  color: #38bdf8;
}

.capsule-field.playhead-field.is-focused {
  border-color: #38bdf8;
  box-shadow:
    0 0 0 1px #38bdf8,
    0 0 8px rgba(56, 189, 248, 0.35);
}

.capsule-arrow.playhead-arrow {
  left: 50%;
  transform: translateX(-50%);
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
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
  overflow: visible;
  cursor: crosshair;
  user-select: none;
  width: 100%;
}

.waveform-canvas {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
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
  border-radius: 0;
}

.trim-overlay.end-overlay {
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
}

.selection-range-window {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 2;
}

.selection-dim-curtain {
  position: absolute;
  left: 0;
  width: 100%;
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
  background: rgba(0, 0, 0, 0.72);
  pointer-events: none;
  z-index: 1;
  transition: height var(--slide-duration, 0.28s) cubic-bezier(0.4, 0, 0.2, 1);
}

.selection-dim-curtain.dim-top {
  top: 0;
}

.selection-dim-curtain.dim-bottom {
  bottom: 0;
}

.selection-spotlight {
  position: absolute;
  left: 0;
  width: 100%;
  pointer-events: none;
  z-index: 2;
  box-sizing: border-box;
  border-top: 1.5px solid rgba(255, 255, 255, 0.15);
  border-bottom: 1.5px solid rgba(255, 255, 255, 0.15);
  transition:
    top var(--slide-duration) cubic-bezier(0.4, 0, 0.2, 1),
    height var(--slide-duration) cubic-bezier(0.4, 0, 0.2, 1),
    border-color var(--slide-duration) cubic-bezier(0.4, 0, 0.2, 1),
    background-color var(--slide-duration) cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow var(--slide-duration) cubic-bezier(0.4, 0, 0.2, 1);
}

.selection-spotlight.track-mic {
  background: rgba(56, 189, 248, 0.06);
  border-top-color: var(--primary-blue);
  border-bottom-color: var(--primary-blue);
  box-shadow: inset 0 0 16px rgba(56, 189, 248, 0.1);
}

.selection-spotlight.track-input {
  background: rgba(52, 211, 153, 0.06);
  border-top-color: var(--primary-color);
  border-bottom-color: var(--primary-color);
  box-shadow: inset 0 0 16px rgba(52, 211, 153, 0.1);
}

.selection-spotlight.track-both {
  background: rgba(255, 255, 255, 0.02);
  border-top-color: rgba(255, 255, 255, 0.2);
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.trim-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 20px;
  margin-left: -10px;
  cursor: ew-resize;
  z-index: 40;
  transition: z-index 0.1s;
  user-select: none;
  -webkit-user-drag: none;
}

.trim-handle:hover {
  z-index: 45;
}

.trim-handle.active-handle {
  z-index: 46;
}

.handle-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 9px;
  width: 2px;
}

.start-handle .handle-line {
  background: var(--primary-color);
  box-shadow: 0 0 8px var(--primary-color);
}

.end-handle .handle-line {
  background: var(--primary-red);
  box-shadow: 0 0 8px var(--primary-red);
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
  pointer-events: auto;
  cursor: pointer;
  z-index: 37;
  transition:
    transform 0.1s ease,
    filter 0.1s ease,
    box-shadow 0.1s ease;
}

.handle-flag:hover {
  filter: brightness(1.2);
  transform: scale(1.05);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.start-flag {
  left: 8px;
  background: var(--primary-color);
}

.end-flag {
  right: 8px;
  background: var(--primary-red);
}

.playhead-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: #ffffff;
  box-shadow:
    0 0 6px rgba(255, 255, 255, 0.9),
    0 0 12px rgba(56, 189, 248, 0.6);
  pointer-events: none;
  z-index: 25;
}

.playhead-cap {
  position: absolute;
  bottom: -16px;
  left: -7px;
  width: 16px;
  height: 16px;
  background: #ffffff;
  clip-path: polygon(50% 0%, 100% 60%, 100% 100%, 0% 100%, 0% 60%);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
  cursor: ew-resize;
  pointer-events: auto;
  transition: transform 0.1s ease;
  user-select: none;
  -webkit-user-drag: none;
  z-index: 41;
}

.playhead-hit-area {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -8px;
  width: 18px;
  background: transparent;
  cursor: ew-resize;
  pointer-events: auto;
  user-select: none;
}

.playhead-capsule-card {
  top: -34px;
  z-index: 100;
}

.segment-boundary-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--text-color);
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.25);
  pointer-events: auto;
  cursor: pointer;
  z-index: 12;
  transform: translateX(-50%);
  transition:
    background 0.15s,
    box-shadow 0.15s;
}

.segment-boundary-line.is-dragging-handle {
  pointer-events: none;
}

.segment-boundary-line:hover {
  background: #38bdf8;
  box-shadow:
    0 0 8px rgba(56, 189, 248, 0.8),
    0 0 2px #ffffff;
}

.segment-boundary-line.is-snapped {
  background: #f59e0b;
  box-shadow: 0 0 4px rgba(245, 158, 11, 0.5);
}

.segment-boundary-hit-area {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -8px;
  width: 18px;
  background: transparent;
}

.playhead-line.is-snapped {
  background: transparent;
  box-shadow: 0 0 6px rgba(56, 189, 248, 0.6);
}

.playhead-line.is-snapped .playhead-cap {
  background: #38bdf8;
}

.trim-handle.is-snapped .handle-line {
  box-shadow: 0 0 4px rgba(245, 158, 11, 0.5);
}

/* Active Snap Guideline: Clean line with lock emoji below */
.active-snap-guideline {
  position: absolute;
  top: 0;
  bottom: 22px;
  width: 2px;
  background: #f59e0b;
  box-shadow: 0 0 4px rgba(245, 158, 11, 0.5);
  z-index: 28;
  pointer-events: none;
  transform: translateX(-50%);
}

.snap-lock-foot {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 2px;
  font-size: 14px;
  line-height: 1;
  pointer-events: none;
  user-select: none;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.95));
  animation: lockPop 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes lockPop {
  0% {
    transform: translateX(-50%) scale(0.4);
    opacity: 0;
  }

  70% {
    transform: translateX(-50%) scale(1.2);
    opacity: 1;
  }

  100% {
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
}

/* Boundary Quick Actions Popover */
.boundary-menu-popover {
  position: absolute;
  z-index: 50;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  box-shadow:
    0 10px 25px -5px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.08);
  min-width: 240px;
  padding: 6px;
  animation: popoverFadeIn 0.12s ease-out;
}

@keyframes popoverFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.boundary-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 6px 8px;
  border-bottom: 1px solid #27272a;
  margin-bottom: 4px;
}

.boundary-menu-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: #e4e4e7;
  font-family: monospace;
}

.boundary-menu-close {
  background: transparent;
  border: none;
  color: #71717a;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 4px;
  line-height: 1;
}

.boundary-menu-close:hover {
  color: #f43f5e;
}

.boundary-menu-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.boundary-menu-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #d4d4d8;
  font-size: 0.75rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all 0.12s ease;
}

.boundary-menu-btn:hover {
  background: #27272a;
  color: #ffffff;
}

.boundary-menu-btn .btn-icon {
  font-size: 0.8rem;
  color: #38bdf8;
  width: 14px;
  text-align: center;
}

.boundary-menu-btn .badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 1px 4px;
  border-radius: 3px;
  line-height: 1.1;
}

.boundary-menu-btn .badge.in {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.boundary-menu-btn .badge.out {
  background: rgba(244, 63, 94, 0.2);
  color: #fb7185;
  border: 1px solid rgba(244, 63, 94, 0.4);
}

.boundary-menu-divider {
  height: 1px;
  background: #27272a;
  margin: 3px 0;
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
