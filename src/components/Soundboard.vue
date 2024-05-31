<template>
  <div class="main">
    <SoundToolbar />
    <div class="soundboard" :class="{ editing: settingsStore.displayMode === 'edit' }">
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
          @editSound="editSound(sound)"
          @dragend="dragEnd(sound)" />
      </template>
    </div>
  </div>
  <div v-if="settingsStore.currentEditingSound !== null" class="rightSideBar">
    <SoundEditor
      v-model="settingsStore.currentEditingSound"
      @update:modelValue="updateSound"
      @deleteSound="deleteSound($event)" />
  </div>
  <confirm-dialog
    v-model:showDialog="dialogOpen"
    title="Are you sure?"
    :message="`that you want to delete the '${soundToDelete?.name}' sound?`"
    @confirm="deleteSoundConfirmed"
    confirmText="Yes"
    cancelText="No" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../store/settings'
import { Sound } from '../../@types/sound'
import { v4 } from 'uuid'

const sounds = ref<Sound[]>([])
const dialogOpen = ref(false)
const soundToDelete = ref<Sound | null>(null)

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
  dialogOpen.value = true
  soundToDelete.value = pSound
}

function deleteSoundConfirmed() {
  if (soundToDelete.value === null) return
  const pSound = soundToDelete.value
  sounds.value = sounds.value.filter(sound => sound.id !== pSound.id)
  settingsStore.deleteFile(pSound.audioKey)
  settingsStore.deleteFile(pSound.imageKey)
  settingsStore.saveSoundArray('sounds', stripAudioUrls(sounds.value))
  soundToDelete.value = null
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
.main {
  display: flex;
  height: 100%;
  flex-grow: 1;
  flex-direction: column;
}

.soundboard {
  grid-gap: 1rem;
  display: grid;
  padding: 1rem;
  width: 100%;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  --grid-height: 80px;
  grid-auto-rows: var(--grid-height);
  overflow: auto;
}

.editing {
  grid-auto-rows: 136px;
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
