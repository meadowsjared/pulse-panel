<template>
  <div class="toolbar">
    <div class="left-buttons">
      <input type="text" v-model="settingsStore.searchText" placeholder="Search..." />
      <button class="light" :class="{ hidden: settingsStore.searchText.length === 0 }" @click="clearSearch">
        <inline-svg class="w-6 h-6 rotate-45" :src="Plus" />
      </button>
    </div>
    <div class="right-buttons">
      <toggle class="displayMode" v-model="editMode" @update:modelValue="handleDisplayModeChange">{{
        editMode ? 'Play Mode' : 'Edit Mode'
      }}</toggle>
    </div>
  </div>
</template>

<script setup lang="ts">
import InlineSvg from 'vue-inline-svg'
import { ref, watch } from 'vue'
import Plus from '../assets/images/plus.svg'
import { useSettingsStore } from '../store/settings'

const settingsStore = useSettingsStore()
const editMode = ref(settingsStore.displayMode === 'play')

watch(
  () => settingsStore.displayMode,
  () => {
    editMode.value = settingsStore.displayMode === 'play'
  }
)

function handleDisplayModeChange() {
  settingsStore.displayMode = editMode.value ? 'play' : 'edit'
}

function clearSearch() {
  settingsStore.searchText = ''
}
</script>

<style scoped>
.left-buttons {
  display: flex;
  gap: 0.5rem;
}

button.light {
  width: 2.5rem;
  height: 2.5rem;
}

.toolbar {
  padding: 0.5rem 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--top-toolbar-color);
}

.toggle-group.displayMode {
  width: 15.5ch;
}
</style>
