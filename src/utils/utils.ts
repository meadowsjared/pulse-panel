/**
 * Strips the file extension from a file name
 * @param fileName The name of the file
 */
export function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '')
}
