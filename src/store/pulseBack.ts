import { defineStore } from 'pinia'
import { openDB, IDBPDatabase } from 'idb'
import { pulseBackBuffer } from '../services/pulseBackBuffer'
import { useSettingsStore } from './settings'
import { Sound } from '../@types/sound'
import Router from '../router'

export interface PulseBackClip {
  id: string
  title: string
  duration: number
  audioUrl: string
  blob: Blob
  createdAt: number
  hasDualTracks?: boolean
  tags?: string[]
}

interface PulseBackState {
  isBufferEnabled: boolean
  isBufferRunning: boolean
  isLiveRecording: boolean
  liveRecordSeconds: number
  liveRecordRetroStart: number
  clips: PulseBackClip[]
  selectedClipId: string | null
  toastMessage: string | null
  toastTimeout: ReturnType<typeof setTimeout> | null
}

const DB_NAME = 'pulse-back-clips'
const STORE_NAME = 'clips'

let dbPromise: Promise<IDBPDatabase> | null = null

function getClipDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

let liveTimer: ReturnType<typeof setInterval> | null = null

export const usePulseBackStore = defineStore('pulseBack', {
  state: (): PulseBackState => ({
    isBufferEnabled: false,
    isBufferRunning: false,
    isLiveRecording: false,
    liveRecordSeconds: 0,
    liveRecordRetroStart: 30,
    clips: [],
    selectedClipId: null,
    toastMessage: null,
    toastTimeout: null,
  }),

  getters: {
    selectedClip(state): PulseBackClip | null {
      if (!state.selectedClipId) {
        return state.clips.length > 0 ? state.clips[0] : null
      }
      return state.clips.find(c => c.id === state.selectedClipId) || (state.clips[0] ?? null)
    },
  },

  actions: {
    async init(): Promise<void> {
      try {
        const db = await getClipDB()
        const rawClips = await db.getAll(STORE_NAME)
        if (rawClips && rawClips.length > 0) {
          this.clips = rawClips
            .map(raw => ({
              id: raw.id,
              title: raw.title || 'Untitled Clip',
              duration: raw.duration || 0,
              blob: raw.blob,
              audioUrl: raw.blob ? URL.createObjectURL(raw.blob) : '',
              createdAt: raw.createdAt || Date.now(),
              hasDualTracks: raw.hasDualTracks ?? false,
              tags: raw.tags || [],
            }))
            .sort((a, b) => b.createdAt - a.createdAt)

          if (this.clips.length > 0 && !this.selectedClipId) {
            this.selectedClipId = this.clips[0].id
          }
        }
      } catch (err) {
        console.warn('Could not load Pulse Back clips from IDB:', err)
      }

      // Check if pulse_back_enabled was saved in database
      const electron = window.electron
      if (electron?.readDBSetting) {
        const savedEnabled = await electron.readDBSetting('pulse_back_enabled')
        if (savedEnabled === true) {
          this.isBufferEnabled = true
          await this.startBuffer()
        }
      }
    },

    async toggleBuffer(): Promise<void> {
      this.isBufferEnabled = !this.isBufferEnabled

      const electron = window.electron
      if (electron?.saveDBSetting) {
        await electron.saveDBSetting('pulse_back_enabled', this.isBufferEnabled)
      }

      if (this.isBufferEnabled) {
        await this.startBuffer()
        this.showToast('Pulse Back buffer active')
      } else {
        this.stopBuffer()
        this.showToast('Pulse Back buffer turned off')
      }
    },

    async startBuffer(micDeviceId?: string | null, inputDeviceId?: string | null): Promise<void> {
      const settingsStore = useSettingsStore()
      const micDevice = micDeviceId ?? settingsStore.selectedMicrophoneId
      const inputDevice = inputDeviceId ?? settingsStore.pulse_back_input_device
      const effectiveMicVol = settingsStore.microphoneMuted ? 0 : (settingsStore.microphoneVolume ?? 1)
      const effectiveInputVol = settingsStore.pulse_back_muted ? 0 : (settingsStore.pulse_back_volume ?? 1)
      try {
        await pulseBackBuffer.start(micDevice, inputDevice, 180, effectiveMicVol, effectiveInputVol)
        this.isBufferRunning = true
      } catch (err) {
        console.error('Failed to start Pulse Back buffer:', err)
        this.isBufferRunning = false
        this.isBufferEnabled = false
        this.showToast('Could not access audio device for Pulse Back')
      }
    },

    stopBuffer(): void {
      if (this.isLiveRecording) {
        this.stopLiveCapture()
      }
      pulseBackBuffer.stop()
      this.isBufferRunning = false
    },

    async triggerQuickClip(seconds?: number, continueRecording: boolean = false): Promise<PulseBackClip | null> {
      if (!this.isBufferRunning) {
        this.showToast('Enable Pulse Back buffer first')
        return null
      }

      const captureSecs = seconds ?? 30

      if (continueRecording) {
        pulseBackBuffer.startLivePunchIn(captureSecs)
        this.isLiveRecording = true
        this.liveRecordRetroStart = captureSecs
        this.liveRecordSeconds = 0

        if (liveTimer) clearInterval(liveTimer)
        liveTimer = setInterval(() => {
          this.liveRecordSeconds += 1
        }, 1000)

        this.showToast(`Pulse Back: Recording live (started at -${captureSecs}s)`)
        return null
      }

      // Instant capture
      const { blob, duration, hasDualTracks } = await pulseBackBuffer.extractRetroactive(captureSecs)
      if (duration <= 0.1) {
        this.showToast('Not enough audio recorded yet in buffer')
        return null
      }

      return await this.saveNewClip(blob, duration, `Clip -${Math.round(duration)}s`, hasDualTracks)
    },

    async stopLiveCapture(): Promise<PulseBackClip | null> {
      if (!this.isLiveRecording) return null

      if (liveTimer) {
        clearInterval(liveTimer)
        liveTimer = null
      }
      this.isLiveRecording = false

      const { blob, duration, hasDualTracks } = await pulseBackBuffer.stopLivePunchIn()
      const totalSec = Math.round(duration)
      return await this.saveNewClip(blob, duration, `Clip (${totalSec}s)`, hasDualTracks)
    },

    async saveNewClip(blob: Blob, duration: number, title?: string, hasDualTracks: boolean = false): Promise<PulseBackClip> {
      const id = crypto.randomUUID()
      const now = Date.now()
      const defaultTitle = title || `Pulse Back ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`

      const clip: PulseBackClip = {
        id,
        title: defaultTitle,
        duration,
        blob,
        audioUrl: URL.createObjectURL(blob),
        createdAt: now,
        hasDualTracks,
        tags: ['clip'],
      }

      this.clips.unshift(clip)
      this.selectedClipId = clip.id

      try {
        const db = await getClipDB()
        await db.put(STORE_NAME, {
          id: clip.id,
          title: clip.title,
          duration: clip.duration,
          blob: clip.blob,
          createdAt: clip.createdAt,
          hasDualTracks: clip.hasDualTracks,
          tags: clip.tags,
        })
      } catch (err) {
        console.warn('Could not persist clip to IndexedDB:', err)
      }

      this.showToast(`Saved ${clip.title}!`)
      return clip
    },

    async deleteClip(clipId: string): Promise<void> {
      const idx = this.clips.findIndex(c => c.id === clipId)
      if (idx !== -1) {
        const clip = this.clips[idx]
        if (clip.audioUrl) {
          try { URL.revokeObjectURL(clip.audioUrl) } catch {}
        }
        this.clips.splice(idx, 1)

        if (this.selectedClipId === clipId) {
          this.selectedClipId = this.clips[0]?.id ?? null
        }

        try {
          const db = await getClipDB()
          await db.delete(STORE_NAME, clipId)
        } catch (err) {
          console.warn('Could not delete clip from IDB:', err)
        }
      }
    },

    async updateClip(clipId: string, updates: Partial<PulseBackClip>): Promise<void> {
      const clip = this.clips.find(c => c.id === clipId)
      if (!clip) return

      Object.assign(clip, updates)

      try {
        const db = await getClipDB()
        await db.put(STORE_NAME, {
          id: clip.id,
          title: clip.title,
          duration: clip.duration,
          blob: clip.blob,
          createdAt: clip.createdAt,
          hasDualTracks: clip.hasDualTracks,
          tags: clip.tags,
        })
      } catch (err) {
        console.warn('Could not update clip in IDB:', err)
      }
    },

    async publishToSoundboard(
      clipId: string,
      trimmedBlob: Blob,
      trimmedDuration: number,
      soundMetadata: { title: string; tags: string[]; color: string; volume?: number }
    ): Promise<void> {
      const settingsStore = useSettingsStore()
      const clip = this.clips.find(c => c.id === clipId)
      if (!clip) return

      const fileName = `${soundMetadata.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.wav`
      const file = new window.File([trimmedBlob], fileName, { type: 'audio/wav' })

      const { fileUrl, fileKey } = await settingsStore.saveFile(file)

      const newSound: Sound = {
        id: crypto.randomUUID(),
        title: soundMetadata.title,
        tags: soundMetadata.tags,
        color: soundMetadata.color,
        volume: soundMetadata.volume ?? 100,
        audioKey: fileKey,
        audioUrl: fileUrl,
        duration: trimmedDuration,
        soundSegments: [
          {
            id: crypto.randomUUID(),
            start: 0,
            end: trimmedDuration,
            label: 'Full',
          },
        ],
      }

      await settingsStore.insertSounds(settingsStore.sounds.length - 1, newSound)

      // Remove from clips draft
      await this.deleteClip(clipId)

      this.showToast(`Added "${newSound.title}" to Soundboard!`)
      Router.push('/soundboard')
    },

    showToast(message: string): void {
      this.toastMessage = message
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout)
      }
      this.toastTimeout = setTimeout(() => {
        this.toastMessage = null
        this.toastTimeout = null
      }, 3500)
    },
  },
})
