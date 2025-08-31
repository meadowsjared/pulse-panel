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
  activeSegment?: SoundSegment
  soundSegments?: SoundSegment[]
}

export interface SoundSegment {
  start: number
  end: number
}

export interface LabelActive {
  label: string
  active: boolean
  negated?: true
  isPreview?: boolean
}
