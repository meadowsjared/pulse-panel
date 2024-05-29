<template>
  <div class="sideBar" :class="{ opened: sideBarOpen }">
    <div class="menu">
      <button
        class="button-four"
        aria-controls="primary-navigation"
        title="Show main menu"
        :aria-expanded="sideBarOpen"
        :data-state="sideBarOpen ? 'open' : 'closed'"
        @click="sideBarOpen = !sideBarOpen">
        <svg fill="var(--button-color)" class="hamburger" viewBox="10 10 80 80">
          <rect class="line middle" width="80" height="10" x="10" y="45" rx="5"></rect>
          <rect class="line top" width="80" height="10" x="10" y="25" rx="5"></rect>
          <rect class="line bottom" width="80" height="10" x="10" y="65" rx="5"></rect></svg
        >Menu
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
</script>

<style scoped>
.sideBar {
  --menu-width: 9rem;
  --menu-closed-width: 50px;
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
  padding: 0.5rem;
  font-weight: bold;
  overflow: hidden;
}

.main {
  width: 100%;
  margin: 0 auto;
}

.sideBarContent {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  gap: 1rem;
  height: 100%;
  justify-content: space-between;
}

.hamburger {
  width: 34px;
  aspect-ratio: 1;
  fill: var(--text-color);
  --animation-time: 400ms;
}

.button-four {
  display: flex;
  align-items: center;
  gap: 1rem;
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
