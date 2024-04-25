<template>
  <div>
    <h1 class="text-2xl">Information</h1>
    <div class="mt-2">
      <div class="flex mb-2">
        <div class="mr-2">Pinia:</div>
        <div class="font-bold">
          {{ versions?.pinia ?? "N/A" }}
        </div>
      </div>
      <div class="flex mb-2">
        <div class="mr-2">Vue.js:</div>
        <div class="font-bold">
          {{ versions?.vue ?? "N/A" }}
        </div>
      </div>
      <div class="flex mb-2">
        <div class="mr-2">Electron:</div>
        <div class="font-bold">
          {{ versions?.electron ?? "N/A" }}
        </div>
      </div>
      <div class="flex mb-2">
        <div class="mr-2">Node:</div>
        <div class="font-bold">
          {{ versions?.node ?? "N/A" }}
        </div>
      </div>
      <div class="flex mb-2">
        <div class="mr-2">Chrome:</div>
        <div class="font-bold">
          {{ versions?.chrome ?? "N/A" }}
        </div>
      </div>
      <div class="flex mb-2">
        <div class="mr-2">Platform:</div>
        <div class="font-bold">
          {{ versions?.platform ?? "N/A" }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"

const versions = ref(window.electron?.versions)
</script>
