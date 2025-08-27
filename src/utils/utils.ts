/**
 * Strips the file extension from a file name
 * @param fileName The name of the file
 */
export function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '')
}
/**
 * Converts a total number of seconds into a "mm:ss" string format.
 * (Corrected Version)
 */
export function formatSecondsToMMSS(totalSeconds: number): string {
  // Guard against null, undefined, or non-numeric values
  if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds < 0) {
    return '0'
  }

  if (totalSeconds < 60) {
    if (totalSeconds % 1 === 0) {
      return String(Math.floor(totalSeconds))
    } else {
      return String(totalSeconds)
    }
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  // Format seconds to {precision} decimal place if needed, pad integer part
  let formattedSeconds
  if (seconds % 1 === 0) {
    formattedSeconds = String(Math.floor(seconds)).padStart(2, '0')
  } else {
    formattedSeconds = seconds.toFixed(1).padStart(4, '0')
  }
  return `${minutes}:${formattedSeconds}`
}

/**
 * Parses a "mm:ss" string into a total number of seconds.
 * (More Robust Version)
 */
export function parseMMSSToSeconds(timeString: string): number {
  // Guard against non-string or empty input
  if (typeof timeString !== 'string') {
    return 0
  }

  const parts = timeString.split(':')

  if (parts.length === 1) {
    const seconds = Math.abs(parseFloat(parts[0])) || 0
    return seconds
  }
  // Ensure we have exactly two parts
  if (parts.length !== 2) return 0

  // Use Math.abs to ensure parts are not negative, default to 0 if invalid
  const minutes = Math.abs(parseInt(parts[0], 10)) || 0
  const seconds = Math.abs(parseFloat(parts[1])) || 0

  if (isNaN(minutes) || isNaN(seconds)) {
    return 0
  }

  return minutes * 60 + seconds
}
