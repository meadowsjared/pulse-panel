<template>
  <div class="sideBar" :class="{ opened: sideBarOpen }">
    <button
      class="menu-button select-none"
      :class="{ active: hamburgerActive }"
      aria-controls="primary-navigation"
      title="Show main menu"
      :aria-expanded="sideBarOpen"
      @keydown.enter.space.prevent="hamburgerActive = true"
      @keyup.space.enter="toggleSidebar"
      @click="toggleSidebar">
      <svg fill="var(--button-color)" class="hamburger" viewBox="10 10 80 80">
        <rect class="line middle" width="80" height="10" x="10" y="45" rx="5"></rect>
        <rect class="line top" width="80" height="10" x="10" y="25" rx="5"></rect>
        <rect class="line bottom" width="80" height="10" x="10" y="65" rx="5"></rect>
      </svg>
      Menu
    </button>
    <div class="sideBarContent">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const sideBarOpen = ref(false)
const hamburgerActive = ref(false)

function toggleSidebar() {
  sideBarOpen.value = !sideBarOpen.value
  hamburgerActive.value = false
}
</script>

<style scoped>
.sideBar {
  --menu-width: 9rem;
  --menu-closed-width: 50px;
  --padding-width: 0.5rem;
  width: var(--menu-closed-width);
  display: flex;
  flex-direction: column;
  background: var(--alt-bg-color);
  transition: width 0.5s;
}

.sideBar.opened {
  width: var(--menu-width);
}

.menu-button {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: var(--padding-width);
  font-weight: bold;
}

.menu-button:active,
.menu-button.active {
  color: var(--link-color);
}

.menu-button:active > svg,
.menu-button.active > svg {
  fill: var(--link-color);
}

.menu-button:focus-visible {
  outline: 2px solid var(--active-color);
  outline-offset: -4px;
}

.menu-button > svg {
  transition: rotate var(--animation-time) linear;
  rotate: 0deg;
}

.menu-button[aria-expanded='true'] > svg {
  rotate: 360deg;
}

.sideBarContent {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: var(--padding-width);
  gap: 1rem;
  height: 100%;
  justify-content: space-between;
}

.hamburger {
  width: 34px;
  aspect-ratio: 1;
  fill: var(--text-color);
  --animation-time: 400ms;
  flex-shrink: 0;
}

.hamburger .line {
  transition: rotate var(--animation-time) ease-in, x var(--animation-time) ease-in, y var(--animation-time) ease-in,
    width calc(var(--animation-time) / 4) ease-in var(--animation-time);
}

.hamburger .top {
  transform-origin: 10px 32px;
}

.hamburger .bottom {
  transform-origin: 10px 71px;
}

.menu-button[aria-expanded='true'] .top {
  rotate: -45deg;
  x: -4px;
  y: 43px;
  width: 50px;
}

.menu-button[aria-expanded='true'] .bottom {
  rotate: 45deg;
  x: -6px;
  y: 48px;
  width: 50px;
}
</style>
