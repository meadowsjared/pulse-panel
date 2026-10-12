/**
 * audioSegments.ts
 *
 * Robust, sample-accurate utilities for multi-segment audio timeline editing,
 * boundary detection, sample rate normalization, and linked-track audio splicing/compositing.
 */

export interface AudioTimelineSegment {
  id: string;
  buffer: AudioBuffer;
  duration: number;
  label?: string;
  isPasted?: boolean;
}

import { ref } from 'vue'

export interface AudioClipboardData {
  buffer: AudioBuffer;
  segments?: AudioTimelineSegment[];
  sourceTrack: 'both' | 'mic' | 'input';
  duration: number;
}

export const sharedAudioClipboard = ref<AudioClipboardData | null>(null)

/**
 * Creates an initial segment array from a single decoded AudioBuffer.
 */
export function createInitialSegments(buffer: AudioBuffer): AudioTimelineSegment[] {
  return [
    {
      id: 'seg-' + Date.now() + '-orig',
      buffer,
      duration: buffer.duration,
      label: 'Original Audio',
    },
  ]
}

/**
 * Calculates internal boundary timestamps between adjacent segments.
 * Returns an array of timestamps (in seconds) where divider lines should be drawn.
 */
export function getSegmentBoundaries(segments: AudioTimelineSegment[]): number[] {
  if (segments.length <= 1) return []
  const boundaries: number[] = []
  let accum = 0
  for (let i = 0; i < segments.length - 1; i++) {
    accum += segments[i].duration
    boundaries.push(accum)
  }
  return boundaries
}

/**
 * Slices a portion of an AudioBuffer sample-accurately by integer sample indices.
 */
export function sliceAudioBufferSamples(
  ctx: AudioContext,
  buffer: AudioBuffer,
  startSample: number,
  endSample: number
): AudioBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const totalLength = buffer.length

  const start = Math.max(0, Math.min(totalLength, startSample))
  const end = Math.max(start, Math.min(totalLength, endSample))
  const sliceLength = Math.max(1, end - start)

  const sliced = ctx.createBuffer(numChannels, sliceLength, sampleRate)

  for (let ch = 0; ch < numChannels; ch++) {
    const src = buffer.getChannelData(ch)
    const dst = sliced.getChannelData(ch)
    const chunk = src.subarray(start, Math.min(src.length, end))
    dst.set(chunk, 0)
  }

  return sliced
}

/**
 * Slices a portion of an AudioBuffer by second timestamps.
 */
export function sliceAudioBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  startSec: number,
  endSec: number
): AudioBuffer {
  const sampleRate = buffer.sampleRate
  const startSample = Math.max(0, Math.floor(startSec * sampleRate))
  const endSample = Math.min(buffer.length, Math.ceil(endSec * sampleRate))
  return sliceAudioBufferSamples(ctx, buffer, startSample, endSample)
}

/**
 * Resamples an AudioBuffer if its sample rate doesn't match the target context.
 */
export function resampleBufferIfNeeded(
  ctx: AudioContext,
  buffer: AudioBuffer,
  targetSampleRate: number
): AudioBuffer {
  if (buffer.sampleRate === targetSampleRate) return buffer
  const ratio = targetSampleRate / buffer.sampleRate
  const newLength = Math.max(1, Math.round(buffer.length * ratio))
  const resampled = ctx.createBuffer(buffer.numberOfChannels, newLength, targetSampleRate)

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch)
    const dst = resampled.getChannelData(ch)
    for (let i = 0; i < newLength; i++) {
      const srcPos = i / ratio
      const idx0 = Math.floor(srcPos)
      const idx1 = Math.min(src.length - 1, idx0 + 1)
      const frac = srcPos - idx0
      dst[i] = src[idx0] * (1 - frac) + src[idx1] * frac
    }
  }

  return resampled
}

/**
 * Composites an array of sequential AudioTimelineSegments into a single unified AudioBuffer.
 */
