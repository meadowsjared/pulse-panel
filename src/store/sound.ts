import { defineStore } from 'pinia'
import chordAlert from '../assets/wav/new-notification-7-210334.mp3'
import { SettingsStore, useSettingsStore } from './settings'
import { Sound } from '@/@types/sound'

interface OutputDeviceProperties {
  currentAudio: HTMLAudioElement[]
  /** true if this device is playing audio */
  playingAudio: boolean
  /** number of sounds that are currently playing to this device */
  numSoundsPlaying: number
}

interface State {
  volume: number
  outputDeviceData: OutputDeviceProperties[]
  playingSoundIds: string[]
  currentSound: Sound | null
  disabled: boolean
}

export const useSoundStore = defineStore('sound', {
  state: (): State => ({
    volume: 1,
    outputDeviceData: [
      {
        currentAudio: [],
        playingAudio: false,
        numSoundsPlaying: 0,
      },
    ],
    playingSoundIds: [],
    currentSound: null,
    disabled: false,
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
      this._pttHotkeyPress(settingsStore, false)
      settingsStore.outputDevices.forEach(async (outputDeviceId: string) => {
        const index = settingsStore.outputDevices.findIndex((deviceId: string | null) => deviceId === outputDeviceId)
        if (this.outputDeviceData[index]?.currentAudio.length > 0 && this.outputDeviceData[index].playingAudio) {
          this.outputDeviceData[index].currentAudio.forEach(audio => {
            audio.pause()
            audio.currentTime = 0
            this.outputDeviceData[index].numSoundsPlaying--
            this.outputDeviceData[index].playingAudio = false
          })
        }
      })
      this.currentSound = null
      // empty this array
      this.playingSoundIds = []
    },
    /**
     * send the PTT key
     */
    async _pttHotkeyPress(settingsStore: SettingsStore, down: boolean): Promise<void> {
      if (settingsStore.ptt_hotkey === null) {
        return
      }
      await window.electron?.sendKey([...settingsStore.ptt_hotkey], down)
    },
    /**
     * Set the volume for the soundboard
     * @param volume the volume to set it to
     */
    async setVolume(volume: number, soundId: string): Promise<void> {
      this.outputDeviceData.forEach((outputDevice: OutputDeviceProperties) => {
        outputDevice.currentAudio
          .filter(audio => audio.getAttribute('data-id') === soundId)
          .forEach(audio => {
            audio.volume = volume
          })
      })
    },
    /** Populate the playing audio array
     * @param length the length to populate it to
     **/
    populatePlayingAudio(length: number): void {
      while (this.outputDeviceData.length < length) {
        this.outputDeviceData.push({
          currentAudio: [],
          playingAudio: false,
          numSoundsPlaying: 0,
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
      selectedOutputDevices: (string | null)[] | null = null,
      preview: boolean = false,
      preventDoubleTrigger = false
    ): Promise<void> {
      // return a promise
      return new Promise(resolve => {
        const settingsStore = useSettingsStore()
        if (settingsStore.recordingHotkey || this.disabled) return // if muted, don't play the sound
        // console.debug('1 this.disabled = ', this.disabled)
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
        const audioFileId = audioFile?.id || chordAlert
        this.playingSoundIds.push(audioFileId)

        if (preventDoubleTrigger) this.disabled = true
        const handlePromiseAll = async (promiseAr: Promise<void>[]) => {
          await Promise.all(promiseAr)
          if (preventDoubleTrigger) this.disabled = true
          if (!preview) this._pttHotkeyPress(settingsStore, false)
          this.playingSoundIds = this.playingSoundIds.filter(id => id !== audioFileId)
          setTimeout(() => (this.disabled = false), 100)
          resolve()
        }
        if (!preview) this._pttHotkeyPress(settingsStore, true)
        if (preventDoubleTrigger) {
          setTimeout(() => (this.disabled = false), 100)
        }
        const promiseAr = activeOutputDevices?.map(async (outputDeviceId: string, index: number) => {
          if (preview && index !== 0) return // only play the sound on the first device if previewing
          await this._playSoundToDevice(
            outputDeviceId,
            audioFile?.volume ?? null,
            filteredSelectedOutputDevices,
            settingsStore,
            audioFile
          )
        })
        if (promiseAr) {
          handlePromiseAll(promiseAr)
        }
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
      selectedOutputDevices: string[],
      settingsStore: SettingsStore,
      audioFile: Sound | null
    ): Promise<void> {
      const index = selectedOutputDevices.findIndex((deviceId: string | null) => deviceId === outputDeviceId)
      if (index === -1) {
        console.error('Output device not found', { outputDeviceId, selectedOutputDevices })
        return
      }
      const outputDeviceData = this.outputDeviceData[index]
      if (
        settingsStore.allowOverlappingSound === false &&
        outputDeviceData.currentAudio.length > 0 &&
        outputDeviceData.playingAudio
      ) {
        outputDeviceData.currentAudio.forEach(audio => {
          audio.pause()
          audio.currentTime = 0
          outputDeviceData.numSoundsPlaying--
          outputDeviceData.playingAudio = false
        })
      }
      // this._pttHotkeyPress(false) // not necessary since we're playing a new sound clip
      this.playingSoundIds = this.playingSoundIds.filter(id => id !== this.currentSound?.id)
      this.currentSound = null

      if (audioFile?.audioUrl === undefined && audioFile?.audioKey !== undefined) {
        const audioUrl = await settingsStore.getFile(audioFile.audioKey)
        if (audioUrl) {
          audioFile.audioUrl = audioUrl
        }
      }

      const newAudio = new Audio(audioFile?.audioUrl ?? chordAlert)
      // add the id of the audio to the newAudio object so we can keep track of that later
      newAudio.setAttribute('data-id', audioFile?.id ?? chordAlert)
      outputDeviceData.currentAudio.push(newAudio)
      await newAudio.setSinkId(outputDeviceId).catch((error: any) => {
        let errorMessage = error
        if (error.name === 'SecurityError') {
          errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`
        }
        console.error(errorMessage)
      })
      await new Promise<void>(resolve => {
        if (!outputDeviceData.currentAudio) return
        newAudio.volume = settingsStore.muted ? 0 : volume ?? this.volume // set the volume to max
        newAudio.onplaying = () => {
          outputDeviceData.playingAudio = true
        }
        outputDeviceData.numSoundsPlaying++
        this.currentSound = audioFile
        newAudio.play()
        newAudio.onended = () => {
          this.currentSound = null
          newAudio?.remove()
          outputDeviceData.currentAudio = outputDeviceData.currentAudio.filter(audio => audio !== newAudio)
          outputDeviceData.numSoundsPlaying--
          if (outputDeviceData.numSoundsPlaying < 1) {
            outputDeviceData.playingAudio = false
          }
          resolve()
        }
      })
    },
  },
})
