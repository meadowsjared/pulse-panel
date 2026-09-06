import { defineStore } from 'pinia'
import { ref } from 'vue'

export function parseSemver(version: string) {
  const clean = (version || '').trim().replace(/^v/, '')
  const [core, prerelease] = clean.split('-')
  const parts = core.split('.').map(n => parseInt(n, 10) || 0)
  while (parts.length < 3) parts.push(0)
  return { major: parts[0], minor: parts[1], patch: parts[2], prerelease }
}

export function isNewerVersion(current: string, latest: string): boolean {
  const vCurrent = parseSemver(current)
  const vLatest = parseSemver(latest)

  if (vLatest.major > vCurrent.major) return true
  if (vLatest.major < vCurrent.major) return false

  if (vLatest.minor > vCurrent.minor) return true
  if (vLatest.minor < vCurrent.minor) return false

  if (vLatest.patch > vCurrent.patch) return true
  if (vLatest.patch < vCurrent.patch) return false

  // If core versions match but current has a pre-release and latest doesn't, latest is considered newer
  if (vCurrent.prerelease && !vLatest.prerelease) return true

  return false
}

export interface GitHubReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

export interface GitHubRelease {
  tag_name: string
  html_url: string
  assets: GitHubReleaseAsset[]
}

const CHECK_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

export const useUpdateStore = defineStore('update', () => {
  const updateAvailable = ref(false)
  const latestVersion = ref<string | null>(null)
  const downloadUrl = ref<string | null>(null)
  const releaseUrl = ref<string | null>(null)
  const isChecking = ref(false)
  const isDownloading = ref(false)
  const downloadProgress = ref(0)
  const statusText = ref<string>('')
  const errorMessage = ref<string | null>(null)
  let lastCheckedTime = 0
  let progressListenerInitialized = false

  function initProgressListener() {
    if (progressListenerInitialized) return
    if (window.electron?.onUpdateDownloadProgress) {
      window.electron.onUpdateDownloadProgress(progress => {
        downloadProgress.value = progress.percent
        statusText.value = `Downloading... ${progress.percent}%`
      })
      progressListenerInitialized = true
    }
  }

  /**
   * Lazily checks GitHub for the latest release
   */
  async function checkForUpdates(force = false): Promise<void> {
    const now = Date.now()
    if (!force && now - lastCheckedTime < CHECK_INTERVAL_MS) {
      return
    }

    const currentVersion = window.electron?.versions?.app
    if (!currentVersion) {
      return
    }

    isChecking.value = true
    try {
      const response = await fetch('https://api.github.com/repos/meadowsjared/pulse-panel/releases/latest', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (!response.ok) {
        // Rate limit or server error - silently exit
        return
      }

      const data: GitHubRelease = await response.json()
      if (!data.tag_name) return

      lastCheckedTime = now
      const latestTag = data.tag_name

      if (isNewerVersion(currentVersion, latestTag)) {
        updateAvailable.value = true
        latestVersion.value = latestTag
        releaseUrl.value = data.html_url

        // Find installer asset
        const platform = window.electron?.versions?.platform || 'win32'
        let targetAsset: GitHubReleaseAsset | undefined
        if (platform === 'win32') {
          targetAsset = data.assets?.find(a => a.name.endsWith('.exe'))
        } else if (platform === 'darwin') {
          targetAsset = data.assets?.find(a => a.name.endsWith('.dmg') || a.name.endsWith('.zip'))
        } else {
          targetAsset = data.assets?.find(a => a.name.endsWith('.AppImage') || a.name.endsWith('.deb'))
        }

        if (targetAsset) {
          downloadUrl.value = targetAsset.browser_download_url
        } else if (data.assets && data.assets.length > 0) {
          downloadUrl.value = data.assets[0].browser_download_url
        } else {
          downloadUrl.value = null
        }
      }
    } catch {
      // Gracefully ignore network or offline errors
    } finally {
      isChecking.value = false
    }
  }

  /**
   * Starts downloading and installing the update
   */
  async function startUpdate(): Promise<void> {
    if (isDownloading.value) return

    initProgressListener()

    // If no direct download URL or running in browser without electron, open release page
    if (!downloadUrl.value || !window.electron?.downloadAndInstallUpdate) {
      const url = releaseUrl.value || 'https://github.com/meadowsjared/pulse-panel/releases/latest'
      if (window.electron?.openExternalLink) {
        window.electron.openExternalLink(url)
      } else {
        window.open(url, '_blank')
      }
      return
    }

    isDownloading.value = true
    downloadProgress.value = 0
    statusText.value = 'Downloading... 0%'
    errorMessage.value = null

    try {
      await window.electron.downloadAndInstallUpdate(downloadUrl.value)
      statusText.value = 'Installing...'
    } catch (err: unknown) {
      isDownloading.value = false
      statusText.value = ''
      const msg = err instanceof Error ? err.message : String(err)
      errorMessage.value = `Failed to download update: ${msg}`
    }
  }

  return {
    updateAvailable,
    latestVersion,
    downloadUrl,
    releaseUrl,
    isChecking,
    isDownloading,
    downloadProgress,
    statusText,
    errorMessage,
    checkForUpdates,
    startUpdate,
  }
})