export function compositeSegments(
  ctx: AudioContext,
  segments: AudioTimelineSegment[]
): AudioBuffer {
  if (segments.length === 0) {
    return ctx.createBuffer(1, 1, 44100)
  }
  if (segments.length === 1) {
    return segments[0].buffer
  }

  const sampleRate = segments[0].buffer.sampleRate
  const maxChannels = Math.max(...segments.map(s => s.buffer.numberOfChannels))

  const normalizedSegments = segments.map(s => {
    if (s.buffer.sampleRate === sampleRate) return s.buffer
    return resampleBufferIfNeeded(ctx, s.buffer, sampleRate)
  })

  const totalLength = normalizedSegments.reduce((sum, b) => sum + b.length, 0)
  const composite = ctx.createBuffer(maxChannels, Math.max(1, totalLength), sampleRate)

  for (let ch = 0; ch < maxChannels; ch++) {
    const destData = composite.getChannelData(ch)
    let offset = 0
    for (const buf of normalizedSegments) {
      if (ch < buf.numberOfChannels) {
        destData.set(buf.getChannelData(ch), offset)
      }
      offset += buf.length
    }
  }

  return composite
}

/**
 * Adapts an AudioBuffer for a specific target track layout.
 */
export function adaptBufferForTrack(
  ctx: AudioContext,
  buffer: AudioBuffer,
  target: 'both' | 'mic' | 'input'
): AudioBuffer {
  const sampleRate = buffer.sampleRate
  const length = buffer.length

  if (target === 'mic') {
    const micBuf = ctx.createBuffer(1, length, sampleRate)
    micBuf.getChannelData(0).set(buffer.getChannelData(0))
    return micBuf
  }

  if (target === 'input' && buffer.numberOfChannels >= 2) {
    const inputBuf = ctx.createBuffer(1, length, sampleRate)
    inputBuf.getChannelData(0).set(buffer.getChannelData(1))
    return inputBuf
  }

  return buffer
}

/**
 * Extracts a selection from the timeline into an AudioClipboardData object,
 * preserving all internal segments and track boundaries.
 */
export function copyAudioSelection(
  ctx: AudioContext,
  source: AudioTimelineSegment[] | AudioBuffer,
  startSec: number,
  endSec: number,
  target: 'both' | 'mic' | 'input'
): AudioClipboardData {
  let segmentsToExtract: AudioTimelineSegment[] = []

  if (Array.isArray(source)) {
    // If passed a timeline segment list, split at startSec and endSec so boundaries align exactly
    let splitList = splitTimelineAt(ctx, source, startSec)
    splitList = splitTimelineAt(ctx, splitList, endSec)

    let accum = 0
    const EPSILON = 0.002
    for (const seg of splitList) {
      const segStart = accum
      const segEnd = accum + seg.duration

      if (segStart >= startSec - EPSILON && segEnd <= endSec + EPSILON) {
        const adapted = adaptBufferForTrack(ctx, seg.buffer, target)
        segmentsToExtract.push({
          id: 'seg-copied-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          buffer: adapted,
          duration: adapted.duration,
          label: seg.label || 'Segment',
          isPasted: true,
        })
      }
      accum = segEnd
    }
  } else {
    const sliced = sliceAudioBuffer(ctx, source, startSec, endSec)
    const adapted = adaptBufferForTrack(ctx, sliced, target)
    segmentsToExtract.push({
      id: 'seg-copied-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      buffer: adapted,
      duration: adapted.duration,
      label: 'Segment',
      isPasted: true,
    })
  }

  if (segmentsToExtract.length === 0) {
    const silent = ctx.createBuffer(1, 1, 44100)
    segmentsToExtract.push({
      id: 'seg-empty-' + Date.now(),
      buffer: silent,
      duration: silent.duration,
      label: 'Empty',
    })
  }

  const composite = compositeSegments(ctx, segmentsToExtract)
  return {
    buffer: composite,
    segments: segmentsToExtract,
    sourceTrack: target,
    duration: composite.duration,
  }
}

/**
 * Splits existing segments at a specific timestamp (in seconds) sample-accurately.
 */
