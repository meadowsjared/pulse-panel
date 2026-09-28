import { defineStore } from 'pinia';
import { toRaw } from 'vue';
import { openDB } from 'idb';
import { pulseBackBuffer } from '../services/pulseBackBuffer';
import { useSettingsStore } from './settings';
import { Sound } from '../@types/sound';
import Router from '../router';

export interface PulseBackClip {
  id: string;
  title: string;
  duration: number;
  audioUrl: string;
  blob: Blob;
  createdAt: number;
  fileName?: string;
  hasDualTracks?: boolean;
  tags?: string[];
  trimStart?: number;
  trimEnd?: number;
  currentTime?: number;
  volume?: number;
  color?: string;
  includeMic?: boolean;
  includeInput?: boolean;
}

export interface PulseBackClipMetadata {
  id: string;
  title: string;
  duration: number;
  fileName: string;
  createdAt: number;
  hasDualTracks?: boolean;
  tags?: string[];
  trimStart?: number;
  trimEnd?: number;
  currentTime?: number;
  volume?: number;
  color?: string;
  includeMic?: boolean;
  includeInput?: boolean;
}

interface PulseBackState {
  isBufferEnabled: boolean;
  isBufferRunning: boolean;
  isLiveRecording: boolean;
  liveRecordSeconds: number;
  liveRecordRetroStart: number;
  clips: PulseBackClip[];
  selectedClipId: string | null;
  toastMessage: string | null;
  toastTimeout: ReturnType<typeof setTimeout> | null;
}

const DB_NAME = 'pulse-back-clips';
const STORE_NAME = 'clips';

function toMetadata(clip: PulseBackClip): PulseBackClipMetadata {
  return {
    id: clip.id,
    title: clip.title,
    duration: clip.duration,
    fileName: clip.fileName || `${clip.id}.wav`,
    createdAt: clip.createdAt,
    hasDualTracks: clip.hasDualTracks,
    tags: clip.tags ? Array.from(toRaw(clip.tags)) : [],
    trimStart: clip.trimStart,
    trimEnd: clip.trimEnd,
    currentTime: clip.currentTime,
    volume: clip.volume,
    color: clip.color,
    includeMic: clip.includeMic,
    includeInput: clip.includeInput,
  };
}

async function persistClipsMetadata(clips: PulseBackClip[]): Promise<void> {
  const electron = window.electron;
  if (!electron?.saveDBSetting) return;
  try {
    const list = clips.map(toMetadata);
    await electron.saveDBSetting('pulse_back_clips', list);
  } catch (err) {
    console.warn('[PulseBack] Failed to persist clips to SQLite:', err);
  }
}

