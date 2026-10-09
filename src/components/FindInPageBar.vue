<template>
  <transition name="find-bar-slide">
    <div class="find-bar-container"
         @mousedown.stop
         @contextmenu.stop
         @keydown.stop>
      <div class="find-bar-input-wrapper">
        <input ref="findInputRef"
               type="text"
               class="find-bar-input"
               v-model="findQuery"
               placeholder="Find in page..."
               @input="handleFindInput"
               @keydown="handleFindInputKeydown" />
      </div>

      <div class="find-bar-count"
           :class="{ 'no-matches': !!findQuery && totalMatches === 0 }">
        {{ matchCountDisplay }}
      </div>

      <div class="find-bar-divider"></div>

      <button type="button"
              class="find-bar-btn"
              :disabled="totalMatches === 0"
              @click="handleFindPrev"
              title="Previous match (Shift+Enter)">
        <svg class="w-3.5 h-3.5"
             viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="2.5">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>

      <button type="button"
              class="find-bar-btn"
              :disabled="totalMatches === 0"
              @click="handleFindNext"
              title="Next match (Enter)">
        <svg class="w-3.5 h-3.5"
             viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <button type="button"
              class="find-bar-btn close-btn"
              @click="handleClose"
              title="Close (Esc)">
        <svg class="w-3.5 h-3.5"
             viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="2.5">
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
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';

const props = defineProps<{
  webview: any;
  initialQuery?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const findInputRef = ref<HTMLInputElement | null>(null);
const findQuery = ref(props.initialQuery || '');
const currentMatch = ref(0);
const totalMatches = ref(0);
const deadSearchPrefix = ref('');
let findDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const matchCountDisplay = computed(() => {
  if (!findQuery.value || !findQuery.value.trim()) return '0/0';
  if (totalMatches.value === 0) return '0/0';
  const current = currentMatch.value > 0 ? currentMatch.value : 1;
  return `${current}/${totalMatches.value}`;
});

function getWebviewEl(): any {
  if (!props.webview) return null;
  return props.webview.$el || props.webview;
}

function executeFindAsYouType() {
  const wv = getWebviewEl();
  const text = findQuery.value.trim();
  if (!wv) return;

  if (!text) {
    currentMatch.value = 0;
    totalMatches.value = 0;
    deadSearchPrefix.value = '';
    try {
      wv.stopFindInPage?.('clearSelection');
    } catch (_) { }
    return;
  }

  // Short-circuit: If a shorter prefix already returned 0 matches,
  // extending it cannot produce matches on this document.
  const lowerText = text.toLowerCase();
  if (deadSearchPrefix.value && lowerText.startsWith(deadSearchPrefix.value)) {
    currentMatch.value = 0;
    totalMatches.value = 0;
    return;
  }

  if (typeof wv.findInPage === 'function') {
    try {
      // forward: true and findNext: true immediately activates & scrolls to match 1
      wv.findInPage(text, { forward: true, findNext: true, matchCase: false });
    } catch (err) {
      console.warn('findInPage error:', err);
    }
  }
}

function executeFindStep(forward = true) {
  const wv = getWebviewEl();
  const text = findQuery.value.trim();
  if (!wv || !text) return;

  if (typeof wv.findInPage === 'function') {
    try {
      wv.findInPage(text, { forward, findNext: true, matchCase: false });
    } catch (err) {
      console.warn('findInPage step error:', err);
    }
  }
}

function handleFindInput() {
  const query = findQuery.value;
  if (!query || !query.trim()) {
    if (findDebounceTimer) {
      clearTimeout(findDebounceTimer);
      findDebounceTimer = null;
    }
    executeFindAsYouType();
    return;
  }

  if (findDebounceTimer) {
    clearTimeout(findDebounceTimer);
  }

  // Fast 50ms debounce so typing feels instantaneous while avoiding redundant IPC floods
  findDebounceTimer = setTimeout(() => {
    executeFindAsYouType();
  }, 50);
}

function handleFindPrev() {
  executeFindStep(false);
}

function handleFindNext() {
  executeFindStep(true);
}

function handleClose() {
  emit('close');
}

function handleFindInputKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) {
    e.preventDefault();
    e.stopPropagation();
    findInputRef.value?.select();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!findQuery.value.trim()) return;
    if (findDebounceTimer) {
      clearTimeout(findDebounceTimer);
      findDebounceTimer = null;
    }
    if (e.shiftKey) {
      executeFindStep(false);
    } else {
      executeFindStep(true);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    handleClose();
  }
}