export function splitTimelineAt(
  ctx: AudioContext,
  segments: AudioTimelineSegment[],
  splitSec: number
): AudioTimelineSegment[] {
  const EPSILON = 0.005 // 5ms tolerance to prevent micro-slices
  const result: AudioTimelineSegment[] = []
  let currentStart = 0

  for (const seg of segments) {
    const currentEnd = currentStart + seg.duration

    if (splitSec <= currentStart + EPSILON || splitSec >= currentEnd - EPSILON) {
      result.push(seg)
    } else {
      const leftDuration = splitSec - currentStart
      const sampleRate = seg.buffer.sampleRate
      const splitSample = Math.max(1, Math.min(seg.buffer.length - 1, Math.round(leftDuration * sampleRate)))

      const leftBuf = sliceAudioBufferSamples(ctx, seg.buffer, 0, splitSample)
      const rightBuf = sliceAudioBufferSamples(ctx, seg.buffer, splitSample, seg.buffer.length)

      result.push({
        id: 'seg-' + Date.now() + '-l' + Math.random().toString(36).slice(2, 5),
        buffer: leftBuf,
        duration: leftBuf.duration,
        label: seg.label ? seg.label + ' (Part 1)' : 'Segment Part 1',
        isPasted: seg.isPasted,
      })

      result.push({
        id: 'seg-' + Date.now() + '-r' + Math.random().toString(36).slice(2, 5),
        buffer: rightBuf,
        duration: rightBuf.duration,
        label: seg.label ? seg.label + ' (Part 2)' : 'Segment Part 2',
        isPasted: seg.isPasted,
      })
    }

    currentStart = currentEnd
  }

  return result
}

/**
 * Adapts an incoming clipboard buffer to match the target channel layout
 * with linked-track protection (keeping original audio on the non-targeted channel when replacing).
 */
export function adaptPasteBufferForTimeline(
  ctx: AudioContext,
  pasteBuffer: AudioBuffer,
  targetChannels: number,
  targetTrack: 'both' | 'mic' | 'input',
  preservedOtherChannel?: Float32Array | null
): AudioBuffer {
  const sampleRate = pasteBuffer.sampleRate
  const length = pasteBuffer.length
  const adapted = ctx.createBuffer(targetChannels, length, sampleRate)

  if (targetChannels === 1) {
    adapted.getChannelData(0).set(pasteBuffer.getChannelData(0))
    return adapted
  }

  // Dual channels: Channel 0 is Mic, Channel 1 is Input
  if (targetTrack === 'mic') {
    adapted.getChannelData(0).set(pasteBuffer.getChannelData(0))
    if (preservedOtherChannel && preservedOtherChannel.length > 0) {
      const copyLen = Math.min(length, preservedOtherChannel.length)
      adapted.getChannelData(1).set(preservedOtherChannel.subarray(0, copyLen))
    }
  } else if (targetTrack === 'input') {
    const srcCh = pasteBuffer.numberOfChannels >= 2 ? 1 : 0
    adapted.getChannelData(1).set(pasteBuffer.getChannelData(srcCh))
    if (preservedOtherChannel && preservedOtherChannel.length > 0) {
      const copyLen = Math.min(length, preservedOtherChannel.length)
      adapted.getChannelData(0).set(preservedOtherChannel.subarray(0, copyLen))
    }
  } else {
    // targetTrack === 'both'
    adapted.getChannelData(0).set(pasteBuffer.getChannelData(0))
    if (pasteBuffer.numberOfChannels >= 2) {
      adapted.getChannelData(1).set(pasteBuffer.getChannelData(1))
    } else {
      adapted.getChannelData(1).set(pasteBuffer.getChannelData(0))
    }
  }

  return adapted
}

/**
 * Splices new audio segment(s) into the timeline, optionally replacing a selected range.
 * Supports multiple segments from the clipboard, preserving all internal track boundaries.
 */
