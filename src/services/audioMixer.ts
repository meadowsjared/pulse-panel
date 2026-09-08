import type { SoundSegment } from '../@types/sound'

class AudioMixer {
  // Input context exclusively for live metering/analysis.
  // NEVER connected to any destination or speakers.
  private inputCtx: AudioContext | null = null
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private micAnalyser: AnalyserNode | null = null

  // Dedicated Cable output pipeline: strictly routed to cableDeviceId via AudioContext.setSinkId.
  // NEVER touches the default playback device.
  private cableCtx: AudioContext | null = null
  private cableMicSource: MediaStreamAudioSourceNode | null = null
  private cableMicGain: GainNode | null = null
  private cableSoundGain: GainNode | null = null

  private micTestGain: GainNode | null = null
  private isTestingMic: boolean = false

  private currentMicId: string | null = null
  private currentCableId: string | null = null
  private micVolume: number = 1
  private micMuted: boolean = false
  private soundboardVolume: number = 1
  private smoothedLevel: number = 0

  private activeSounds: Map<
    string,
    { audio: HTMLAudioElement; source: MediaElementAudioSourceNode; individualGain: GainNode; cleanup: () => void }
  > = new Map()

  private getInputContext(): AudioContext {
    if (!this.inputCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      this.inputCtx = new AudioContextClass()
    }
    if (this.inputCtx.state === 'suspended') {
      this.inputCtx.resume().catch(() => {})
    }
    return this.inputCtx
  }

  public async resume(): Promise<void> {
    if (this.inputCtx && this.inputCtx.state === 'suspended') {
      await this.inputCtx.resume().catch(() => {})
    }
    if (this.cableCtx && this.cableCtx.state === 'suspended') {
      await this.cableCtx.resume().catch(() => {})
    }
  }

  public async setup(
    micDeviceId: string | null,
    micVolume: number,
    micMuted: boolean,
    cableDeviceId: string | null,
    soundboardVolume: number = 1
  ): Promise<void> {
    this.micVolume = micVolume
    this.micMuted = micMuted
    this.soundboardVolume = soundboardVolume

    const resumeListener = () => {
      this.resume().catch(() => {})
      window.removeEventListener('click', resumeListener)
      window.removeEventListener('keydown', resumeListener)
    }
    window.addEventListener('click', resumeListener, { once: true })
    window.addEventListener('keydown', resumeListener, { once: true })

    if (micDeviceId !== this.currentMicId || !this.micStream) {
      await this.setMicrophone(micDeviceId)
    }

    await this.setCableOutput(cableDeviceId)

    this.setMicrophoneMuted(this.micMuted)
    this.setMicrophoneVolume(this.micVolume)
    this.setSoundboardVolume(this.soundboardVolume)
  }