const handleFoundInPage = (e: any) => {
  const result = e.result || e;
  if (typeof result.activeMatchOrdinal === 'number') {
    currentMatch.value = result.activeMatchOrdinal;
  }
  if (typeof result.matches === 'number') {
    totalMatches.value = result.matches;
    if (result.matches > 0) {
      deadSearchPrefix.value = '';
      if (currentMatch.value === 0) {
        currentMatch.value = 1;
      }
    } else if (result.finalUpdate) {
      const currentLower = findQuery.value.trim().toLowerCase();
      if (currentLower) {
        deadSearchPrefix.value = currentLower;
      }
    }
  }
};

watch(() => props.initialQuery, (newVal) => {
  if (typeof newVal === 'string' && newVal.trim() && newVal !== findQuery.value) {
    findQuery.value = newVal.trim();
    nextTick(() => {
      findInputRef.value?.select();
      executeFindAsYouType();
    });
  }
});

const handleNavigate = () => {
  deadSearchPrefix.value = '';
  setTimeout(() => {
    if (findQuery.value.trim()) {
      executeFindAsYouType();
    }
  }, 250);
};

onMounted(() => {
  const wv = getWebviewEl();
  if (wv) {
    wv.addEventListener('found-in-page', handleFoundInPage);
    wv.addEventListener('did-navigate', handleNavigate);
    wv.addEventListener('did-navigate-in-page', handleNavigate);
  }

  nextTick(() => {
    findInputRef.value?.focus();
    findInputRef.value?.select();
    if (findQuery.value.trim()) {
      executeFindAsYouType();
    }
  });
});

onUnmounted(() => {
  if (findDebounceTimer) {
    clearTimeout(findDebounceTimer);
    findDebounceTimer = null;
  }
  const wv = getWebviewEl();
  if (wv) {
    try {
      wv.removeEventListener('found-in-page', handleFoundInPage);
      wv.removeEventListener('did-navigate', handleNavigate);
      wv.removeEventListener('did-navigate-in-page', handleNavigate);
      wv.stopFindInPage?.('clearSelection');
    } catch (_) { }
  }
});

defineExpose({
  focus() {
    findInputRef.value?.focus();
    findInputRef.value?.select();
  },
  setQuery(q: string) {
    findQuery.value = q;
    handleFindInput();
  },
  findNext() {
    executeFindStep(true);
  },
  findPrev() {
    executeFindStep(false);
  },
});
</script>

<style scoped>
.find-bar-container {
  position: absolute;
  top: 0.65rem;
  right: 1.25rem;
  z-index: 50;
  display: flex;
  align-items: center;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  padding: 0.2rem 0.35rem 0.2rem 0.55rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85), 0 2px 6px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  user-select: none;
}

.find-bar-input-wrapper {
  display: flex;
  align-items: center;
}

.find-bar-input {
  width: 160px;
  height: 1.75rem;
  background: transparent;
  border: none;
  outline: none;
  color: #ffffff;
  font-size: 0.82rem;
  font-family: inherit;
  padding: 0 0.25rem;
}

.find-bar-input::placeholder {
  color: #71717a;
}

.find-bar-input::selection {
  background: #0078d4;
  color: #ffffff;
}

.find-bar-count {
  font-size: 0.76rem;
  color: #a1a1aa;
  padding: 0 0.45rem;
  min-width: 2.2rem;
  text-align: center;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.find-bar-count.no-matches {
  color: #f87171;
}

.find-bar-divider {
  width: 1px;
  height: 1rem;
  background: rgba(255, 255, 255, 0.16);
  margin: 0 0.25rem;
}

.find-bar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
  padding: 0;
  transition: all 0.12s ease;
}

.find-bar-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.find-bar-btn:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.find-bar-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.find-bar-slide-enter-active,
.find-bar-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.find-bar-slide-enter-from,
.find-bar-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}
</style>
