<template>
  <div class="flex ml-4 gap-2">
    <div v-for="tag in settingsStore.quickTags" @click="toggleTag" :class="['p-2 tag', { active: tag.active }]">
      {{ tag.label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../store/settings'
const settingsStore = useSettingsStore()

const toggleTag = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  const tag = target.innerText
  settingsStore.toggleQuickTag(tag)
}
</script>

<style scoped>
.tag {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  background-color: var(--button-accent-color);
  border-radius: 100vw;
  color: var(--background-color);
  cursor: pointer;
  user-select: none;
  -webkit-app-region: no-drag;
}
.tag.active {
  background-color: var(--active-color);
  color: var(--title-bar-bg-color);
  text-shadow: 1px 0 0 currentColor;
}
</style>