let liveTimer: ReturnType<typeof setInterval> | null = null;

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
        return state.clips.length > 0 ? state.clips[0] : null;
      }
      return state.clips.find(c => c.id === state.selectedClipId) || (state.clips[0] ?? null);
    },
  },

  actions: {
    async init(): Promise<void> {
      const electron = window.electron;

      // 1. One-time Migration from legacy IndexedDB 'pulse-back-clips' to disk & SQLite
      if (electron?.saveClipFile && electron?.readDBSetting && electron?.saveDBSetting) {
        try {
          const isMigrated = await electron.readDBSetting('pulse_back_clips_migrated');
          if (!isMigrated) {
            let legacyClips: any[] = [];
            try {
              const db = await openDB(DB_NAME, 1);
              if (db.objectStoreNames.contains(STORE_NAME)) {
                legacyClips = await db.getAll(STORE_NAME);
              }
              db.close();
            } catch (_) {}

            if (legacyClips && legacyClips.length > 0) {
              const migratedList: PulseBackClipMetadata[] = [];
              for (const raw of legacyClips) {
                let fileName = `${raw.id}.wav`;
                if (raw.blob) {
                  try {
                    const buffer = await raw.blob.arrayBuffer();
                    const res = await electron.saveClipFile({
                      preferredName: raw.title || 'Clip',
                      extension: '.wav',
                      buffer,
                    });
                    if (res?.fileName) {
                      fileName = res.fileName;
                    }
                  } catch (e) {
                    console.warn('[PulseBack] Error migrating clip blob to disk:', raw.title, e);
                  }
                }
                migratedList.push({
                  id: String(raw.id),
                  title: String(raw.title || 'Untitled Clip'),
                  duration: Number(raw.duration || 0),
                  fileName,
                  createdAt: Number(raw.createdAt || Date.now()),
                  hasDualTracks: Boolean(raw.hasDualTracks),
                  tags: raw.tags ? Array.from(raw.tags) : [],
                  trimStart: raw.trimStart !== undefined ? Number(raw.trimStart) : undefined,
                  trimEnd: raw.trimEnd !== undefined ? Number(raw.trimEnd) : undefined,
                  currentTime: raw.currentTime !== undefined ? Number(raw.currentTime) : undefined,
                  volume: raw.volume !== undefined ? Number(raw.volume) : undefined,
                  color: raw.color !== undefined ? String(raw.color) : undefined,
                  includeMic: raw.includeMic !== undefined ? Boolean(raw.includeMic) : undefined,
                  includeInput: raw.includeInput !== undefined ? Boolean(raw.includeInput) : undefined,
                });
              }

              if (migratedList.length > 0) {
                const existing = (await electron.readDBSetting('pulse_back_clips')) as PulseBackClipMetadata[] | null;
                const merged = existing && existing.length > 0 ? [...existing, ...migratedList] : migratedList;
                await electron.saveDBSetting('pulse_back_clips', merged);
              }
            }

            // Close and delete legacy IndexedDB database
            try {
              window.indexedDB?.deleteDatabase(DB_NAME);
            } catch (_) {}
            await electron.saveDBSetting('pulse_back_clips_migrated', true);
          } else {
            // Already marked migrated, ensure legacy IndexedDB is cleaned up
            try {
              window.indexedDB?.deleteDatabase(DB_NAME);
            } catch (_) {}
          }
        } catch (err) {
          console.warn('[PulseBack] Legacy IDB migration check error:', err);
        }
      }

      // 2. Load clips from SQLite & disk
      try {
        if (electron?.readDBSetting) {
          const rawClips = (await electron.readDBSetting('pulse_back_clips')) as PulseBackClipMetadata[] | null;
          if (rawClips && Array.isArray(rawClips) && rawClips.length > 0) {
            const loadedClips: PulseBackClip[] = [];
            for (const raw of rawClips) {
              const fileName = raw.fileName || `${raw.id}.wav`;
              const audioUrl = `pulse-media://clips/${encodeURIComponent(fileName).replace(/'/g, '%27')}`;
              let blob: Blob = new Blob([], { type: 'audio/wav' });

              if (electron.readClipFile) {
                try {
                  const buffer = await electron.readClipFile(fileName);
                  if (buffer) {
                    blob = new Blob([buffer], { type: 'audio/wav' });
                  }
                } catch (e) {
                  console.warn(`[PulseBack] Failed to load clip file ${fileName}:`, e);
                }
              }

              loadedClips.push({
                id: raw.id,
                title: raw.title || 'Untitled Clip',
                duration: raw.duration || 0,
                fileName,
                blob,
                audioUrl,
                createdAt: raw.createdAt || Date.now(),
                hasDualTracks: raw.hasDualTracks ?? false,
                tags: raw.tags || [],
                trimStart: raw.trimStart !== undefined ? Number(raw.trimStart) : undefined,
                trimEnd: raw.trimEnd !== undefined ? Number(raw.trimEnd) : undefined,
                currentTime: raw.currentTime !== undefined ? Number(raw.currentTime) : undefined,
                volume: raw.volume !== undefined ? Number(raw.volume) : undefined,
                color: raw.color !== undefined ? String(raw.color) : undefined,
                includeMic: raw.includeMic !== undefined ? Boolean(raw.includeMic) : undefined,
                includeInput: raw.includeInput !== undefined ? Boolean(raw.includeInput) : undefined,
              });
            }

            this.clips = loadedClips.sort((a, b) => b.createdAt - a.createdAt);

            if (this.clips.length > 0 && !this.selectedClipId) {
              const savedSelectedId = localStorage.getItem('pulse_back_selected_clip_id');
              if (savedSelectedId && this.clips.some(c => c.id === savedSelectedId)) {
                this.selectedClipId = savedSelectedId;
              } else {
                this.selectedClipId = this.clips[0].id;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not load Pulse Back clips from SQLite/disk:', err);
      }

      // Check if pulse_back_enabled was saved in database
      if (electron?.readDBSetting) {
        const savedEnabled = await electron.readDBSetting('pulse_back_enabled');
        if (savedEnabled === true) {
          this.isBufferEnabled = true;
          await this.startBuffer();
        }
      }
    },

    async toggleBuffer(): Promise<void> {
      this.isBufferEnabled = !this.isBufferEnabled;

      const electron = window.electron;
      if (electron?.saveDBSetting) {
        await electron.saveDBSetting('pulse_back_enabled', this.isBufferEnabled);
      }

      if (this.isBufferEnabled) {
        await this.startBuffer();
        this.showToast('Pulse Back buffer active');
      } else {
        this.stopBuffer();
        this.showToast('Pulse Back buffer turned off');
      }
    },

    async startBuffer(micDeviceId?: string | null, inputDeviceId?: string | null): Promise<void> {
      const settingsStore = useSettingsStore();
      const micDevice = micDeviceId ?? settingsStore.selectedMicrophoneId;
      const inputDevice = inputDeviceId ?? settingsStore.pulse_back_input_device;
      const effectiveMicVol = settingsStore.microphoneVolume ?? 1;
      const effectiveInputVol = settingsStore.pulse_back_muted ? 0 : (settingsStore.pulse_back_volume ?? 1);
      try {
        await pulseBackBuffer.start(micDevice, inputDevice, 180, effectiveMicVol, effectiveInputVol);
        this.isBufferRunning = true;
      } catch (err) {
        console.error('Failed to start Pulse Back buffer:', err);
        this.isBufferRunning = false;
        this.isBufferEnabled = false;
        this.showToast('Could not access audio device for Pulse Back');
      }
    },

    stopBuffer(): void {
      if (this.isLiveRecording) {
        this.stopLiveCapture();
      }
      pulseBackBuffer.stop();
      this.isBufferRunning = false;
    },

    async triggerQuickClip(seconds?: number, continueRecording: boolean = false): Promise<PulseBackClip | null> {
      if (!this.isBufferRunning) {
        this.showToast('Enable Pulse Back buffer first');
        return null;
      }

      const captureSecs = seconds ?? 30;

      if (continueRecording) {
        pulseBackBuffer.startLivePunchIn(captureSecs);
        this.isLiveRecording = true;
        this.liveRecordRetroStart = captureSecs;
        this.liveRecordSeconds = 0;

        if (liveTimer) clearInterval(liveTimer);
        liveTimer = setInterval(() => {
          this.liveRecordSeconds += 1;
        }, 1000);

        this.showToast(`Pulse Back: Recording live (started at -${captureSecs}s)`);
        return null;
      }

      // Instant capture
      const { blob, duration, hasDualTracks } = await pulseBackBuffer.extractRetroactive(captureSecs);
      if (duration <= 0.1) {
        this.showToast('Not enough audio recorded yet in buffer');
        return null;
      }

      return await this.saveNewClip(blob, duration, `Clip -${Math.round(duration)}s`, hasDualTracks);
    },

    async stopLiveCapture(): Promise<PulseBackClip | null> {
      if (!this.isLiveRecording) return null;

      if (liveTimer) {
        clearInterval(liveTimer);
        liveTimer = null;
      }
      this.isLiveRecording = false;

      const { blob, duration, hasDualTracks } = await pulseBackBuffer.stopLivePunchIn();
      const totalSec = Math.round(duration);
      return await this.saveNewClip(blob, duration, `Clip (${totalSec}s)`, hasDualTracks);
    },

    async saveNewClip(blob: Blob, duration: number, title?: string, hasDualTracks: boolean = false): Promise<PulseBackClip> {
      const settingsStore = useSettingsStore();
      const defaultVolPercent =
        typeof settingsStore.defaultVolume === 'number' && !Number.isNaN(settingsStore.defaultVolume)
          ? Math.round(settingsStore.defaultVolume * 100)
          : 100;

      const id = crypto.randomUUID();
      const now = Date.now();
      const defaultTitle = title || `Pulse Back ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

      let fileName = `${id}.wav`;
      let audioUrl = URL.createObjectURL(blob);

      const electron = window.electron;
      if (electron?.saveClipFile) {
        try {
          const buffer = await blob.arrayBuffer();
          const res = await electron.saveClipFile({
            preferredName: defaultTitle,
            extension: '.wav',
            buffer,
          });
          if (res?.fileName) {
            fileName = res.fileName;
            audioUrl = res.relativeUrl;
          }
        } catch (err) {
          console.warn('[PulseBack] Failed to save clip file to disk:', err);
        }
      }

      const clip: PulseBackClip = {
        id,
        title: defaultTitle,
        duration,
        blob,
        fileName,
        audioUrl,
        createdAt: now,
        hasDualTracks,
        tags: ['clip'],
        trimStart: 0,
        trimEnd: duration,
        currentTime: 0,
        volume: defaultVolPercent,
        color: '#ffffff',
        includeMic: true,
        includeInput: true,
      };

      this.clips.unshift(clip);
      this.selectedClipId = clip.id;
      try {
        localStorage.setItem('pulse_back_selected_clip_id', clip.id);
      } catch { }

      await persistClipsMetadata(this.clips);

      this.showToast(`Saved ${clip.title}!`);
      return clip;
    },

    selectClip(clipId: string): void {
      this.selectedClipId = clipId;
      try {
        localStorage.setItem('pulse_back_selected_clip_id', clipId);
      } catch { }
    },

    async deleteClip(clipId: string): Promise<void> {
      const idx = this.clips.findIndex(c => c.id === clipId);
      if (idx !== -1) {
        const clip = this.clips[idx];
        if (clip.audioUrl && clip.audioUrl.startsWith('blob:')) {
          try { URL.revokeObjectURL(clip.audioUrl); } catch { }
        }
        if (clip.fileName && window.electron?.deleteClipFile) {
          try {
            await window.electron.deleteClipFile(clip.fileName);
          } catch (e) {
            console.warn('[PulseBack] Failed to delete clip file from disk:', e);
          }
        }
        this.clips.splice(idx, 1);

        if (this.selectedClipId === clipId) {
          this.selectedClipId = this.clips[0]?.id ?? null;
          try {
            if (this.selectedClipId) {
              localStorage.setItem('pulse_back_selected_clip_id', this.selectedClipId);
            } else {
              localStorage.removeItem('pulse_back_selected_clip_id');
            }
          } catch { }
        }

        await persistClipsMetadata(this.clips);
      }
    },

    async updateClip(clipId: string, updates: Partial<PulseBackClip>): Promise<void> {
      const clip = this.clips.find(c => c.id === clipId);
      if (!clip) return;

      Object.assign(clip, updates);

      // If updates contain a new blob, re-save to disk
      if (updates.blob && window.electron?.saveClipFile) {
        try {
          const buffer = await updates.blob.arrayBuffer();
          const res = await window.electron.saveClipFile({
            preferredName: clip.title,
            extension: '.wav',
            buffer,
          });
          if (res?.fileName) {
            clip.fileName = res.fileName;
            clip.audioUrl = res.relativeUrl;
          }
        } catch (e) {
          console.warn('[PulseBack] Failed to update clip file on disk:', e);
        }
      }

      await persistClipsMetadata(this.clips);
    },

    async duplicateClip(clipId: string): Promise<PulseBackClip | null> {
      const clip = this.clips.find(c => c.id === clipId);
      if (!clip) return null;

      const newId = crypto.randomUUID();
      const now = Date.now();
      const duplicatedTitle = `${clip.title} (Copy)`;

      let newBlob = clip.blob;
      let newFileName = `${newId}.wav`;
      let newAudioUrl = clip.audioUrl;

      const electron = window.electron;
      if (electron?.saveClipFile) {
        try {
          let buffer: ArrayBuffer | null = null;
          if (clip.blob) {
            buffer = await clip.blob.arrayBuffer();
          } else if (clip.fileName && electron.readClipFile) {
            buffer = await electron.readClipFile(clip.fileName);
          }
          if (buffer) {
            newBlob = new Blob([buffer], { type: 'audio/wav' });
            const res = await electron.saveClipFile({
              preferredName: duplicatedTitle,
              extension: '.wav',
              buffer,
            });
            if (res?.fileName) {
              newFileName = res.fileName;
              newAudioUrl = res.relativeUrl;
            }
          }
        } catch (e) {
          console.warn('[PulseBack] Failed to duplicate clip file on disk:', e);
        }
      }

      const newClip: PulseBackClip = {
        id: newId,
        title: duplicatedTitle,
        duration: clip.duration,
        blob: newBlob,
        fileName: newFileName,
        audioUrl: newAudioUrl,
        createdAt: now,
        hasDualTracks: clip.hasDualTracks ?? false,
        tags: clip.tags ? [...toRaw(clip.tags)] : ['clip'],
        trimStart: clip.trimStart !== undefined ? Number(clip.trimStart) : 0,
        trimEnd: clip.trimEnd !== undefined ? Number(clip.trimEnd) : clip.duration,
        currentTime: clip.currentTime !== undefined ? Number(clip.currentTime) : 0,
        volume: clip.volume !== undefined ? Number(clip.volume) : 100,
        color: clip.color !== undefined ? String(clip.color) : '#3b82f6',
        includeMic: clip.includeMic !== undefined ? Boolean(clip.includeMic) : true,
        includeInput: clip.includeInput !== undefined ? Boolean(clip.includeInput) : true,
      };

      // Insert right after original clip in list
      const idx = this.clips.findIndex(c => c.id === clipId);
      if (idx !== -1) {
        this.clips.splice(idx + 1, 0, newClip);
      } else {
        this.clips.unshift(newClip);
      }

      this.selectedClipId = newClip.id;
      try {
        localStorage.setItem('pulse_back_selected_clip_id', newClip.id);
      } catch { }

      await persistClipsMetadata(this.clips);

      this.showToast(`Duplicated "${clip.title}"`);
      return newClip;
    },

    async publishToSoundboard(
      clipId: string,
      trimmedBlob: Blob,
      trimmedDuration: number,
      soundMetadata: { title: string; tags: string[]; color: string; volume?: number; },
      options: { deleteAfterPublish?: boolean; navigateToSoundboard?: boolean; format?: 'mp3' | 'wav' | 'ogg'; extension?: string; } = {}
    ): Promise<void> {
      const settingsStore = useSettingsStore();
      const clip = this.clips.find(c => c.id === clipId);
      if (!clip) return;

      const ext = options.extension || options.format || 'wav';
      const mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'ogg' ? 'audio/ogg' : 'audio/wav';
      const fileName = `${soundMetadata.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
      const file = new window.File([trimmedBlob], fileName, { type: mimeType });

      const { fileUrl, fileKey } = await settingsStore.saveFile(file);

      const defaultVol =
        typeof settingsStore.defaultVolume === 'number' && !Number.isNaN(settingsStore.defaultVolume)
          ? settingsStore.defaultVolume
          : 1;

      let soundVolume: number | undefined;
      if (typeof soundMetadata.volume === 'number' && !Number.isNaN(soundMetadata.volume)) {
        const normalized = Math.round(soundMetadata.volume) / 100;
        if (normalized !== defaultVol) {
          soundVolume = normalized;
        }
      }

      const activeTags = settingsStore.quickTags.filter(tag => tag.active === true).map(tag => tag.label);
      const combinedTags = Array.from(new Set([...(soundMetadata.tags || []), ...activeTags]));

      const newSound: Sound = {
        id: crypto.randomUUID(),
        title: soundMetadata.title,
        tags: combinedTags,
        color: soundMetadata.color,
        ...(soundVolume !== undefined ? { volume: soundVolume } : {}),
        audioKey: fileKey,
        audioUrl: fileUrl,
        duration: trimmedDuration,
      };

      await settingsStore.insertSounds(settingsStore.sounds.length - 1, newSound);

      if (options.deleteAfterPublish) {
        // Remove from clips draft if requested
        await this.deleteClip(clipId);
      }

      this.showToast(`Added "${newSound.title}" to Soundboard!`);

      if (options.navigateToSoundboard) {
        Router.push('/soundboard');
      }
    },

    showToast(message: string): void {
      this.toastMessage = message;
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }
      this.toastTimeout = setTimeout(() => {
        this.toastMessage = null;
        this.toastTimeout = null;
      }, 3500);
    },
  },
});
