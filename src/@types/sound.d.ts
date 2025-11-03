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
  isDragPreview?: true
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

export interface SoundSegmentForSaving {
  label?: string
  start: number
  end: number
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
  isDragPreview?: true
  isSoundPreview?: true
  id: string
}

export interface LabelActive {
  label: string
  active: boolean
  negated?: true
  isDragPreview?: true
}
