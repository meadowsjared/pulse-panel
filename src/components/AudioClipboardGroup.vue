<template>
  <div class="audio-clipboard-group" role="toolbar" aria-label="Audio editing tools">
    <div class="clip-action-cluster">
      <button
        type="button"
        v-if="canUndo"
        class="clip-action-btn"
        :disabled="!canUndo"
        @click="$emit('undo')"
        title="Undo edit (Ctrl+Z)"
        aria-label="Undo">
        <svg
          class="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
      </button>
      <button
        type="button"
        v-if="canRedo"
        class="clip-action-btn"
        :disabled="!canRedo"
        @click="$emit('redo')"
        title="Redo edit (Ctrl+Y)"
        aria-label="Redo">
        <svg
          class="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
      </button>
    </div>
    <span class="clip-action-sep" v-if="canUndo || canRedo"></span>
    <div class="clip-action-cluster">
      <button
        type="button"
        v-if="canCut"
        class="clip-action-btn"
        :disabled="!canCut"
        @click="$emit('cut')"
        title="Cut selection (Ctrl+X)"
        aria-label="Cut selection">
        <svg
          class="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <circle cx="6" cy="6" r="3"></circle>
          <circle cx="6" cy="18" r="3"></circle>
          <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
          <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
          <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
        </svg>
      </button>
      <button
        type="button"
        v-if="canCopy"
        class="clip-action-btn"
        :disabled="!canCopy"
        @click="$emit('copy')"
        title="Copy selection (Ctrl+C)"
        aria-label="Copy selection">
        <svg
          class="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
      <button
        type="button"
        v-if="canPaste"
        class="clip-action-btn"
        :disabled="!canPaste"
        @click="$emit('paste')"
        :title="pasteTooltip"
        aria-label="Paste audio">
        <svg
          class="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        </svg>
      </button>
      <button
        type="button"
        v-if="canCut"
        class="clip-action-btn delete-action-btn"
        :disabled="!canCut"
        @click="$emit('delete')"
        title="Delete selection (Del or Backspace)"
        aria-label="Delete selection">
        <svg
          class="w-3.5 h-3.5 text-red-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    </div>
    <span class="clip-action-sep"></span>
    <div class="clip-action-cluster">
      <button
        type="button"
        class="clip-action-btn in-out-btn"
        @click="$emit('setIn')"
        title="Set In point to playhead (Press 'I')"
        aria-label="Set In point">
        <svg
          class="w-3.5 h-3.5 text-emerald-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <line x1="5" y1="4" x2="5" y2="20"></line>
          <line x1="9" y1="12" x2="19" y2="12"></line>
          <polyline points="14 7 19 12 14 17"></polyline>
        </svg>
      </button>
      <button
        type="button"
        class="clip-action-btn in-out-btn"
        @click="$emit('setOut')"
        title="Set Out point to playhead (Press 'O')"
        aria-label="Set Out point">
        <svg
          class="w-3.5 h-3.5 text-rose-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <line x1="19" y1="4" x2="19" y2="20"></line>
          <line x1="15" y1="12" x2="5" y2="12"></line>
          <polyline points="10 7 5 12 10 17"></polyline>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  canUndo?: boolean
  canRedo?: boolean
  canCut?: boolean
  canCopy?: boolean
  canPaste?: boolean
  pasteTooltip?: string
}

withDefaults(defineProps<Props>(), {
  canUndo: false,
  canRedo: false,
  canCut: false,
  canCopy: false,
  canPaste: false,
  pasteTooltip: 'Paste audio (Ctrl+V)',
})

defineEmits<{
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'cut'): void
  (e: 'copy'): void
  (e: 'paste'): void
  (e: 'delete'): void
  (e: 'setIn'): void
  (e: 'setOut'): void
}>()
</script>

<style scoped>
.audio-clipboard-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 6px;
  padding: 2px 3px;
  flex-wrap: wrap;
  max-width: 100%;
}

.clip-action-cluster {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.clip-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.12s ease;
  user-select: none;
}

.clip-action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.clip-action-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.clip-action-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.delete-action-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.3);
}

.in-out-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.clip-action-sep {
  width: 1px;
  height: 14px;
  background: #27272a;
  margin: 0 2px;
}
</style>
