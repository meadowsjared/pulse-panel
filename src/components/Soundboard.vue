<template>
  <div class="soundboard">
    <div v-for="(sound, i) in sounds" :key="sound?.id">
      <sound-button v-model="sounds[i]" @update:modelValue="handleSoundsUpdate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../store/settings'
import { Sound } from '../../@types/sound'
import { v4 } from 'uuid'

const sounds = ref<Sound[]>([])

const settingsStore = useSettingsStore()
settingsStore.fetchStringSetting('outputDeviceId')
settingsStore.fetchBooleanSetting('darkMode', true)
settingsStore.fetchArraySetting('sounds').then(soundsArray => {
  sounds.value = soundsArray
})

function handleSoundsUpdate() {
  // add a new sound if sound is null
  if (sounds.value[sounds.value.length - 1].name !== undefined) {
    sounds.value.push({
      id: v4(),
    })
  }
  settingsStore.saveArray('sounds', stripAudioUrls(sounds.value))
  // console.log('sounds', JSON.stringify(sounds.value, null, 2))
}

function stripAudioUrls(pSounds: Sound[]) {
  return pSounds.map(sound => {
    return {
      id: sound.id,
      name: sound.name,
      audioPath: sound.audioPath,
      imagePath: sound.imagePath,
    }
  })
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
