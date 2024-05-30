<template>
  <div class="soundboard">
    <template v-for="(sound, i) in sounds" :key="sound?.id">
      <sound-button
        :class="{ placeholder: sound.isPreview }"
        v-model="sounds[i]"
        :draggable="settingsStore.displayMode === 'edit' && sound.name !== undefined"
        :displayMode="settingsStore.displayMode"
        @dragstart="dragStart(sound, i)"
        @dragover="dragOver(i)"
        @drop="drop(i)"
        @update:modelValue="handleSoundsUpdate"
        @deleteSound="deleteSound(sound)"
        @editSound="editSound(sound)"
        @dragend="dragEnd(sound)" />
    </template>
  </div>
  <div v-if="settingsStore.currentEditingSound !== null" class="rightSideBar">
    <SoundEditor v-model="settingsStore.currentEditingSound" @update:modelValue="updateSound" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../store/settings'
import { Sound } from '../../@types/sound'
import { v4 } from 'uuid'

const sounds = ref<Sound[]>([])

const settingsStore = useSettingsStore()
let draggedIndex: number | null = null
let draggedIndexStart: number | null = null

settingsStore.fetchStringArray('outputDevices')
settingsStore.fetchBooleanSetting('darkMode', true)
settingsStore.fetchSoundSetting('sounds').then(soundsArray => {
  sounds.value = soundsArray
  // console.log('sounds', soundsArray)
})

function dragEnd(pSound: Sound) {
  if (draggedIndexStart === null) return
  sounds.value = sounds.value.filter(sound => !sound.isPreview)
  pSound.isPreview = false
  sounds.value.splice(draggedIndexStart, 0, pSound)
  draggedIndex = null
  draggedIndexStart = null
}

function dragStart(pSound: Sound, index: number) {
  if (settingsStore.displayMode !== 'edit') return
  draggedIndexStart = index
  pSound.isPreview = true
  draggedIndex = index
}

function drop(index: number) {
  if (settingsStore.displayMode !== 'edit') return
  if (draggedIndex === null) return
  index = Math.min(index, sounds.value.length - 2)
  const draggedSound = sounds.value[draggedIndex]
  sounds.value.splice(draggedIndex, 1)
  sounds.value.splice(index, 0, draggedSound)
  draggedSound.isPreview = false
  updateSound()
  draggedIndex = null
  draggedIndexStart = null
}

function dragOver(index: number) {
  if (settingsStore.displayMode !== 'edit') return
  if (draggedIndex === null) return
  if (index !== draggedIndex) {
    index = Math.min(index, sounds.value.length - 2)
    const draggedSound = sounds.value[draggedIndex]
    sounds.value.splice(draggedIndex, 1)
    sounds.value.splice(index, 0, draggedSound)
    draggedIndex = index
  }
}

function updateSound() {
  settingsStore.saveSoundArray('sounds', stripAudioUrls(sounds.value))
}

function deleteSound(pSound: Sound) {
  sounds.value = sounds.value.filter(sound => sound.id !== pSound.id)
  settingsStore.deleteFile(pSound.audioKey)
  settingsStore.deleteFile(pSound.imageKey)
  settingsStore.saveSoundArray('sounds', stripAudioUrls(sounds.value))
  settingsStore.currentEditingSound = null
}

function editSound(pSound: Sound) {
  if (settingsStore.currentEditingSound === null || settingsStore.currentEditingSound.id !== pSound.id) {
    settingsStore.currentEditingSound = pSound
  } else {
    settingsStore.currentEditingSound = null
  }
}

function handleSoundsUpdate(event: Sound) {
  if (event.id === settingsStore.currentEditingSound?.id) {
    settingsStore.currentEditingSound = event
  }
  // add a new sound if sound is null
  if (sounds.value[sounds.value.length - 1].name !== undefined) {
    sounds.value.push({
      id: v4(),
    })
  }
  settingsStore.saveSoundArray('sounds', stripAudioUrls(sounds.value))
}

function stripAudioUrls(pSounds: Sound[]) {
  return pSounds.map(sound => {
    return {
      id: sound.id,
      name: sound.name,
      hotkey: sound.hotkey,
      hideName: sound.hideName,
      audioKey: sound.audioKey,
      imageKey: sound.imageKey,
      volume: sound.volume,
    }
  })
}
</script>

<style scoped>
.soundboard {
  grid-gap: 1rem;
  display: grid;
  padding: 1rem;
  width: 100%;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  grid-auto-rows: 80px;
  overflow: auto;
}

.rightSideBar {
  width: 300px;
  height: 100%;
  background: var(--alt-bg-color);
  padding: 1rem;
  overflow-y: auto;
  overflow-x: hidden;
}

.placeholder {
  opacity: 50%;
}
</style>
