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
