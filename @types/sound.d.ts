export interface Sound {
  id: string
  title?: string
  hideTitle?: boolean
  tags?: string[]
  hotkey?: string[]
  audioUrl?: string
  audioKey?: string
  imageUrl?: string
  imageKey?: string
  volume?: number
  isPreview?: boolean
}
