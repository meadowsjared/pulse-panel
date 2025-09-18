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
  /** used to control the visibility of the sound */
  isVisible?: true
}

export interface SoundForSaving extends Sound {
  tags?: string
  hotkey?: string
  soundSegments?: string
}

export interface SoundSegment {
  start: number
  end: number
  isPreview?: boolean
  id: string
}

export interface LabelActive {
  label: string
  active: boolean
  negated?: true
  isPreview?: boolean
}
