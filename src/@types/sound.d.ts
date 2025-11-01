export interface Sound {
  id: string
  title?: string
  hideTitle?: boolean
  tags?: string[]
  hotkey?: string[]
  audioKey?: string
  imageKey?: string
  volume?: number
  color?: string
  soundSegments?: SoundSegment[]
  /** used to control the visibility of the sound */
  isVisible?: true

  /** **Volatile** - not saved to DB */
  audioUrl?: string
  /** **Volatile** - not saved to DB */
  imageUrl?: string
  /** **Volatile** - not saved to DB */
  isPreview?: boolean
  /** **Volatile** - not saved to DB */
  duration?: number
  /**
   * used for resetting the progress bar animation
   *
   * **Volatile** - not saved to DB
   */
  reset?: boolean
  /** **Volatile** - not saved to DB */
  activeSegment?: SoundSegment
}

export interface SoundForSaving extends Sound {
  hideTitle?: string
  tags?: string
  hotkey?: string
  soundSegments?: string
  isVisible?: string
}

export interface SoundForLoading extends Sound {
  tags?: string
  hotkey?: string
  soundSegments?: string
}

export interface SoundSegment {
  label?: string
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
