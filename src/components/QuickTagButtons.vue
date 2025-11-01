<template>
  <div class="flex flex-wrap ml-4 gap-2 py-[7px]">
    <div
      :class="['tag flex', { active: settingsStore.invertQuickTags }, { inverted: settingsStore.invertQuickTags }]"
      @click="toggleInvert">
      Invert<inline-svg :src="InvertIcon" :class="['ml-1 w-4 h-4', { invert: settingsStore.invertQuickTags }]" />
    </div>
    <div
      v-for="tag in settingsStore.quickTags"
      @click="toggleTag"
      @contextmenu.prevent="toggleNegated(tag)"
      :class="[
        'p-2 tag',
        { active: tag.active },
        { negated: tag.negated },
        { inverted: settingsStore.invertQuickTags },
      ]">
      {{ tag.label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../store/settings'
import InlineSvg from 'vue-inline-svg'
import InvertIcon from '../assets/images/invert.svg'
import { LabelActive } from '../@types/sound'
const settingsStore = useSettingsStore()

function toggleTag(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const tag = target.innerText
  settingsStore.toggleQuickTag(tag)
}

function toggleInvert() {
  settingsStore.toggleInvertQuickTags()
}

function toggleNegated(tag: LabelActive) {
  settingsStore.toggleQuickTagNegated(tag)
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
.tag.inverted {
  outline: 2px solid var(--active-color);
}
.tag.negated {
  background-color: var(--negated-color);
  color: var(--title-bar-bg-color);
  text-shadow: 1px 0 0 currentColor;
}
</style>
