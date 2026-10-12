declare interface HTMLMediaElement {
  setSinkId: (sinkId: string) => Promise<void>
  // setSinkId is undefined on FireFox by default
}

interface Window {
  webkitAudioContext?: typeof AudioContext
}

interface AudioContext {
  setSinkId?: (sinkId: string) => Promise<void>
  sinkId?: string
}
