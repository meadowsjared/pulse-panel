<template>
  <div class="main">
    <div class="bar">
      <h1 class="mx-auto">Settings</h1>
      <inline-svg
        :src="CloseIcon"
        class="w-6 h-6 cursor-pointer close-button"
        @click="close"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import InlineSvg from "vue-inline-svg"
import CloseIcon from "../assets/images/close.svg"

function close() {
  window.close()
}
</script>

<style scoped>
.bar {
  background: lightgreen;
  display: flex;
  align-items: center;
  justify-content: space-between;
  -webkit-app-region: drag;
  position: sticky;
  top: 0;
}

.close-button {
  cursor: pointer;
  position: absolute;
  right: 0.5rem;
  -webkit-app-region: no-drag;
}
</style>
