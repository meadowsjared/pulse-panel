import { defineStore } from 'pinia'
import chordAlert from '../assets/wav/457518__graham_makes__chord-alert-notification.wav'
import { SettingsStore, useSettingsStore } from './settings'
import { Sound } from '@/@types/sound'

interface OutputDeviceProperties {
  currentAudio: HTMLAudioElement | null
  /** true if this device is playing audio */
  playingAudio: boolean
  /** number of sounds that are currently playing to this device */
  numSoundsPlaying: number
  currentSoundResolve: (() => void) | null
}

interface State {
  volume: number
  outputDeviceData: OutputDeviceProperties[]
  playingSoundIds: string[]
  currentSound: Sound | null
}

export const useSoundStore = defineStore('sound', {
  state: (): State => ({
    volume: 1,
    outputDeviceData: [
      {
        currentAudio: null,
        playingAudio: false,
        numSoundsPlaying: 0,
        currentSoundResolve: null,
      },
    ],
    playingSoundIds: [],
    currentSound: null,
  }),
  getters: {
    // if any sound is playing, this will be true
    isPlaying(): boolean {
      return this.outputDeviceData.some((data: OutputDeviceProperties) => data.playingAudio)
    },
  },
  actions: {
    /**
     * Stop all sounds that are currently playing
     */
    async stopAllSounds(): Promise<void> {
      const settingsStore = useSettingsStore()
      settingsStore.outputDevices.forEach(async (outputDeviceId: string) => {
        const index = settingsStore.outputDevices.findIndex((deviceId: string | null) => deviceId === outputDeviceId)
        if (
          settingsStore.allowOverlappingSound === false &&
          this.outputDeviceData[index].currentAudio &&
          this.outputDeviceData[index].playingAudio
        ) {
          this.outputDeviceData[index].currentAudio.pause()
          this.outputDeviceData[index].currentAudio.currentTime = 0
          this.playingSoundIds = this.playingSoundIds.filter(id => id !== this.currentSound?.id)
          this.currentSound = null
          this.outputDeviceData[index].numSoundsPlaying--
          if (this.outputDeviceData[index].currentSoundResolve) {
            this.outputDeviceData[index].currentSoundResolve()
            this.outputDeviceData[index].currentSoundResolve = null
          }
        } else {
          this.playingSoundIds = this.playingSoundIds.filter(id => id !== this.currentSound?.id)
          this.currentSound = null
        }

        // empty this array
        this.playingSoundIds = []
      })
    },
    /**
     * send the PTT key
     */
    async _pttHotkeyPress(down: boolean): Promise<void> {
      const settingsStore = useSettingsStore()
      if (settingsStore.ptt_hotkey === null) {
        return
      }
      window.electron?.sendKey(settingsStore.ptt_hotkey, down)
    },
    /**
     * Set the volume for the soundboard
     * @param volume the volume to set it to
     */
    async setVolume(
      volume: number,
      activeOutputDevices: string[] | null = null,
      selectedOutputDevices: (string | null)[] | null = null
    ): Promise<void> {
      const settingsStore = useSettingsStore()
      if (!activeOutputDevices) {
        activeOutputDevices = settingsStore.outputDevices
      }
      // filter out null values
      activeOutputDevices = activeOutputDevices.filter((deviceId): deviceId is string => deviceId !== null)
      if (!activeOutputDevices) return
      if (!selectedOutputDevices) {
        selectedOutputDevices = activeOutputDevices
      }
      const filteredSelectedOutputDevices = selectedOutputDevices.filter(
        (deviceId): deviceId is string => deviceId !== null
      )
      activeOutputDevices.forEach(async (outputDeviceId: string) => {
        const index = filteredSelectedOutputDevices.findIndex((deviceId: string | null) => deviceId === outputDeviceId)
        if (this.outputDeviceData[index].currentAudio) {
          this.outputDeviceData[index].currentAudio.volume = volume
        }
      })
    },
    /** Populate the playing audio array
     * @param length the length to populate it to
     **/
    populatePlayingAudio(length: number): void {
      while (this.outputDeviceData.length < length) {
        this.outputDeviceData.push({
          currentAudio: null,
          playingAudio: false,
          numSoundsPlaying: 0,
          currentSoundResolve: null,
        })
      }
    },
    /**
     * Play a sound, if another sound is playing, it can stop it
     * @param activeOutputDevices device array to play the sound on
     * @param volume volume to play the sound at, defaults to `this.volume`
     * @param audioFile the file to play, defaults to `chordAlert`
     */
    async playSound(
      audioFile: Sound | null = null,
      activeOutputDevices: string[] | null = null,
      selectedOutputDevices: (string | null)[] | null = null
    ): Promise<void> {
      // return a promise
      return new Promise(resolve => {
        ;(async () => {
          const settingsStore = useSettingsStore()
          if (settingsStore.muted) return // if muted, don't play the sound
          if (!activeOutputDevices) {
            activeOutputDevices = settingsStore.outputDevices
          }
          // filter out null values
          activeOutputDevices = activeOutputDevices.filter((deviceId): deviceId is string => deviceId !== null)
          if (!activeOutputDevices) return
          if (!selectedOutputDevices) {
            selectedOutputDevices = activeOutputDevices
          }
          // filter out null values
          const filteredSelectedOutputDevices = selectedOutputDevices.filter(
            (deviceId): deviceId is string => deviceId !== null
          )
          activeOutputDevices.forEach(async (outputDeviceId: string) => {
            await this._playSoundToDevice(
              outputDeviceId,
              audioFile?.volume ?? null,
              resolve,
              filteredSelectedOutputDevices,
              settingsStore,
              audioFile
            )
          })
        })()
      })
    },
    /**
     * Play a sound on a specific device
     * @param outputDeviceId the device to play the sound on
     * @param volume volume to play the sound at, defaults to `this.volume`
     * @param resolve the resolve function to call when the sound is done playing
     */
    async _playSoundToDevice(
      outputDeviceId: string,
      volume: number | null,
      resolve: () => void,
      selectedOutputDevices: string[],
      settingsStore: SettingsStore,
      audioFile: Sound | null
    ): Promise<void> {
      const index = selectedOutputDevices.findIndex((deviceId: string | null) => deviceId === outputDeviceId)
      if (
        settingsStore.allowOverlappingSound === false &&
        this.outputDeviceData[index].currentAudio &&
        this.outputDeviceData[index].playingAudio
      ) {
        this.outputDeviceData[index].currentAudio.pause()
        this.outputDeviceData[index].currentAudio.currentTime = 0
        this.playingSoundIds = this.playingSoundIds.filter(id => id !== this.currentSound?.id)
        this.currentSound = null
        this.outputDeviceData[index].numSoundsPlaying--
        if (this.outputDeviceData[index].currentSoundResolve) {
          this.outputDeviceData[index].currentSoundResolve()
          this.outputDeviceData[index].currentSoundResolve = null
        }
      } else {
        this.playingSoundIds = this.playingSoundIds.filter(id => id !== this.currentSound?.id)
        this.currentSound = null
      }

      if (audioFile?.audioUrl === undefined && audioFile?.audioKey !== undefined) {
        const audioUrl = await settingsStore.getFile(audioFile.audioKey)
        if (audioUrl) {
          audioFile.audioUrl = audioUrl
        }
      }
      this.outputDeviceData[index].currentAudio = new Audio(audioFile?.audioUrl ?? chordAlert)

      if (!this.outputDeviceData[index].currentAudio) return
      await this.outputDeviceData[index].currentAudio.setSinkId(outputDeviceId).catch((error: any) => {
        let errorMessage = error
        if (error.name === 'SecurityError') {
          errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`
        }
        console.error(errorMessage)
      })
      this.outputDeviceData[index].currentAudio.volume = volume ?? this.volume // set the volume to max
      this.outputDeviceData[index].currentAudio.onplaying = () => {
        this.outputDeviceData[index].playingAudio = true
      }
      this.outputDeviceData[index].numSoundsPlaying++
      if (audioFile?.id) this.playingSoundIds.push(audioFile.id)
      this.currentSound = audioFile
      this._pttHotkeyPress(true)
      this.outputDeviceData[index].currentAudio.play()
      this.outputDeviceData[index].currentSoundResolve = resolve // store this so we can end it early if we want to
      this.outputDeviceData[index].currentAudio.onended = () => {
        this._pttHotkeyPress(false)
        this.playingSoundIds = this.playingSoundIds.filter(id => id !== audioFile?.id)
        this.currentSound = null
        this.outputDeviceData[index].currentAudio?.remove()
        this.outputDeviceData[index].currentAudio = null
        this.outputDeviceData[index].numSoundsPlaying--
        if (this.outputDeviceData[index].numSoundsPlaying < 1) {
          this.outputDeviceData[index].playingAudio = false
        }
        this.outputDeviceData[index].currentSoundResolve?.()
      }
    },
  },
})
