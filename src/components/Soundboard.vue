<template>
  <div class="soundboard">
    <div v-for="(sound, i) in sounds" :key="sound?.audioUrl ?? 'new'">
      <sound-button v-model="sounds[i]" @update:modelValue="addButtonIfNull" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useSettingsStore } from "../store/settings";
import { Sound } from "../../@types/sound";

const sounds = ref<(Sound | null)[]>([null]);

const settingsStore = useSettingsStore();
settingsStore.fetchStringSetting("outputDeviceId").then((outputDevice) => {
  // outputDeviceId.value = outputDevice
});

function addButtonIfNull() {
  if (sounds.value[sounds.value.length - 1] !== null) {
    sounds.value.push(null);
  }
}
</script>

<style scoped>
.soundboard {
  grid-gap: 1rem;
  display: grid;
  margin: 1rem 1.5rem;
  width: 100%;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  grid-template-rows: repeat(auto-fill, 80px);
}
</style>
