import { defineStore } from 'pinia'
import chordAlert from '../assets/wav/457518__graham_makes__chord-alert-notification.wav'
import { useSettingsStore } from './settings'

interface State {
  volume: number
  currentAudio: HTMLAudioElement | null
  playingAudio: boolean
  numSoundsPlaying: number
  currentSoundResolve: (() => void) | null
}

export const useSoundStore = defineStore('sound', {
  state: (): State => ({
    volume: 1,
    currentAudio: null,
    playingAudio: false,
    numSoundsPlaying: 0,
    currentSoundResolve: null,
  }),
  actions: {
    /**
     * Set the volume for the soundboard
     * @param volume the volume to set it to
     */
    async setVolume(volume: number): Promise<void> {
      this.volume = volume
    },
    /**
     * Play a sound, if another sound is playing, it can stop it
     * @param outputDeviceId device to play the sound on
     * @param volume volume to play the sound at, defaults to `this.volume`
     * @param audioFile the file to play, defaults to `chordAlert`
     */
    async playSound(
      audioFile: string | null = chordAlert,
      outputDeviceId: string | null = null,
      volume: number | null = null
    ): Promise<void> {
      // return a promise
      return new Promise(async resolve => {
        const settingsStore = useSettingsStore()
        if (settingsStore.allowOverlappingSound === false && this.currentAudio && this.playingAudio) {
          this.currentAudio.pause()
          this.currentAudio.currentTime = 0
          this.numSoundsPlaying--
          if (this.currentSoundResolve) {
            this.currentSoundResolve()
            this.currentSoundResolve = null
          }
        }

        this.currentAudio = new Audio(audioFile ?? chordAlert)

        if (!outputDeviceId) {
          outputDeviceId = settingsStore.outputDeviceId
          if (!outputDeviceId) {
            return
          }
        }

        await this.currentAudio.setSinkId(outputDeviceId).catch((error: any) => {
          let errorMessage = error
          if (error.name === 'SecurityError') {
            errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`
          }
          console.error(errorMessage)
        })
        this.currentAudio.volume = volume ?? this.volume // set the volume to max
        this.currentAudio.onplaying = () => {
          this.playingAudio = true
        }
        this.numSoundsPlaying++
        this.currentAudio.play()
        this.currentSoundResolve = resolve // store this so we can end it early if we want to
        this.currentAudio.onended = () => {
          this.currentAudio?.remove()
          this.currentAudio = null
          this.numSoundsPlaying--
          if (this.numSoundsPlaying < 1) {
            this.playingAudio = false
          }
          resolve()
        }
      })
    },
  },
})
