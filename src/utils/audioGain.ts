/**
 * Audio Gain and Normalization Utilities for Pulse Panel
 */

export interface AudioGainRegion {
  id?: string;
  startSec: number;
  endSec: number;
  channel?: number; // 0 = mic/left, 1 = input/right, or undefined for all channels
  multiplier: number;
}

/**
 * Calculates the absolute peak amplitude (0.0 to 1.0+) of an audio channel,
 * optionally within a sample range [startSample, endSample].
 */
export function calculateChannelPeak(
  channelData: Float32Array,
  startSample: number = 0,
  endSample?: number
): number {
  let peak = 0;
  const start = Math.max(0, startSample);
  const end = endSample !== undefined ? Math.min(channelData.length, endSample) : channelData.length;
  const len = Math.max(0, end - start);
  // Step through with high precision, subsampling if array is enormous (> 2M samples)
  const step = len > 2000000 ? Math.ceil(len / 1000000) : 1;
  for (let i = start; i < end; i += step) {
    const abs = Math.abs(channelData[i]);
    if (abs > peak) {
      peak = abs;
      if (peak >= 1.0) {
        peak = 1.0;
        break;
      }
    }
  }
  return peak;
}

/**
 * Calculates the optimal multiplier to bring audio peak to a target level
 * (default -0.5 dBFS ≈ 0.944, preventing digital clipping).
 * Optionally targets a specific sample range [startSample, endSample].
 */
export function calculateAutoGainMultiplier(
  channelData: Float32Array,
  targetPeak: number = 0.944,
  maxBoost?: number,
  startSample: number = 0,
  endSample?: number
): number {
  const peak = calculateChannelPeak(channelData, startSample, endSample);
  if (peak <= 0.0001) return 1.0; // Avoid division by near-zero silence
  const multiplier = targetPeak / peak;
  const clamped = maxBoost != null ? Math.max(0.01, Math.min(maxBoost, multiplier)) : Math.max(0.01, multiplier);
  // Round to 2 decimal places for clean UI numbers (e.g. 1.85)
  return Math.round(clamped * 100) / 100;
}

/**
 * Creates a new AudioBuffer with channel-specific gain multipliers applied.
 * Optionally supports a list of AudioGainRegion partial gains with smooth 5ms
 * boundary crossfades to prevent clicks or popping.
 * Clamps output samples to [-1.0, 1.0] to prevent clipping wrapping artifacts.
 */
export function applyGainToAudioBuffer(
  ctx: AudioContext,
  sourceBuffer: AudioBuffer,
  channelMultipliers: number[] | number,
  regions?: AudioGainRegion[]
): AudioBuffer {
  const numChannels = sourceBuffer.numberOfChannels;
  const length = sourceBuffer.length;
  const sampleRate = sourceBuffer.sampleRate;
  const newBuf = ctx.createBuffer(numChannels, length, sampleRate);

  const hasRegions = Array.isArray(regions) && regions.length > 0;

  for (let ch = 0; ch < numChannels; ch++) {
    const globalMult = Array.isArray(channelMultipliers)
      ? (channelMultipliers[ch] ?? 1.0)
      : channelMultipliers;

    const src = sourceBuffer.getChannelData(ch);
    const dst = newBuf.getChannelData(ch);

    const chRegions = hasRegions
      ? regions!.filter(r => r.channel === undefined || r.channel === ch)
      : [];

    if (chRegions.length === 0) {
      if (Math.abs(globalMult - 1.0) < 0.001) {
        dst.set(src);
      } else {
        for (let i = 0; i < length; i++) {
          const val = src[i] * globalMult;
          dst[i] = val > 1.0 ? 1.0 : (val < -1.0 ? -1.0 : val);
        }
      }
    } else {
      // Build multiplier envelope per sample starting with globalMult
      const envelope = new Float32Array(length);
      envelope.fill(globalMult);

      for (const reg of chRegions) {
        const startSample = Math.max(0, Math.floor(reg.startSec * sampleRate));
        const endSample = Math.min(length, Math.floor(reg.endSec * sampleRate));
        const regionLen = endSample - startSample;
        if (regionLen <= 0) continue;

        // 5ms smooth crossfade ramp to avoid audible clicks at region boundaries
        const fadeLen = Math.min(Math.floor(sampleRate * 0.005), Math.floor(regionLen / 4));
        const targetMult = reg.multiplier;

        // Start fade ramp
        for (let i = 0; i < fadeLen; i++) {
          const idx = startSample + i;
          const prevMult = envelope[idx];
          const t = i / fadeLen;
          envelope[idx] = prevMult + (targetMult - prevMult) * t;
        }

        // Full target gain in region body
        for (let idx = startSample + fadeLen; idx < endSample - fadeLen; idx++) {
          envelope[idx] = targetMult;
        }

        // End fade ramp
        for (let i = 0; i < fadeLen; i++) {
          const idx = endSample - fadeLen + i;
          const nextMult = envelope[Math.min(length - 1, endSample)];
          const t = i / fadeLen;
          envelope[idx] = targetMult + (nextMult - targetMult) * t;
        }
      }

      for (let i = 0; i < length; i++) {
        const val = src[i] * envelope[i];
        dst[i] = val > 1.0 ? 1.0 : (val < -1.0 ? -1.0 : val);
      }
    }
  }

  return newBuf;
}

