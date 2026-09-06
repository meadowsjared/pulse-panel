import { Sound } from '../@types/sound'

export interface ParsedQuery {
  raw: string
  exactPhraseTokens: string[]
  positiveTokens: string[]
  negativeTokens: string[]
  tagTokens: string[]
  segmentTokens: string[]
}

interface ScoredSound {
  sound: Sound
  score: number
  originalIndex: number
}

/**
 * Tokenize search query supporting quotes ("..."), tags (#tag or tag:tag),
 * segments (seg:segment or @segment), and negation (-term).
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const exactPhraseTokens: string[] = []
  const positiveTokens: string[] = []
  const negativeTokens: string[] = []
  const tagTokens: string[] = []
  const segmentTokens: string[] = []

  // Match quoted phrases ("..."), single quoted phrases ('...'), or non-whitespace words
  const regex = /"([^"]+)"|'([^']+)'|(\S+)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(query)) !== null) {
    const isQuoted = Boolean(match[1] || match[2])
    const rawToken = (match[1] || match[2] || match[3] || '').trim().toLowerCase()
    if (!rawToken) continue

    if (!isQuoted && rawToken.startsWith('-') && rawToken.length > 1) {
      negativeTokens.push(rawToken.slice(1))
    } else if (!isQuoted && rawToken.startsWith('#') && rawToken.length > 1) {
      tagTokens.push(rawToken.slice(1))
    } else if (!isQuoted && rawToken.startsWith('tag:') && rawToken.length > 4) {
      tagTokens.push(rawToken.slice(4))
    } else if (!isQuoted && rawToken.startsWith('@') && rawToken.length > 1) {
      segmentTokens.push(rawToken.slice(1))
    } else if (!isQuoted && rawToken.startsWith('seg:') && rawToken.length > 4) {
      segmentTokens.push(rawToken.slice(4))
    } else if (isQuoted) {
      exactPhraseTokens.push(rawToken)
    } else {
      positiveTokens.push(rawToken)
    }
  }

  return {
    raw: query.trim(),
    exactPhraseTokens,
    positiveTokens,
    negativeTokens,
    tagTokens,
    segmentTokens,
  }
}

/**
 * Checks if candidate is within 1 edit distance of target (transposition, deletion, insertion, replacement).
 * Only compares single words of similar length (>= 4).
 */
function isSingleWordTypo(candidate: string, target: string): boolean {
  if (Math.abs(candidate.length - target.length) > 1) return false
  if (candidate === target) return true
  if (candidate.length < 4 || target.length < 4) return false

  let diff = 0
  let i = 0
  let j = 0

  while (i < candidate.length && j < target.length) {
    if (candidate[i] !== target[j]) {
      diff++
      if (diff > 1) {
        // Check single transposition (e.g. "airhron" vs "airhorn")
        if (
          diff === 2 &&
          i + 1 < candidate.length &&
          j + 1 < target.length &&
          candidate[i] === target[j + 1] &&
          candidate[i + 1] === target[j]
        ) {
          i += 2
          j += 2
          continue
        }
        return false
      }
      if (candidate.length > target.length) {
        i++
        continue
      }
      if (target.length > candidate.length) {
        j++
        continue
      }
    }
    i++
    j++
  }

  if (i < candidate.length || j < target.length) {
    diff++
  }

  return diff <= 1
}

/**
 * Normalizes hotkey strings into searchable tokens (e.g. "ControlLeft" -> ["controlleft", "ctrl", "control"]).
 */
function normalizeHotkeys(hotkeys?: string[]): string[] {
  if (!hotkeys || hotkeys.length === 0) return []
  const normalized: string[] = []
  for (const k of hotkeys) {
    const lower = k.toLowerCase()
    normalized.push(lower)
    if (lower.startsWith('key')) normalized.push(lower.replace('key', ''))
    if (lower.startsWith('digit')) normalized.push(lower.replace('digit', ''))
    if (lower.startsWith('numpad')) normalized.push(lower.replace('numpad', ''))
    if (lower.includes('control')) normalized.push('ctrl')
  }
  return normalized
}

/**
 * Calculate relevance score of a sound for a given parsed query.
 * Returns null if the sound does not match (i.e. fails ANY required token or matches a negation).
 */
