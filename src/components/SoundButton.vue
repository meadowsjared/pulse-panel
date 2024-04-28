<template>
  <button
    @click="playSound"
    v-if="modelValue"
    v-on:drop="handleFileDrop"
    v-on:dragover.prevent
    :class="{ 'playing-sound': playingSound }"
    class="sound-button"
  >
    <span>{{ modelValue.name }}</span>
  </button>
  <button
    @click="addSound"
    v-else
    v-on:drop="handleFileDrop"
    v-on:dragover.prevent
    class="sound-button add-button"
  >
    <inline-svg :src="Plus" />
  </button>
</template>

<script setup lang="ts">
import { useSoundStore } from "../store/sound";
import { Sound } from "../../@types/sound";
import { ref } from "vue";
import Plus from "../assets/images/plus.svg";
import InlineSvg from "vue-inline-svg";

// Define the props
const props = withDefaults(
  defineProps<{
    modelValue: Sound | null;
  }>(),
  {
    modelValue: null,
  }
);

// define the emits
const emits = defineEmits<{
  (event: "update:modelValue", value: Sound): void;
}>();

// useModel(props, "modelValue");
const playingSound = ref(false);
const numSoundsPlaying = ref(0);

const soundStore = useSoundStore();

function playSound() {
  playingSound.value = true;
  numSoundsPlaying.value++;
  soundStore.playSound(props.modelValue?.audioUrl ?? null).then(() => {
    numSoundsPlaying.value--;
    if (numSoundsPlaying.value < 1) {
      playingSound.value = false;
    }
  });
}

function addSound() {
  const newSound: Sound = {
    name: "New Sound",
    audioUrl: null,
  };
  emits("update:modelValue", newSound);
}

/**
 * Handles the file drop event
 * @param event The drag event
 */
function handleFileDrop(event: DragEvent) {
  event.preventDefault();
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  if (props.modelValue === null) {
    if (file) {
      const newSound = {
        name: stripFileExtension(file.name),
        audioUrl: URL.createObjectURL(file),
      };
      emits("update:modelValue", newSound);
    }
    return;
  }
  const newSound = { ...props.modelValue, audioUrl: URL.createObjectURL(file) };
  emits("update:modelValue", newSound);
}

/**
 * Strips the file extension from a file name
 * @param fileName The name of the file
 */
function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}
</script>

<style scoped>
.add-button > svg {
  width: 50%;
  height: 50%;
  margin: auto;
  fill: var(--alt-bg-color);
}

.sound-button {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--alt-light-text-color);
  color: var(--alt-bg-color);
  border-radius: 0.313rem;
}

.sound-button.playing-sound {
  background: var(--alt-text-color);
}
</style>