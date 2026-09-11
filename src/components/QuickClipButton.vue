<template>
  <div class="quick-clip-wrapper"
       ref="clipMenuRef">
    <!-- Live Punch-In Recording State (Active) -->
    <button v-if="pulseBackStore.isLiveRecording"
            class="live-rec-btn"
            type="button"
            @click="pulseBackStore.stopLiveCapture()"
            title="Click to stop live recording">
      <span class="live-dot"></span>
      <span>Stop ({{ pulseBackStore.liveRecordSeconds }}s)</span>
    </button>

    <!-- Normal Quick Clip Button -->
    <button v-else
            type="button"
            :class="['quick-clip-btn', { active: showClipMenu, disabled: !pulseBackStore.isBufferRunning }]"
            :disabled="!pulseBackStore.isBufferRunning"
            @click="toggleClipMenu"
            :title="pulseBackStore.isBufferRunning ? 'Pulse Back (Quick Clip)' : 'Turn on Pulse Back buffer to clip'">
      <svg class="w-4 h-4"
           viewBox="0 0 24 24"
           fill="none"
           stroke="currentColor"
           stroke-width="2"
           stroke-linecap="round"
           stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 3" />
      </svg>
      <span class="btn-text">
        <slot>{{ label }}</slot>
      </span>
    </button>

    <!-- Dropdown Menu -->
    <transition name="tips-fade">
      <div v-if="showClipMenu && pulseBackStore.isBufferRunning"
           :class="['clip-menu-dropdown', alignClass]"
           @mousedown.stop>

        <div class="clip-presets">
          <button v-for="s in visiblePresets"
                  :key="s"
                  type="button"
                  :class="['preset-btn', { 'is-default': selectedPresetSeconds === s && s > 0 }]"
                  :title="continueRecordingLive ? (s === 0 ? 'Start live recording now' : `Start live punch-in from -${s}s`) : `Capture last ${s}s`"
                  @click="selectAndExecute(s)">
            {{ s === 0 ? '0s' : `-${s}s` }}
          </button>
        </div>

        <label class="continue-checkbox">
          <input type="checkbox"
                 v-model="continueRecordingLive" />
          <span>Continue recording live</span>
        </label>

        <div class="clip-menu-footer">
          <span>Hotkey: <kbd class="tip-kbd">{{ hotkeyLabel }}</kbd></span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { usePulseBackStore, PulseBackClip } from '../store/pulseBack';
import { useSettingsStore } from '../store/settings';

const props = withDefaults(
  defineProps<{
    label?: string;
    align?: 'left' | 'right';
    presets?: number[];
  }>(),
  {
    label: 'Clip',
    align: 'right',
    presets: () => [0, 15, 30, 60],
  }
);

const emit = defineEmits<{
  (e: 'clip-captured', clip: PulseBackClip | null): void;
}>();

const pulseBackStore = usePulseBackStore();
const settingsStore = useSettingsStore();

const showClipMenu = ref(false);
const clipMenuRef = ref<HTMLDivElement | null>(null);
const selectedPresetSeconds = ref(settingsStore.pulse_back_default_duration || 30);
const continueRecordingLive = ref(false);

const visiblePresets = computed(() => {
  if (continueRecordingLive.value) {
    return props.presets;
  }
  return props.presets.filter(s => s > 0);
});

const alignClass = computed(() => (props.align === 'left' ? 'align-left' : 'align-right'));

const hotkeyLabel = computed(() => {
  if (settingsStore.pulse_back_hotkey && settingsStore.pulse_back_hotkey.length > 0) {
    return settingsStore.pulse_back_hotkey.join('+');
  }
  return 'F12';
});

watch(
  () => settingsStore.pulse_back_default_duration,
  val => {
    if (val) selectedPresetSeconds.value = val;
  }
);

function toggleClipMenu() {
  if (!pulseBackStore.isBufferRunning) return;
  showClipMenu.value = !showClipMenu.value;
}

async function selectAndExecute(s: number) {
  if (s > 0) {
    selectedPresetSeconds.value = s;
    settingsStore.saveSetting('pulse_back_default_duration', s);
  }
  showClipMenu.value = false;
  const clip = await pulseBackStore.triggerQuickClip(s, continueRecordingLive.value);
  emit('clip-captured', clip);
}

function handleClickOutside(event: MouseEvent) {
  if (clipMenuRef.value && !clipMenuRef.value.contains(event.target as Node)) {
    showClipMenu.value = false;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleClickOutside);
});
</script>

<style scoped>
.quick-clip-wrapper {
  position: relative;
  display: inline-flex;
}

.quick-clip-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.65rem;
  background: var(--input-bg-color, #27272a);
  border: 1px solid var(--border-color, #3f3f46);
  border-radius: 8px;
  color: #e4e4e7;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.quick-clip-btn:hover:not(:disabled) {
  background: #3f3f46;
  border-color: #71717a;
  transform: translateY(-1px);
}

.quick-clip-btn.active {
  background: #3b82f6;
  border-color: #60a5fa;
  color: white;
}

.quick-clip-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.live-rec-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.75rem;
  background: #dc2626;
  border: 1px solid #ef4444;
  border-radius: 8px;
  color: white;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  animation: pulse-border 1.5s infinite;
  user-select: none;
}

.live-dot {
  width: 8px;
  height: 8px;
  background-color: white;
  border-radius: 50%;
  display: inline-block;
  animation: blink 1s infinite;
}

@keyframes blink {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

@keyframes pulse-border {

  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6);
  }

  50% {
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
  }
}

.clip-menu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 220px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 10px;
  padding: 0.85rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.clip-menu-dropdown.align-right {
  right: 0;
}

.clip-menu-dropdown.align-left {
  left: 0;
}

.clip-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 1px solid #27272a;
  padding-bottom: 0.4rem;
}

.clip-presets {
  display: flex;
  gap: 0.4rem;
}

.preset-btn {
  flex: 1;
  padding: 0.5rem 0.25rem;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  color: #d4d4d8;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preset-btn:hover {
  background: #2563eb;
  border-color: #3b82f6;
  color: white;
  transform: translateY(-1px);
}

.preset-btn:active {
  transform: translateY(0);
}

.preset-btn.is-default {
  border-color: rgba(59, 130, 246, 0.6);
  background: rgba(37, 99, 235, 0.15);
  color: #93c5fd;
}

.preset-btn.is-default:hover {
  background: #2563eb;
  border-color: #3b82f6;
  color: white;
}

.continue-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.clip-menu-footer {
  display: flex;
  justify-content: flex-end;
  font-size: 0.7rem;
  color: #71717a;
}

.tip-kbd {
  font-family: monospace;
  font-size: 0.65rem;
  padding: 0.1rem 0.3rem;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  color: #e4e4e7;
}

.tips-fade-enter-active,
.tips-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tips-fade-enter-from,
.tips-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