function scoreSound(sound: Sound, parsedQuery: ParsedQuery): number | null {
  // Omit the trailing "New Sound" placeholder (which has undefined title)
  if (!sound.title) return null

  const titleLower = sound.title.toLowerCase()
  const rawQueryLower = parsedQuery.raw.toLowerCase()
  const titleWords = titleLower.split(/[\s_\-–—./\\]+/).filter(w => w.length > 0)
  const tagsLower = (sound.tags ?? []).map(t => t.toLowerCase())
  const segmentsLower = (sound.soundSegments ?? []).map(s => s.label?.toLowerCase() ?? '').filter(l => l.length > 0)
  const hotkeysNormalized = normalizeHotkeys(sound.hotkey)

  // 1. Negative tokens: if ANY match, disqualify immediately
  for (const neg of parsedQuery.negativeTokens) {
    if (titleLower.includes(neg)) return null
    if (tagsLower.some(t => t.includes(neg))) return null
    if (segmentsLower.some(s => s.includes(neg))) return null
  }

  // 2. Tag filter tokens: ALL tag tokens must match at least one tag
  for (const tagToken of parsedQuery.tagTokens) {
    const matched = tagsLower.some(t => t === tagToken || t.includes(tagToken))
    if (!matched) return null
  }

  // 3. Segment filter tokens: ALL segment tokens must match at least one segment
  for (const segToken of parsedQuery.segmentTokens) {
    const matched = segmentsLower.some(s => s === segToken || s.includes(segToken))
    if (!matched) return null
  }

  let totalScore = 0

  // 4. Exact quoted phrases: ALL quoted phrases MUST appear verbatim in title, tags, or segments
  for (const phrase of parsedQuery.exactPhraseTokens) {
    const inTitle = titleLower.includes(phrase)
    const inTags = tagsLower.some(t => t === phrase || t.includes(phrase))
    const inSegments = segmentsLower.some(s => s === phrase || s.includes(phrase))

    if (!inTitle && !inTags && !inSegments) {
      return null // Exact phrase not found -> disqualify!
    }

    if (titleLower === phrase) {
      totalScore += 1500
    } else if (inTitle) {
      totalScore += 600
    } else if (inTags) {
      totalScore += 300
    } else if (inSegments) {
      totalScore += 200
    }
  }

  // Bonus for overall raw query match against title
  if (titleLower === rawQueryLower) {
    totalScore += 1200
  } else if (titleLower.startsWith(rawQueryLower)) {
    totalScore += 600
  } else if (titleLower.includes(rawQueryLower)) {
    totalScore += 300
  }

  // Bonus for tag filter matches
  totalScore += parsedQuery.tagTokens.length * 150
  totalScore += parsedQuery.segmentTokens.length * 100

  // 5. Positive tokens: ALL positive tokens must match somewhere in the sound (AND logic)
  for (const token of parsedQuery.positiveTokens) {
    let tokenMatched = false
    let tokenScore = 0

    // Exact title match or word match
    if (titleLower === token) {
      tokenMatched = true
      tokenScore = Math.max(tokenScore, 400)
    } else if (titleWords.some(w => w === token)) {
      tokenMatched = true
      tokenScore = Math.max(tokenScore, 300)
    } else if (titleWords.some(w => w.startsWith(token))) {
      tokenMatched = true
      tokenScore = Math.max(tokenScore, 200)
    } else if (titleLower.includes(token)) {
      tokenMatched = true
      tokenScore = Math.max(tokenScore, 100)
    }

    // Tag matches
    if (tagsLower.some(t => t === token)) {
      tokenMatched = true
      tokenScore = Math.max(tokenScore, 180)
    } else if (tagsLower.some(t => t.startsWith(token))) {
      tokenMatched = true
      tokenScore = Math.max(tokenScore, 140)
    } else if (tagsLower.some(t => t.includes(token))) {
      tokenMatched = true
      tokenScore = Math.max(tokenScore, 80)
    }

    // Segment label matches
    if (segmentsLower.some(s => s === token || s.startsWith(token))) {
      tokenMatched = true
      tokenScore = Math.max(tokenScore, 70)
    } else if (segmentsLower.some(s => s.includes(token))) {
      tokenMatched = true
      tokenScore = Math.max(tokenScore, 50)
    }

    // Hotkey matches
    if (hotkeysNormalized.some(h => h === token || h.includes(token))) {
      tokenMatched = true
      tokenScore = Math.max(tokenScore, 40)
    }

    // Word typo match (checked strictly against individual words in title, e.g. "airhron" for "airhorn")
    if (!tokenMatched && token.length >= 4) {
      if (titleWords.some(w => isSingleWordTypo(token, w))) {
        tokenMatched = true
        tokenScore = Math.max(tokenScore, 25)
      }
    }

    // If this positive token failed to match anywhere, disqualify the sound
    if (!tokenMatched) {
      return null
    }

    totalScore += tokenScore
  }

  return totalScore
}

/**
 * Filter and rank sounds based on a search query.
 * If query is empty or whitespace, returns original sounds list untouched.
 */
export function searchSounds(sounds: Sound[], query: string): Sound[] {
  const trimmed = query.trim()
  if (!trimmed) {
    return sounds
  }

  const parsedQuery = parseSearchQuery(trimmed)

  // If query had tokens but they were all whitespace
  if (
    parsedQuery.exactPhraseTokens.length === 0 &&
    parsedQuery.positiveTokens.length === 0 &&
    parsedQuery.negativeTokens.length === 0 &&
    parsedQuery.tagTokens.length === 0 &&
    parsedQuery.segmentTokens.length === 0
  ) {
    return sounds
  }

  const scoredSounds: ScoredSound[] = []

  sounds.forEach((sound, index) => {
    const score = scoreSound(sound, parsedQuery)
    if (score !== null) {
      scoredSounds.push({
        sound,
        score,
        originalIndex: index,
      })
    }
  })

  // Sort descending by score, tie-break with original index (stable sort)
  scoredSounds.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return a.originalIndex - b.originalIndex
  })

  return scoredSounds.map(item => item.sound)
}
