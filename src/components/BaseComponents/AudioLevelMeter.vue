<template>
  <div ref="trackRef" class="audio-level-track">
    <svg class="audio-level-svg" :viewBox="`0 0 ${barCount * 10} 20`" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#2ecc71" />
          <stop offset="20%" stop-color="#2ecc71" />
          <stop offset="55%" stop-color="#f1c40f" />
          <stop offset="85%" stop-color="#e74c3c" />
          <stop offset="100%" stop-color="#e74c3c" />
        </linearGradient>
        <mask :id="maskId">
          <rect
            v-for="i in barCount"
            :key="i"
            :x="(i - 1) * 10 + 2.5"
            y="2"
            width="5"
            height="16"
            rx="2.5"
            ry="2.5"
            fill="white" />
        </mask>
      </defs>
      <!-- Background ghost scale: faint unlit bars -->
      <rect
        x="0"
        y="0"
        :width="barCount * 10"
        height="20"
        :fill="`url(#${gradientId})`"
        opacity="0.22"
        :mask="`url(#${maskId})`" />
      <!-- Active illuminated bars -->
      <rect
        x="0"
        y="0"
        :width="activeBarCount * 10"
        height="20"
        :fill="muted ? '#7f8c8d' : `url(#${gradientId})`"
        :mask="`url(#${maskId})`"
        class="audio-level-fill-rect" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId } from 'vue'

interface Props {
  level?: number
  muted?: boolean
  max?: number
}

const props = withDefaults(defineProps<Props>(), {
  level: 0,
  muted: false,
  max: 100,
})

const rawId = useId()
const sanitizedId = computed(() => rawId.replace(/[^a-zA-Z0-9-_]/g, '_'))
const gradientId = computed(() => `audio-meter-grad-${sanitizedId.value}`)
const maskId = computed(() => `audio-meter-mask-${sanitizedId.value}`)

const trackRef = ref<HTMLElement | null>(null)
const trackWidth = ref(360)
let resizeObserver: ResizeObserver | null = null

const barCount = computed(() => Math.max(1, Math.floor(trackWidth.value / 10)))
const activeBarCount = computed(() => {
  const lvl = props.level ?? 0
  if (lvl <= 0) return 0
  const maxVal = props.max > 0 ? props.max : 100
  const ratio = Math.max(0, Math.min(1, lvl / maxVal))
  return Math.min(barCount.value, Math.ceil(ratio * barCount.value))
})

onMounted(() => {
  if (trackRef.value) {
    trackWidth.value = trackRef.value.clientWidth || 360
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          trackWidth.value = Math.round(entry.contentRect.width)
        }
      }
    })
    resizeObserver.observe(trackRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.audio-level-track {
  flex: 1;
  min-width: 0;
  height: 2.625rem;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  background: transparent;
  padding: 0;
}

.audio-level-svg {
  width: 100%;
  height: 20px;
  display: block;
}

.audio-level-fill-rect {
  transition: width 0.05s ease-out;
}
</style>
