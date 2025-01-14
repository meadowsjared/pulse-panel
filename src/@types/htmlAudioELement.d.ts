declare interface HTMLMediaElement {
  setSinkId: (sinkId: string) => Promise<void>
  // setSinkId is undefined on FireFox by default
}