export function spliceTimelineSegments(
  ctx: AudioContext,
  currentSegments: AudioTimelineSegment[],
  pasteBuffer: AudioBuffer,
  insertAtSec: number,
  replaceEndSec?: number,
  targetTrack: 'both' | 'mic' | 'input' = 'both',
  pasteSegments?: AudioTimelineSegment[]
): {
  newSegments: AudioTimelineSegment[];
  insertedSegments: AudioTimelineSegment[];
  timeDelta: number;
} {
  const hasReplacement = replaceEndSec !== undefined && replaceEndSec > insertAtSec + 0.005
  const replaceDuration = hasReplacement ? (replaceEndSec! - insertAtSec) : 0

  const targetSampleRate = currentSegments[0]?.buffer.sampleRate || ctx.sampleRate
  const targetChannels = Math.max(1, ...currentSegments.map(s => s.buffer.numberOfChannels))

  // Extract preserved audio of the other channel if replacing a single track in dual-channel mode
  let preservedOtherChannel: Float32Array | null = null
  if (hasReplacement && targetChannels >= 2 && targetTrack !== 'both') {
    const compositeBefore = compositeSegments(ctx, currentSegments)
    const replacedSlice = sliceAudioBuffer(ctx, compositeBefore, insertAtSec, replaceEndSec!)
    if (targetTrack === 'mic' && replacedSlice.numberOfChannels >= 2) {
      // Preserve Input channel
      preservedOtherChannel = new Float32Array(replacedSlice.getChannelData(1))
    } else if (targetTrack === 'input') {
      // Preserve Mic channel
      preservedOtherChannel = new Float32Array(replacedSlice.getChannelData(0))
    }
  }

  // 1. Split at insertion and replacement boundaries
  let splitList = splitTimelineAt(ctx, currentSegments, insertAtSec)
  if (hasReplacement) {
    splitList = splitTimelineAt(ctx, splitList, replaceEndSec!)
  }

  // 2. Identify prefix (before insertAtSec) and suffix (after replaceEndSec or insertAtSec)
  const prefix: AudioTimelineSegment[] = []
  const suffix: AudioTimelineSegment[] = []
  let accum = 0
  const EPSILON = 0.002

  for (const seg of splitList) {
    const segStart = accum
    const segEnd = accum + seg.duration

    if (segEnd <= insertAtSec + EPSILON) {
      prefix.push(seg)
    } else if (hasReplacement && segStart >= replaceEndSec! - EPSILON) {
      suffix.push(seg)
    } else if (!hasReplacement && segStart >= insertAtSec - EPSILON) {
      suffix.push(seg)
    }

    accum = segEnd
  }

  // 3. Adapt incoming segment(s) to timeline layout
  const rawSegments = (pasteSegments && pasteSegments.length > 0)
    ? pasteSegments
    : [{ id: 'seg-paste-raw', buffer: pasteBuffer, duration: pasteBuffer.duration }]

  const adaptedSegments: AudioTimelineSegment[] = []
  let preservedOffsetSamples = 0

  for (const rawSeg of rawSegments) {
    const normalized = resampleBufferIfNeeded(ctx, rawSeg.buffer, targetSampleRate)
    let segPreserved: Float32Array | null = null
    if (preservedOtherChannel && preservedOtherChannel.length > 0) {
      const segLen = normalized.length
      segPreserved = preservedOtherChannel.subarray(preservedOffsetSamples, preservedOffsetSamples + segLen)
      preservedOffsetSamples += segLen
    }

    const adaptedBuffer = adaptPasteBufferForTimeline(
      ctx,
      normalized,
      targetChannels,
      targetTrack,
      segPreserved
    )

    adaptedSegments.push({
      id: 'seg-paste-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      buffer: adaptedBuffer,
      duration: adaptedBuffer.duration,
      label: rawSeg.label || 'Pasted Audio',
      isPasted: true,
    })
  }

  const newSegments = [...prefix, ...adaptedSegments, ...suffix]
  const totalPastedDuration = adaptedSegments.reduce((sum, s) => sum + s.duration, 0)
  const timeDelta = totalPastedDuration - replaceDuration

  return {
    newSegments,
    insertedSegments: adaptedSegments,
    timeDelta,
  }
}

/**
 * Cuts a range from the timeline, returning the extracted clipboard data and the remaining segments.
 */
export function cutTimelineSegments(
  ctx: AudioContext,
  currentSegments: AudioTimelineSegment[],
  startSec: number,
  endSec: number,
  targetTrack: 'both' | 'mic' | 'input' = 'both'
): {
  newSegments: AudioTimelineSegment[];
  clipboardData: AudioClipboardData;
} {
  const clipboardData = copyAudioSelection(ctx, currentSegments, startSec, endSec, targetTrack)

  let splitList = splitTimelineAt(ctx, currentSegments, startSec)
  splitList = splitTimelineAt(ctx, splitList, endSec)

  const newSegments: AudioTimelineSegment[] = []
  let accum = 0
  const EPSILON = 0.002

  for (const seg of splitList) {
    const segStart = accum
    const segEnd = accum + seg.duration

    if (segEnd <= startSec + EPSILON || segStart >= endSec - EPSILON) {
      newSegments.push(seg)
    }

    accum = segEnd
  }

  // Fallback: If everything was cut, retain 1 sample of silence to maintain buffer validity
  if (newSegments.length === 0) {
    const silent = ctx.createBuffer(clipboardData.buffer.numberOfChannels, 1, clipboardData.buffer.sampleRate)
    newSegments.push({
      id: 'seg-empty-' + Date.now(),
      buffer: silent,
      duration: silent.duration,
      label: 'Empty Audio',
    })
  }

  return {
    newSegments,
    clipboardData,
  }
}