  public async setMicrophone(deviceId: string | null): Promise<void> {
    this.currentMicId = deviceId

    // Stop existing mic stream and nodes
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop())
      this.micStream = null
    }
    if (this.micSource) {
      try { this.micSource.disconnect() } catch {}
      this.micSource = null
    }
    if (this.cableMicSource) {
      try { this.cableMicSource.disconnect() } catch {}
      this.cableMicSource = null
    }

    if (!deviceId) return

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { ideal: deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })
      }
      this.micStream = stream

      // Set up analyser in input context.
      // Notice: micSource is ONLY connected to micAnalyser and NEVER to inputCtx.destination.
      const inCtx = this.getInputContext()
      if (inCtx.state === 'suspended') {
        inCtx.resume().catch(() => {})
      }
      this.micSource = inCtx.createMediaStreamSource(stream)

      if (!this.micAnalyser) {
        this.micAnalyser = inCtx.createAnalyser()
        this.micAnalyser.fftSize = 256
        this.micAnalyser.smoothingTimeConstant = 0.3
      }
      this.micSource.connect(this.micAnalyser)

      if (this.isTestingMic && this.micTestGain) {
        try {
          this.micSource.connect(this.micTestGain)
        } catch {}
      }

      // Connect mic to virtual cable output context if it exists
      this.attachMicToCableContext()
    } catch (err) {
      console.error('Error opening microphone in audio mixer:', err)
    }
  }

  public setMicrophoneVolume(volume: number): void {
    this.micVolume = volume
    this.updateMicTestGain()
    if (this.cableMicGain) {
      const effectiveGain = this.micMuted ? 0 : volume
      this.cableMicGain.gain.value = effectiveGain
      if (this.cableCtx) {
        try {
          this.cableMicGain.gain.cancelScheduledValues(this.cableCtx.currentTime)
          this.cableMicGain.gain.setValueAtTime(effectiveGain, this.cableCtx.currentTime)
        } catch {}
      }
    }
  }

  public setMicrophoneMuted(muted: boolean): void {
    this.micMuted = muted
    this.updateMicTestGain()
    if (this.cableMicGain) {
      const effectiveGain = muted ? 0 : this.micVolume
      this.cableMicGain.gain.value = effectiveGain
      if (this.cableCtx) {
        try {
          this.cableMicGain.gain.cancelScheduledValues(this.cableCtx.currentTime)
          this.cableMicGain.gain.setValueAtTime(effectiveGain, this.cableCtx.currentTime)
        } catch {}
      }
    }
  }

  public setSoundboardVolume(volume: number): void {
    this.soundboardVolume = volume
    if (this.cableSoundGain) {
      this.cableSoundGain.gain.value = volume
      if (this.cableCtx) {
        try {
          this.cableSoundGain.gain.cancelScheduledValues(this.cableCtx.currentTime)
          this.cableSoundGain.gain.setValueAtTime(volume, this.cableCtx.currentTime)
        } catch {}
      }
    }
  }

  public getSoundboardVolume(): number {
    return this.soundboardVolume
  }

  public async setCableOutput(cableDeviceId: string | null): Promise<void> {
    // If device hasn't changed and pipeline is active and valid, keep existing pipeline
    if (
      cableDeviceId &&
      cableDeviceId === this.currentCableId &&
      this.cableCtx &&
      (this.cableCtx as any).sinkId === cableDeviceId &&
      this.cableCtx.state !== 'closed'
    ) {
      this.attachMicToCableContext()
      this.setMicrophoneMuted(this.micMuted)
      this.setMicrophoneVolume(this.micVolume)
      this.setSoundboardVolume(this.soundboardVolume)
      return
    }

    this.currentCableId = cableDeviceId

    // Tear down any previous cable context
    this.cleanupCableContext()

    // If no valid virtual cable device ID is specified, NEVER create a context!
    // This strictly ensures zero audio can ever reach the default audio device.
    if (!cableDeviceId || cableDeviceId === 'default') {
      console.log('[AudioMixer] Virtual cable device is not selected or available.')
      return
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioContextClass()

      // Explicitly set the output sinkId to CABLE Input
      if (typeof (ctx as any).setSinkId === 'function') {
        await (ctx as any).setSinkId(cableDeviceId)
      } else {
        console.error('[AudioMixer] AudioContext.setSinkId is not supported in this runtime')
        ctx.close().catch(() => {})
        return
      }

      // CRITICAL SAFETY CHECK: Ensure sinkId was strictly applied to cableDeviceId!
      // If sinkId does not match, NEVER connect the microphone to avoid any headphone echo!
      if ((ctx as any).sinkId !== cableDeviceId) {
        console.error('[AudioMixer] SAFETY CHECK FAILED: AudioContext sinkId does not match cableDeviceId!', {
          actualSinkId: (ctx as any).sinkId,
          expectedCableDeviceId: cableDeviceId,
        })
        ctx.close().catch(() => {})
        return
      }

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }

      this.cableCtx = ctx

      // Soundboard gain node -> destination (CABLE Input)
      this.cableSoundGain = ctx.createGain()
      this.cableSoundGain.gain.value = this.soundboardVolume
      this.cableSoundGain.connect(ctx.destination)

      // Microphone gain node -> destination (CABLE Input)
      this.cableMicGain = ctx.createGain()
      this.cableMicGain.gain.value = this.micMuted ? 0 : this.micVolume
      this.cableMicGain.connect(ctx.destination)

      this.attachMicToCableContext()
      console.log('[AudioMixer] Cable context initialized and strictly bound to sinkId:', cableDeviceId)
    } catch (err) {
      console.error('[AudioMixer] Failed to initialize virtual cable context:', err)
      this.cleanupCableContext()
    }
  }

  private attachMicToCableContext(): void {
    if (!this.cableCtx || !this.micStream || !this.cableMicGain) return

    // Double check sinkId safety before attaching mic
    if ((this.cableCtx as any).sinkId !== this.currentCableId) {
      console.warn('[AudioMixer] Safety check prevented mic attachment: sinkId mismatch')
      return
    }

    try {
      if (this.cableMicSource) {
        try { this.cableMicSource.disconnect() } catch {}
        this.cableMicSource = null
      }
      this.cableMicSource = this.cableCtx.createMediaStreamSource(this.micStream)
      this.cableMicSource.connect(this.cableMicGain)
      console.log('[AudioMixer] Microphone attached to CABLE Input AudioContext')
    } catch (err) {
      console.error('[AudioMixer] Error attaching mic to cable context:', err)
    }
  }

  private cleanupCableContext(): void {
    this.stopAllSounds()
    if (this.cableMicSource) {
      try { this.cableMicSource.disconnect() } catch {}
      this.cableMicSource = null
    }
    if (this.cableMicGain) {
      try { this.cableMicGain.disconnect() } catch {}
      this.cableMicGain = null
    }
    if (this.cableSoundGain) {
      try { this.cableSoundGain.disconnect() } catch {}
      this.cableSoundGain = null
    }
    if (this.cableCtx) {
      this.cableCtx.close().catch(() => {})
      this.cableCtx = null
    }
  }

  public getCurrentCableId(): string | null {
    return this.currentCableId
  }

  public getCurrentMicId(): string | null {
    return this.currentMicId
  }

  public async setMicTest(enabled: boolean, targetDeviceId?: string | null): Promise<void> {
    this.isTestingMic = enabled
    const inCtx = this.getInputContext()
    if (inCtx.state === 'suspended') {
      await inCtx.resume().catch(() => {})
    }

    if (enabled && typeof (inCtx as any).setSinkId === 'function') {
      try {
        if (targetDeviceId && targetDeviceId !== 'default') {
          await (inCtx as any).setSinkId(targetDeviceId)
        } else {
          await (inCtx as any).setSinkId('')
        }
      } catch (err) {
        console.warn('[AudioMixer] Could not set sinkId on inputCtx for mic test:', err)
      }
    }

    if (enabled) {
      if (!this.micTestGain) {
        this.micTestGain = inCtx.createGain()
        this.micTestGain.connect(inCtx.destination)
      }
      this.updateMicTestGain()
      if (this.micSource) {
        try {
          this.micSource.connect(this.micTestGain)
        } catch {}
      }
    } else {
      if (this.micTestGain) {
        try {
          this.micTestGain.disconnect()
        } catch {}
        this.micTestGain = null
      }
    }
  }

  public getIsTestingMic(): boolean {
    return this.isTestingMic
  }

  private updateMicTestGain(): void {
    if (this.micTestGain && this.inputCtx) {
      const effectiveGain = this.micMuted ? 0 : this.micVolume
      this.micTestGain.gain.value = effectiveGain
      try {
        this.micTestGain.gain.cancelScheduledValues(this.inputCtx.currentTime)
        this.micTestGain.gain.setValueAtTime(effectiveGain, this.inputCtx.currentTime)
      } catch {}
    }
  }

  public getMicLevel(): number {
    if (!this.micAnalyser) {
      this.smoothedLevel = 0
      return 0
    }
    if (this.inputCtx && this.inputCtx.state === 'suspended') {
      this.inputCtx.resume().catch(() => {})
    }
    const dataArray = new Float32Array(this.micAnalyser.fftSize)
    this.micAnalyser.getFloatTimeDomainData(dataArray)

    let sumSquares = 0
    for (let i = 0; i < dataArray.length; i++) {
      sumSquares += dataArray[i] * dataArray[i]
    }
    const rms = Math.sqrt(sumSquares / dataArray.length) * this.micVolume

    if (rms < 0.0001) {
      this.smoothedLevel = Math.max(0, this.smoothedLevel * 0.85)
      return this.smoothedLevel
    }

    // Decibel scale: -48 dB (noise floor) to 0 dB (peak)
    const db = 20 * Math.log10(rms)
    const minDb = -48
    const maxDb = 0
    let target = (db - minDb) / (maxDb - minDb)
    target = Math.max(0, Math.min(1, target))

    // Fast attack (instant responsiveness), smooth decay
    if (target > this.smoothedLevel) {
      this.smoothedLevel = target
    } else {
      this.smoothedLevel = Math.max(0, this.smoothedLevel * 0.88)
    }

    return this.smoothedLevel
  }

  public playSoundToMixer(
    audioUrl: string,
    volume: number,
    segment?: SoundSegment,
    id?: string
  ): Promise<void> {
    if (!this.cableCtx || !this.cableSoundGain) return Promise.resolve()
    const ctx = this.cableCtx

    return new Promise(resolve => {
      const audio = new Audio(audioUrl)
      const source = ctx.createMediaElementSource(audio)
      const individualGain = ctx.createGain()
      individualGain.gain.value = volume

      source.connect(individualGain)
      individualGain.connect(this.cableSoundGain!)

      const soundKey = id ?? `${audioUrl}_${Date.now()}`

      let startTime = 0
      let duration: number | undefined = undefined

      if (segment) {
        startTime = segment.start
        if (segment.end > segment.start) {
          duration = segment.end - segment.start
        }
      }

      const cleanup = () => {
        audio.pause()
        try {
          source.disconnect()
          individualGain.disconnect()
        } catch {}
        this.activeSounds.delete(soundKey)
        resolve()
      }

      this.activeSounds.set(soundKey, { audio, source, individualGain, cleanup })

      audio.currentTime = startTime

      let timeoutId: ReturnType<typeof setTimeout> | null = null
      if (duration && duration > 0) {
        timeoutId = setTimeout(() => {
          cleanup()
        }, duration * 1000)
      }

      audio.onended = () => {
        if (timeoutId) clearTimeout(timeoutId)
        cleanup()
      }

      audio.onerror = () => {
        if (timeoutId) clearTimeout(timeoutId)
        cleanup()
      }

      audio.play().catch(err => {
        console.warn('Audio mixer play failed:', err)
        if (timeoutId) clearTimeout(timeoutId)
        cleanup()
      })
    })
  }

  public stopSound(id: string): void {
    const active = this.activeSounds.get(id)
    if (active) {
      active.cleanup()
    }
  }

  public stopAllSounds(): void {
    this.activeSounds.forEach(active => {
      active.cleanup()
    })
    this.activeSounds.clear()
  }
}

export const audioMixer = new AudioMixer()
