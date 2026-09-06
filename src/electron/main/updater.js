const { app, shell } = require('electron')
const fs = require('fs')
const { join } = require('path')
const { spawn } = require('child_process')
const https = require('https')
const http = require('http')

/**
 * Downloads a file with redirect support and progress reporting
 * @param {string} url
 * @param {string} destPath
 * @param {(progress: { receivedBytes: number, totalBytes: number, percent: number }) => void} onProgress
 * @returns {Promise<string>}
 */
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 10) {
        return reject(new Error('Too many redirects'))
      }

      let parsedUrl
      try {
        parsedUrl = new URL(currentUrl)
      } catch (err) {
        return reject(err)
      }

      const client = parsedUrl.protocol === 'http:' ? http : https
      const options = {
        headers: {
          'User-Agent': 'pulse-panel',
          Accept: 'application/octet-stream',
        },
      }

      const req = client.get(parsedUrl, options, res => {
        // Handle redirects (301, 302, 307, 308)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          return follow(res.headers.location, redirectCount + 1)
        }

        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`Download failed with status code ${res.statusCode}`))
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
        let receivedBytes = 0

        const fileStream = fs.createWriteStream(destPath)

        res.on('data', chunk => {
          receivedBytes += chunk.length
          if (totalBytes > 0 && onProgress) {
            const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
            onProgress({ receivedBytes, totalBytes, percent })
          }
        })

        res.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream.close(() => resolve(destPath))
        })

        fileStream.on('error', err => {
          try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
          } catch {
            // ignore
          }
          reject(err)
        })

        res.on('error', err => {
          try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
          } catch {
            // ignore
          }
          reject(err)
        })
      })

      req.on('error', err => {
        try {
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
        } catch {
          // ignore
        }
        reject(err)
      })
    }

    follow(url)
  })
}

/**
 * Downloads the update file and launches the installer
 * @param {string} downloadUrl
 * @param {(progress: { receivedBytes: number, totalBytes: number, percent: number }) => void} onProgress
 */
async function downloadAndInstallUpdate(downloadUrl, onProgress) {
  const extension = process.platform === 'win32' ? '.exe' : process.platform === 'darwin' ? '.dmg' : '.AppImage'
  const destPath = join(app.getPath('temp'), `pulse-panel-update${extension}`)

  if (fs.existsSync(destPath)) {
    try {
      fs.unlinkSync(destPath)
    } catch {
      // ignore
    }
  }

  await downloadFile(downloadUrl, destPath, onProgress)

  if (process.platform === 'win32') {
    const child = spawn(destPath, [], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    app.isQuitting = true
    app.quit()
  } else if (process.platform === 'darwin') {
    await shell.openPath(destPath)
    app.isQuitting = true
    app.quit()
  } else {
    const child = spawn(destPath, [], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    app.isQuitting = true
    app.quit()
  }
}

module.exports = {
  downloadAndInstallUpdate,
}
