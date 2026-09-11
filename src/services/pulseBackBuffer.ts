import { audioMixer } from './audioMixer'

export function encodeWAV(
  micSamples: Float32Array,
  sampleRate: number,
  inputSamples?: Float32Array | null
): Blob {
  const isStereo = !!(inputSamples && inputSamples.length > 0)
  const numChannels = isStereo ? 2 : 1
  const length = micSamples.length
  const buffer = new ArrayBuffer(44 + length * numChannels * 2)
  const view = new DataView(buffer)

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  /* RIFF identifier */
  writeString(0, 'RIFF')
  /* file length */
  view.setUint32(4, 36 + length * numChannels * 2, true)
  /* RIFF type */
  writeString(8, 'WAVE')
  /* format chunk identifier */
  writeString(12, 'fmt ')
  /* format chunk length */
  view.setUint32(16, 16, true)
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true)
  /* channel count */
  view.setUint16(22, numChannels, true)
  /* sample rate */
  view.setUint32(24, sampleRate, true)
  /* byte rate (sampleRate * numChannels * 2 for 16-bit) */
  view.setUint32(28, sampleRate * numChannels * 2, true)
  /* block align (numChannels * 2 bytes) */
  view.setUint16(32, numChannels * 2, true)
  /* bits per sample (16) */
  view.setUint16(34, 16, true)
  /* data chunk identifier */
  writeString(36, 'data')
  /* data chunk length */
  view.setUint32(40, length * numChannels * 2, true)

  let offset = 44
  if (isStereo && inputSamples) {
    for (let i = 0; i < length; i++) {
      const s0 = Math.max(-1, Math.min(1, micSamples[i]))
      view.setInt16(offset, s0 < 0 ? s0 * 0x8000 : s0 * 0x7fff, true)
      offset += 2

      const s1 = Math.max(-1, Math.min(1, inputSamples[i]))
      view.setInt16(offset, s1 < 0 ? s1 * 0x8000 : s1 * 0x7fff, true)
      offset += 2
    }
  } else {
    for (let i = 0; i < length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, micSamples[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

const WORKLET_CODE = `
class RingBufferProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const maxSec = (options && options.processorOptions && options.processorOptions.maxSeconds) || 180;
    this.capacity = Math.floor(sampleRate * maxSec);
    this.ringMic = new Float32Array(this.capacity);
    this.ringInput = new Float32Array(this.capacity);
    this.writeIndex = 0;
    this.totalWritten = 0;
    this.hasDual = false;
    this.isLiveRecording = false;
    this.liveChunksMic = [];
    this.liveChunksInput = [];
    this.liveTotalSamples = 0;
    this.retroMic = null;
    this.retroInput = null;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'setDualTracks') {
        this.hasDual = !!msg.hasDual;
      } else if (msg.type === 'extract') {
        const micSamples = this.getBufferedSamples(0, msg.seconds);
        const inputSamples = this.hasDual ? this.getBufferedSamples(1, msg.seconds) : null;
        const transfers = [micSamples.buffer];
        if (inputSamples) transfers.push(inputSamples.buffer);
        this.port.postMessage({
          type: 'extracted',
          requestId: msg.requestId,
          micSamples,
          inputSamples,
          hasDualTracks: this.hasDual,
        }, transfers);
      } else if (msg.type === 'startPunchIn') {
        this.retroMic = this.getBufferedSamples(0, msg.seconds);
        this.retroInput = this.hasDual ? this.getBufferedSamples(1, msg.seconds) : null;
        this.liveChunksMic = [];
        this.liveChunksInput = [];
        this.liveTotalSamples = 0;
        this.isLiveRecording = true;
      } else if (msg.type === 'stopPunchIn') {
        this.isLiveRecording = false;
        const retroLen = this.retroMic ? this.retroMic.length : 0;
        const total = retroLen + this.liveTotalSamples;
        const combinedMic = new Float32Array(total);
        const combinedInput = this.hasDual ? new Float32Array(total) : null;
        let off = 0;
        if (this.retroMic) {
          combinedMic.set(this.retroMic, 0);
          if (combinedInput && this.retroInput) {
            combinedInput.set(this.retroInput, 0);
          }
          off = this.retroMic.length;
          this.retroMic = null;
          this.retroInput = null;
        }
        for (let i = 0; i < this.liveChunksMic.length; i++) {
          const cM = this.liveChunksMic[i];
          combinedMic.set(cM, off);
          if (combinedInput && this.liveChunksInput[i]) {
            combinedInput.set(this.liveChunksInput[i], off);
          }
          off += cM.length;
        }
        this.liveChunksMic = [];
        this.liveChunksInput = [];
        this.liveTotalSamples = 0;
        const transfers = [combinedMic.buffer];
        if (combinedInput) transfers.push(combinedInput.buffer);
        this.port.postMessage({
          type: 'punchInStopped',
          requestId: msg.requestId,
          micSamples: combinedMic,
          inputSamples: combinedInput,
          hasDualTracks: this.hasDual,
        }, transfers);
      }
    };
  }

  getBufferedSamples(channelIdx, seconds) {
    const available = Math.min(this.totalWritten, this.capacity);
    const requested = Math.floor(seconds * sampleRate);
    const count = Math.min(available, requested);
    if (count <= 0) return new Float32Array(0);

    const result = new Float32Array(count);
    const ring = channelIdx === 0 ? this.ringMic : this.ringInput;
    const start = (this.writeIndex - count + this.capacity) % this.capacity;

    if (start + count <= this.capacity) {
      result.set(ring.subarray(start, start + count));
    } else {
      const firstPart = this.capacity - start;
      result.set(ring.subarray(start, this.capacity), 0);
      result.set(ring.subarray(0, count - firstPart), firstPart);
    }
    return result;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const ch0 = input[0];
      const ch1 = input[1] || null;
      const len = ch0.length;

      if (this.writeIndex + len <= this.capacity) {
        this.ringMic.set(ch0, this.writeIndex);
        if (ch1) {
          this.ringInput.set(ch1, this.writeIndex);
        }
        this.writeIndex += len;
        if (this.writeIndex >= this.capacity) this.writeIndex = 0;
      } else {
        const firstPart = this.capacity - this.writeIndex;
        this.ringMic.set(ch0.subarray(0, firstPart), this.writeIndex);
        this.ringMic.set(ch0.subarray(firstPart, len), 0);
        if (ch1) {
          this.ringInput.set(ch1.subarray(0, firstPart), this.writeIndex);
          this.ringInput.set(ch1.subarray(firstPart, len), 0);
        }
        this.writeIndex = len - firstPart;
      }
      this.totalWritten += len;

      if (this.isLiveRecording) {
        const copy0 = new Float32Array(len);
        copy0.set(ch0);
        this.liveChunksMic.push(copy0);
        if (ch1) {
          const copy1 = new Float32Array(len);
          copy1.set(ch1);
          this.liveChunksInput.push(copy1);
        }
        this.liveTotalSamples += len;
      }
    }
    return true;
  }
}

registerProcessor('pulse-back-worklet', RingBufferProcessor);
`

interface WorkletResponse {
  micSamples: Float32Array
  inputSamples: Float32Array | null
  hasDualTracks: boolean
}

class PulseBackBuffer {
  private audioCtx: AudioContext | null = null
  private micStream: MediaStream | null = null
  private inputStream: MediaStream | null = null

  private micSourceNode: MediaStreamAudioSourceNode | null = null
  private inputSourceNode: MediaStreamAudioSourceNode | null = null

  private micGainNode: GainNode | null = null
  private inputGainNode: GainNode | null = null
  private mergerNode: ChannelMergerNode | null = null

  private micAnalyserNode: AnalyserNode | null = null
  private inputAnalyserNode: AnalyserNode | null = null

  private workletNode: AudioWorkletNode | null = null
  private zeroGain: GainNode | null = null
  private testGainNode: GainNode | null = null

  private sampleRate: number = 44100
  private isRunning: boolean = false
  private currentMicDeviceId: string | null = null
  private currentInputDeviceId: string | null = null
  private maxSeconds: number = 180

  private currentMicVolume: number = 1
  private currentInputVolume: number = 1
  private smoothedMicLevel: number = 0
  private smoothedInputLevel: number = 0
  private isTestingInput: boolean = false
  private isDualTracksActive: boolean = false

  private isPunchInActive: boolean = false
  private pendingRequests: Map<string, (res: WorkletResponse) => void> = new Map()

  public get active(): boolean {
    return this.isRunning
  }

  public get isLiveRecording(): boolean {
    return this.isPunchInActive
  }

  public get isTesting(): boolean {
    return this.isTestingInput
  }

  public get hasDualTracks(): boolean {
    return this.isDualTracksActive
  }

  private async openStream(deviceId: string | null): Promise<MediaStream> {
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }
    if (deviceId && deviceId !== 'default') {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: { ...audioConstraints, deviceId: { exact: deviceId } },
        })
      } catch {
        return await navigator.mediaDevices.getUserMedia({
          audio: { ...audioConstraints, deviceId: { ideal: deviceId } },
        })
      }
    }
    return await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
  }

  public async start(
    micDeviceId: string | null = null,
    inputDeviceId: string | null = null,
    maxBufferSeconds: number = 180,
    micVolume: number = 1,
    inputVolume: number = 1
  ): Promise<void> {
    this.currentMicVolume = Math.max(0, Math.min(2, micVolume))
    this.currentInputVolume = Math.max(0, Math.min(2, inputVolume))

    // Check if we can keep current streams running and just update volumes
    if (
      this.isRunning &&
      this.currentMicDeviceId === micDeviceId &&
      this.currentInputDeviceId === inputDeviceId &&
      this.maxSeconds === maxBufferSeconds
    ) {
      this.setMicVolume(this.currentMicVolume)
      this.setInputVolume(this.currentInputVolume)
      return
    }

    this.stop()

    this.currentMicDeviceId = micDeviceId
    this.currentInputDeviceId = inputDeviceId
    this.maxSeconds = Math.max(15, Math.min(300, maxBufferSeconds))

    // 1. Open primary microphone stream
    // Check if audioMixer already has an active, live stream for this microphone to avoid multiple conflicting getUserMedia calls
    const mixerStream = audioMixer.getMicrophoneStream()
    const mixerMicId = audioMixer.getCurrentMicId()
    if (
      mixerStream &&
      (!micDeviceId || micDeviceId === mixerMicId) &&
      mixerStream.getAudioTracks().some(t => t.readyState === 'live')
    ) {
      this.micStream = mixerStream.clone()
    } else {
      this.micStream = await this.openStream(micDeviceId)
    }

    // Ensure all audio tracks are active
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach(track => {
        track.enabled = true
      })
    }

    // 2. If separate input device specified, open secondary stream
    const isDistinctInput = !!(inputDeviceId && inputDeviceId !== micDeviceId)
    if (isDistinctInput) {
      try {
        this.inputStream = await this.openStream(inputDeviceId)
        this.isDualTracksActive = true
      } catch (err) {
        console.warn('[PulseBackBuffer] Could not open secondary input stream:', err)
        this.inputStream = null
        this.isDualTracksActive = false
      }
    } else {
      this.inputStream = null
      this.isDualTracksActive = false
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    this.audioCtx = new AudioContextClass()
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume().catch(() => {})
    }

    this.sampleRate = this.audioCtx.sampleRate || 44100

    // Load AudioWorklet module
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
    const workletUrl = URL.createObjectURL(blob)
    try {
      await this.audioCtx.audioWorklet.addModule(workletUrl)
    } finally {
      URL.revokeObjectURL(workletUrl)
    }

    // Worklet node
    this.workletNode = new AudioWorkletNode(this.audioCtx, 'pulse-back-worklet', {
      processorOptions: { maxSeconds: this.maxSeconds },
    })

    this.workletNode.port.onmessage = (event: MessageEvent) => {
      const { requestId, micSamples, inputSamples, hasDualTracks } = event.data
      if (requestId && this.pendingRequests.has(requestId)) {
        const resolve = this.pendingRequests.get(requestId)!
        this.pendingRequests.delete(requestId)
        resolve({ micSamples, inputSamples, hasDualTracks })
      }
    }

    this.workletNode.port.postMessage({
      type: 'setDualTracks',
      hasDual: this.isDualTracksActive,
    })

    // Mic source and gain
    this.micSourceNode = this.audioCtx.createMediaStreamSource(this.micStream)
    this.micGainNode = this.audioCtx.createGain()
    this.micGainNode.gain.value = this.currentMicVolume

    // Mic Analyser for live VU meter
    this.micAnalyserNode = this.audioCtx.createAnalyser()
    this.micAnalyserNode.fftSize = 256
    this.micAnalyserNode.smoothingTimeConstant = 0.3

    this.micSourceNode.connect(this.micGainNode)
    this.micGainNode.connect(this.micAnalyserNode)

    // Channel merger (Channel 0 = Mic, Channel 1 = Input Device)
    this.mergerNode = this.audioCtx.createChannelMerger(2)
    this.micGainNode.connect(this.mergerNode, 0, 0)

    if (this.isDualTracksActive && this.inputStream) {
      this.inputSourceNode = this.audioCtx.createMediaStreamSource(this.inputStream)
      this.inputGainNode = this.audioCtx.createGain()
      this.inputGainNode.gain.value = this.currentInputVolume

      this.inputAnalyserNode = this.audioCtx.createAnalyser()
      this.inputAnalyserNode.fftSize = 256
      this.inputAnalyserNode.smoothingTimeConstant = 0.3

      this.inputSourceNode.connect(this.inputGainNode)
      this.inputGainNode.connect(this.inputAnalyserNode)
      this.inputGainNode.connect(this.mergerNode, 0, 1)
    } else {
      // Single track fallback: mirror to channel 1 or keep mono
      this.micGainNode.connect(this.mergerNode, 0, 1)
      this.inputGainNode = null
      this.inputAnalyserNode = null
    }

    this.mergerNode.connect(this.workletNode)

    // Zero-gain to keep audio worklet clock ticking without sounding through speakers
    this.zeroGain = this.audioCtx.createGain()
    this.zeroGain.gain.value = 0
    this.workletNode.connect(this.zeroGain)
    this.zeroGain.connect(this.audioCtx.destination)

    this.isRunning = true
  }

  public stop(): void {
    this.isRunning = false
    this.isPunchInActive = false
    this.isTestingInput = false
    this.isDualTracksActive = false
    this.pendingRequests.clear()

    if (this.micSourceNode) {
      try { this.micSourceNode.disconnect() } catch {}
      this.micSourceNode = null
    }
    if (this.inputSourceNode) {
      try { this.inputSourceNode.disconnect() } catch {}
      this.inputSourceNode = null
    }
    if (this.micGainNode) {
      try { this.micGainNode.disconnect() } catch {}
      this.micGainNode = null
    }
    if (this.inputGainNode) {
      try { this.inputGainNode.disconnect() } catch {}
      this.inputGainNode = null
    }
    if (this.mergerNode) {
      try { this.mergerNode.disconnect() } catch {}
      this.mergerNode = null
    }
    if (this.micAnalyserNode) {
      try { this.micAnalyserNode.disconnect() } catch {}
      this.micAnalyserNode = null
    }
    if (this.inputAnalyserNode) {
      try { this.inputAnalyserNode.disconnect() } catch {}
      this.inputAnalyserNode = null
    }
    if (this.testGainNode) {
      try { this.testGainNode.disconnect() } catch {}
      this.testGainNode = null
    }
    if (this.workletNode) {
      try {
        this.workletNode.port.onmessage = null
        this.workletNode.disconnect()
      } catch {}
      this.workletNode = null
    }
    if (this.zeroGain) {
      try { this.zeroGain.disconnect() } catch {}
      this.zeroGain = null
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop())
      this.micStream = null
    }
    if (this.inputStream) {
      this.inputStream.getTracks().forEach(t => t.stop())
      this.inputStream = null
    }
    if (this.audioCtx) {
      try { this.audioCtx.close().catch(() => {}) } catch {}
      this.audioCtx = null
    }
  }

  public setMicVolume(volume: number): void {
    this.currentMicVolume = Math.max(0, Math.min(2, volume))
    if (this.micGainNode && this.audioCtx) {
      this.micGainNode.gain.value = this.currentMicVolume
    }
  }

  public setInputVolume(volume: number): void {
    this.currentInputVolume = Math.max(0, Math.min(2, volume))
    if (this.inputGainNode && this.audioCtx) {
      this.inputGainNode.gain.value = this.currentInputVolume
    }
    if (this.testGainNode && this.audioCtx) {
      this.testGainNode.gain.value = this.currentInputVolume
    }
  }

  public setVolume(volume: number): void {
    this.setInputVolume(volume)
  }

  public async setInputTest(enabled: boolean, targetDeviceId?: string | null): Promise<void> {
    this.isTestingInput = enabled
    if (!this.audioCtx) return

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume().catch(() => {})
    }

    if (enabled && typeof (this.audioCtx as any).setSinkId === 'function') {
      try {
        if (targetDeviceId && targetDeviceId !== 'default') {
          await (this.audioCtx as any).setSinkId(targetDeviceId)
        } else {
          await (this.audioCtx as any).setSinkId('')
        }
      } catch (err) {
        console.warn('[PulseBackBuffer] Could not set sinkId for input test:', err)
      }
    }

    const testSource = this.inputGainNode || this.micGainNode
    if (enabled && testSource) {
      if (!this.testGainNode) {
        this.testGainNode = this.audioCtx.createGain()
        this.testGainNode.connect(this.audioCtx.destination)
      }
      this.testGainNode.gain.value = this.currentInputVolume
      try { testSource.connect(this.testGainNode) } catch {}
    } else if (this.testGainNode) {
      if (testSource) {
        try { testSource.disconnect(this.testGainNode) } catch {}
      }
      try { this.testGainNode.disconnect() } catch {}
      this.testGainNode = null
    }
  }

  private calculateRmsLevel(analyser: AnalyserNode | null, previousSmoothed: number): number {
    if (!analyser || !this.isRunning) return 0
    const dataArray = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(dataArray)

    let sumSquares = 0
    for (let i = 0; i < dataArray.length; i++) {
      sumSquares += dataArray[i] * dataArray[i]
    }
    const rms = Math.sqrt(sumSquares / dataArray.length)

    if (rms < 0.0001) {
      return Math.max(0, previousSmoothed * 0.85)
    }

    const db = 20 * Math.log10(rms)
    const minDb = -48
    const maxDb = 0
    let target = (db - minDb) / (maxDb - minDb)
    target = Math.max(0, Math.min(1, target))

    if (target > previousSmoothed) {
      return target
    }
    return Math.max(0, previousSmoothed * 0.88)
  }

  public getInputLevel(): number {
    const analyser = this.inputAnalyserNode || this.micAnalyserNode
    this.smoothedInputLevel = this.calculateRmsLevel(analyser, this.smoothedInputLevel)
    return this.smoothedInputLevel
  }

  public getMicLevel(): number {
    this.smoothedMicLevel = this.calculateRmsLevel(this.micAnalyserNode, this.smoothedMicLevel)
    return this.smoothedMicLevel
  }

  public extractRetroactive(seconds: number): Promise<{ blob: Blob; duration: number; hasDualTracks: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.workletNode || !this.isRunning) {
        return reject(new Error('Pulse Back buffer is not active'))
      }

      const requestId = `extract_${Date.now()}_${Math.random()}`
      this.pendingRequests.set(requestId, ({ micSamples, inputSamples, hasDualTracks }) => {
        const duration = micSamples.length / this.sampleRate
        const blob = encodeWAV(micSamples, this.sampleRate, inputSamples)
        resolve({ blob, duration, hasDualTracks })
      })

      this.workletNode.port.postMessage({ type: 'extract', seconds, requestId })
    })
  }

  public startLivePunchIn(retroactiveSeconds: number): void {
    if (!this.workletNode || !this.isRunning) return
    this.isPunchInActive = true
    this.workletNode.port.postMessage({ type: 'startPunchIn', seconds: retroactiveSeconds })
  }

  public stopLivePunchIn(): Promise<{ blob: Blob; duration: number; hasDualTracks: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.workletNode || !this.isRunning) {
        this.isPunchInActive = false
        return reject(new Error('Pulse Back buffer is not active'))
      }

      this.isPunchInActive = false
      const requestId = `punchIn_${Date.now()}_${Math.random()}`
      this.pendingRequests.set(requestId, ({ micSamples, inputSamples, hasDualTracks }) => {
        const duration = micSamples.length / this.sampleRate
        const blob = encodeWAV(micSamples, this.sampleRate, inputSamples)
        resolve({ blob, duration, hasDualTracks })
      })

      this.workletNode.port.postMessage({ type: 'stopPunchIn', requestId })
    })
  }
}

export const pulseBackBuffer = new PulseBackBuffer()