/**
 * Deletes a range from the timeline without modifying clipboard, returning remaining segments.
 */
export function deleteTimelineSegments(
  ctx: AudioContext,
  currentSegments: AudioTimelineSegment[],
  startSec: number,
  endSec: number,
  _targetTrack: 'both' | 'mic' | 'input' = 'both'
): AudioTimelineSegment[] {
  let splitList = splitTimelineAt(ctx, currentSegments, startSec)
  splitList = splitTimelineAt(ctx, splitList, endSec)

  const newSegments: AudioTimelineSegment[] = []
  let accum = 0
  const EPSILON = 0.002

  for (const seg of splitList) {
    const segStart = accum
    const segEnd = accum + seg.duration

    if (segEnd <= startSec + EPSILON || segStart >= endSec - EPSILON) {
      newSegments.push(seg)
    }

    accum = segEnd
  }

  // Fallback: If everything was deleted, retain 1 sample of silence to maintain buffer validity
  if (newSegments.length === 0) {
    const channels = Math.max(1, ...currentSegments.map(s => s.buffer.numberOfChannels))
    const sampleRate = currentSegments[0]?.buffer.sampleRate || ctx.sampleRate
    const silent = ctx.createBuffer(channels, 1, sampleRate)
    newSegments.push({
      id: 'seg-empty-' + Date.now(),
      buffer: silent,
      duration: silent.duration,
      label: 'Empty Audio',
    })
  }

  return newSegments
}

/**
 * Strips '(Part X)' numbering suffixes from a segment label for clean display when joining clips.
 */
function cleanSegmentLabel(label?: string): string {
  if (!label) return 'Joined Audio'
  return label.replace(/\s*\(Part\s*\d+\)$/i, '').trim() || 'Joined Audio'
}

/**
 * Joins two adjacent AudioTimelineSegments meeting at a specified boundary timestamp (in seconds).
 * The two segments on either side of the boundary are composited into a single continuous segment,
 * removing the boundary divider line while preserving sample-accurate audio content.
 */
export function joinTimelineAt(
  ctx: AudioContext,
  segments: AudioTimelineSegment[],
  boundarySec: number
): AudioTimelineSegment[] {
  if (segments.length <= 1) return segments

  const EPSILON = 0.02 // 20ms tolerance
  let accum = 0
  let boundaryIndex = -1

  for (let i = 0; i < segments.length - 1; i++) {
    accum += segments[i].duration
    if (Math.abs(accum - boundarySec) <= EPSILON) {
      boundaryIndex = i
      break
    }
  }

  // Fallback: If not found within 20ms, search for closest internal boundary within 80ms
  if (boundaryIndex === -1) {
    let minDiff = Infinity
    let closestIndex = -1
    let testAccum = 0
    for (let i = 0; i < segments.length - 1; i++) {
      testAccum += segments[i].duration
      const diff = Math.abs(testAccum - boundarySec)
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = i
      }
    }
    if (closestIndex !== -1 && minDiff <= 0.08) {
      boundaryIndex = closestIndex
    } else {
      return segments
    }
  }

  const leftSeg = segments[boundaryIndex]
  const rightSeg = segments[boundaryIndex + 1]
  const mergedBuffer = compositeSegments(ctx, [leftSeg, rightSeg])

  const leftBase = cleanSegmentLabel(leftSeg.label)
  const rightBase = cleanSegmentLabel(rightSeg.label)
  const label = leftBase === rightBase ? leftBase : `${leftBase} + ${rightBase}`

  const mergedSeg: AudioTimelineSegment = {
    id: 'seg-joined-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    buffer: mergedBuffer,
    duration: mergedBuffer.duration,
    label,
    isPasted: Boolean(leftSeg.isPasted || rightSeg.isPasted),
  }

  const result: AudioTimelineSegment[] = []
  for (let i = 0; i < segments.length; i++) {
    if (i === boundaryIndex) {
      result.push(mergedSeg)
    } else if (i === boundaryIndex + 1) {
      continue
    } else {
      result.push(segments[i])
    }
  }

  return result
}
