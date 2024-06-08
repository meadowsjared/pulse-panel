export interface Sound {
  id: string
  title?: string
  hideTitle?: boolean
  hotkey?: string[]
  audioUrl?: string
  audioKey?: string
  imageUrl?: string
  imageKey?: string
  volume?: number
  isPreview?: boolean
}
