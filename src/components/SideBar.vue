<template>
  <div class="sideBar" :class="{ opened: sideBarOpen }">
    <div :class="['menu', { active: hamburgerActive }]">
      <button
        class="button-four"
        aria-controls="primary-navigation"
        title="Show main menu"
        :aria-expanded="sideBarOpen"
        :data-state="sideBarOpen ? 'open' : 'closed'"
        @keydown.enter.space.prevent="handleEnterKeyDown"
        @keyup.space.enter="handleEnterKeyUp"
        @click="sideBarOpen = !sideBarOpen">
        <svg fill="var(--button-color)" class="hamburger" viewBox="10 10 80 80">
          <rect class="line middle" width="80" height="10" x="10" y="45" rx="5"></rect>
          <rect class="line top" width="80" height="10" x="10" y="25" rx="5"></rect>
          <rect class="line bottom" width="80" height="10" x="10" y="65" rx="5"></rect>
        </svg>
        Menu
      </button>
    </div>
    <div class="sideBarContent">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const sideBarOpen = ref(false)
const hamburgerActive = ref(false)

function handleEnterKeyDown() {
  hamburgerActive.value = true
}

function handleEnterKeyUp() {
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

.menu {
  display: flex;
  font-weight: bold;
  width: 100%;
  padding: var(--padding-width);
}

.menu > button:active,
.menu:active {
  color: var(--link-color);
}

.menu > button:active > svg,
.menu:active > svg {
  fill: var(--link-color);
}
.menu.active {
  color: var(--link-color);
}
.menu.active > button > svg {
  fill: var(--link-color);
}

.main {
  width: 100%;
  margin: 0 auto;
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

.button-four {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.button-four:focus-visible {
  outline: 2px solid var(--active-color);
  outline-offset: 4px;
}

.button-four > svg {
  transition: rotate var(--animation-time) linear;
  rotate: 0deg;
}

.button-four[aria-expanded='true'] > svg {
  rotate: 360deg;
}

.button-four .line {
  transition: rotate var(--animation-time) ease-in, x var(--animation-time) ease-in, y var(--animation-time) ease-in,
    width calc(var(--animation-time) / 4) ease-in var(--animation-time);
}

.button-four .top {
  transform-origin: 10px 32px;
}

.button-four .bottom {
  transform-origin: 10px 71px;
}

.button-four[aria-expanded='true'] .top {
  rotate: -45deg;
  x: -4px;
  y: 43px;
  width: 50px;
}

.button-four[aria-expanded='true'] .bottom {
  rotate: 45deg;
  x: -6px;
  y: 48px;
  width: 50px;
}
</style>
