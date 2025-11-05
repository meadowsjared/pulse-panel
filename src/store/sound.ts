import { defineStore } from 'pinia'
import { SettingsStore, useSettingsStore } from './settings'
import type { Sound, SoundSegment } from '../@types/sound'
import chordAlert from '../assets/wav/new-notification-7-210334.mp3'

interface OutputDeviceProperties {
  currentAudio: HTMLAudioElement[]
  /** true if this device is playing audio */
  playingAudio: boolean
  /** number of sounds that are currently playing to this device */
  numSoundsPlaying: number
}

interface State {
  outputDeviceData: OutputDeviceProperties[]
  playingSoundIds: { fileId: string; instanceId: string }[]
  currentSound: Sound | null
  sendingPttHotkey: boolean
}

export const useSoundStore = defineStore('sound', {
  state: (): State => ({
    outputDeviceData: [
      {
        currentAudio: [],
        playingAudio: false,
        numSoundsPlaying: 0,
      },
    ],
    playingSoundIds: [],
    currentSound: null,
    sendingPttHotkey: false,
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
          })
          this.outputDeviceData[index].numSoundsPlaying--
          this.outputDeviceData[index].playingAudio = false
        }
      })
      this.currentSound = null
      // empty this array
      this.playingSoundIds = []
    },
    /**
     * Mute all sounds by setting their volume to 0
     */
    async muteAllSounds(): Promise<void> {
      this.outputDeviceData.forEach((outputDevice: OutputDeviceProperties) => {
        outputDevice.currentAudio.forEach(audio => {
          audio.volume = 0
        })
      })
    },
    /**
     * Unmute all sounds by setting their volume to their original volume
     */
    async unmuteAllSounds(): Promise<void> {
      const settingsStore = useSettingsStore()
      this.outputDeviceData.forEach((outputDevice: OutputDeviceProperties) => {
        outputDevice.currentAudio.forEach(audio => {
          // find this audio in the sounds array
          const volume = settingsStore.sounds.find(sound => sound.id === audio.getAttribute('data-id'))?.volume
          audio.volume = volume ?? 1
        })
      })
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
          .filter(audio => audio.getAttribute('data-id')?.startsWith(`${soundId}_`) === true)
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
     * @param soundObject the file to play, defaults to `chordAlert`
     * @param activeOutputDevices device array to play the sound on
     * @param selectedOutputDevices device array to play the sound on
     * @param preview if true, it will not key up the PTT key
     * @param volume volume to play the sound at, defaults to `this.volume`
     * @returns a Promise<void> that resolves when the sound is done playing
     */
    async playSound(
      soundObject: Sound | null = null,
      activeOutputDevices: string[] | null = null,
      selectedOutputDevices: (string | null)[] | null = null,
      preview: boolean = false,
      preventFalseKeyTrigger = false,
      soundSegment?: SoundSegment
    ): Promise<void> {
      if (soundObject) {
        soundObject.reset = true
        // Reset the animation by toggling the resetAnimation ref
        setTimeout(() => {
          delete soundObject.reset
        })
      }
      const settingsStore = useSettingsStore()
      if (settingsStore.recordingHotkey) return Promise.resolve() // if muted, don't play the sound //  || this.sendingKey
      // console.debug('1 this.disabled = ', this.disabled)
      activeOutputDevices ??= settingsStore.outputDevices
      // filter out null values
      activeOutputDevices = activeOutputDevices.filter((deviceId): deviceId is string => deviceId !== null)
      if (!activeOutputDevices) return Promise.resolve()
      selectedOutputDevices ??= activeOutputDevices
      // filter out null values
      const filteredSelectedOutputDevices = selectedOutputDevices.filter(
        (deviceId): deviceId is string => deviceId !== null
      )
      const audioFileId: string = soundObject?.id ?? chordAlert
      const instanceId = crypto.randomUUID()
      // if we don't allow overlapping sounds, and there is a sound playing, remove it
      if (settingsStore.allowOverlappingSound === false && this.playingSoundIds.length > 0) {
        this.playingSoundIds = []
        // note: we actually stop the sounds playing in _playSoundToDevice for each device
      }

      if (preventFalseKeyTrigger) this.sendingPttHotkey = true
      if (settingsStore.allowOverlappingSound) {
        if (!preview && this.playingSoundIds.length === 0) {
          this._pttHotkeyPress(settingsStore, true)
        }
      } else if (!preview) {
        this._pttHotkeyPress(settingsStore, true)
      }
      this.playingSoundIds.push({ fileId: audioFileId, instanceId })
      if (preventFalseKeyTrigger) {
        setTimeout(() => (this.sendingPttHotkey = false), 100)
      }
      this.currentSound = soundObject
      const segment = soundSegment ??
        soundObject?.soundSegments?.[0] ?? { start: 0, end: soundObject?.duration ?? 100, id: crypto.randomUUID() }
      if (preview) {
        segment.isSoundPreview = true
      }
      if (this.currentSound) {
        this.currentSound.activeSegment = segment
      }
      const promiseAr: Promise<void>[] = activeOutputDevices?.map<Promise<void>>(
        async (outputDeviceId: string, index: number) => {
          if (preview && index !== 0) return // only play the sound on the first device if previewing
          await this._playSoundToDevice(
            outputDeviceId,
            audioFileId,
            instanceId,
            soundObject?.volume ?? settingsStore.defaultVolume,
            filteredSelectedOutputDevices,
            settingsStore,
            soundObject,
            segment
          )
        }
      )

      // convert the array of promises to a single promise that resolves when all promises are done
      const done = new Promise<void>(resolve => {
        ;(promiseAr === null ? Promise.resolve() : Promise.all(promiseAr)).then(() => {
          if (preventFalseKeyTrigger) this.sendingPttHotkey = true
          this.playingSoundIds = this.playingSoundIds.filter(
            item => `${item.fileId}_${item.instanceId}` !== `${audioFileId}_${instanceId}`
          )
          if (settingsStore.allowOverlappingSound) {
            if (this.playingSoundIds.length < 1) {
              if (!preview) this._pttHotkeyPress(settingsStore, false)
            }
          } else if (!preview) {
            this._pttHotkeyPress(settingsStore, false)
          }
          if (preventFalseKeyTrigger) {
            setTimeout(() => (this.sendingPttHotkey = false), 100)
          }
          if (this.currentSound?.activeSegment?.isSoundPreview === true) {
            delete this.currentSound.activeSegment.isSoundPreview
          }
          if (this.currentSound) {
            delete this.currentSound.activeSegment
          }
          this.currentSound = null
          resolve()
        })
      })
      return done
    },
    /**
     * Play a sound on a specific device
     * @param outputDeviceId the device to play the sound on
     * @param soundId the id of the sound to play
     * @param instanceId the instance id of the sound to play
     * @param volume volume to play the sound at, defaults to `this.volume`
     * @param selectedOutputDevices list of available output devices
     * @param settingsStore the settings store
     * @param soundObject the file to play, defaults to `chordAlert`
     * @param soundSegment optional segment of the sound to play (otherwise it defaults to the first segment defined, otherwise it defaults to the whole sound)
     */
    async _playSoundToDevice(
      outputDeviceId: string,
      soundId: string,
      instanceId: string,
      volume: number,
      selectedOutputDevices: string[],
      settingsStore: SettingsStore,
      soundObject: Sound | null,
      soundSegment?: SoundSegment
    ): Promise<void> {
      const index = selectedOutputDevices.findIndex((deviceId: string | null) => deviceId === outputDeviceId)
      if (index === -1) {
        console.error('Output device not found', { outputDeviceId, selectedOutputDevices })
        return Promise.resolve()
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
        })
        outputDeviceData.numSoundsPlaying--
        outputDeviceData.playingAudio = false
        outputDeviceData.currentAudio = [] // since we stopped them all, empty the array
      }

      const newAudio = new Audio(soundObject?.audioUrl ?? chordAlert)
      // add the id of the audio to the newAudio object so we can keep track of that later
      newAudio.setAttribute('data-id', `${soundId}_${instanceId}`)
      outputDeviceData.currentAudio.push(newAudio)
      await newAudio.setSinkId(outputDeviceId).catch((error: any) => {
        let errorMessage = error
        if (error.name === 'SecurityError') {
          errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`
        }
        console.error(errorMessage)
      })
      const done = new Promise<void>(resolve => {
        const onEnded = () => {
          outputDeviceData.currentAudio = outputDeviceData.currentAudio.filter(
            audio => audio.getAttribute('data-id') !== `${soundId}_${instanceId}`
          )
          newAudio?.remove()
          outputDeviceData.numSoundsPlaying--
          if (outputDeviceData.numSoundsPlaying < 1) {
            outputDeviceData.playingAudio = false
          }
          resolve()
        }
        if (!outputDeviceData.currentAudio) return
        if (soundSegment) {
          newAudio.currentTime = soundSegment.start
          // set the stop time
          newAudio.ontimeupdate = () => {
            if (newAudio.currentTime >= soundSegment.end) {
              newAudio.pause()
              onEnded()
            }
          }
        }
        newAudio.volume = settingsStore.muted ? 0 : volume
        newAudio.onplaying = () => {
          outputDeviceData.playingAudio = true
        }
        outputDeviceData.numSoundsPlaying++
        newAudio.play()
        newAudio.onended = onEnded
      })

      return done
    },
    /**
     * Stop a sound by its id
     * @param soundObject the sound object to stop the animation for
     * @param settingsStore the settings store
     * @param soundId the id of the sound to stop
     * @param instanceId the instance id of the sound to stop
     * @returns void
     */
    stopSound(soundObject: Sound | null, settingsStore: SettingsStore, soundId: string, instanceId: string): void {
      settingsStore.outputDevices.forEach((outputDeviceId: string) => {
        const index = settingsStore.outputDevices.findIndex((deviceId: string | null) => deviceId === outputDeviceId)
        if (this.outputDeviceData[index]?.currentAudio.length > 0 && this.outputDeviceData[index].playingAudio) {
          this.outputDeviceData[index].currentAudio
            .filter(audio => audio.getAttribute('data-id') === `${soundId}_${instanceId}`)
            .forEach(audio => {
              audio.pause()
              audio.currentTime = 0
            })
          this.outputDeviceData[index].currentAudio = this.outputDeviceData[index].currentAudio.filter(
            audio => audio.getAttribute('data-id') !== `${soundId}_${instanceId}`
          )
          this.outputDeviceData[index].numSoundsPlaying--
          this.outputDeviceData[index].playingAudio = false
          const indexToRemove = this.playingSoundIds.findIndex(
            item => `${item.fileId}_${item.instanceId}` === `${soundId}_${instanceId}`
          )
          if (indexToRemove !== -1) {
            this.playingSoundIds.splice(indexToRemove, 1)
          }
        }
      })
      if (soundObject) {
        // Reset the animation by toggling the resetAnimation ref
        soundObject.reset = true
      }
    },
  },
})
