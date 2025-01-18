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
  color?: string
  volume?: number
  isPreview?: boolean
  duration?: number
  /** used for resetting the progress bar animation */
  reset?: boolean
}
