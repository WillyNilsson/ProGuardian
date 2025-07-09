/**
 * Version check utility for ProGuardian CLI
 * Checks for updates from npm registry and notifies users
 */

import https from 'https'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'
import { logger } from './logger.js'
import chalk from 'chalk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_NAME = '@proguardian/cli'
const CACHE_FILE = '.proguardian-update-check.json'
const CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours
const REGISTRY_URL = 'https://registry.npmjs.org'
const REQUEST_TIMEOUT = 5000 // 5 seconds

/**
 * Get the cache file path
 * @returns {string} Path to cache file
 */
function getCacheFilePath() {
  // Use a safe location within the project or temp directory
  // to avoid path traversal issues with home directory
  const tempDir = os.tmpdir()
  return path.join(tempDir, CACHE_FILE)
}

/**
 * Read the update check cache
 * @returns {Promise<Object|null>} Cache data or null
 */
async function readCache() {
  try {
    const cachePath = getCacheFilePath()
    if (await fs.pathExists(cachePath)) {
      const content = await fs.readFile(cachePath, 'utf-8')
      return JSON.parse(content)
    }
  } catch {
    // Ignore cache read errors
  }
  return null
}

/**
 * Write the update check cache
 * @param {Object} data - Cache data
 */
async function writeCache(data) {
  try {
    const cachePath = getCacheFilePath()
    await fs.writeFile(cachePath, JSON.stringify(data, null, 2), { 
      encoding: 'utf-8',
      mode: 0o600 
    })
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Fetch package info from npm registry
 * @param {string} packageName - NPM package name
 * @returns {Promise<Object|null>} Package data or null
 */
function fetchPackageInfo(packageName) {
  return new Promise((resolve) => {
    const url = `${REGISTRY_URL}/${encodeURIComponent(packageName)}`
    
    const req = https.get(url, { timeout: REQUEST_TIMEOUT }, (res) => {
      if (res.statusCode !== 200) {
        resolve(null)
        return
      }

      let data = ''
      res.on('data', (chunk) => {
        data += chunk
        // Limit response size to prevent memory issues
        if (data.length > 100000) { // 100KB max
          req.destroy()
          resolve(null)
        }
      })

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(parsed)
        } catch {
          resolve(null)
        }
      })
    })

    req.on('error', () => resolve(null))
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
  })
}

/**
 * Compare semantic versions
 * @param {string} current - Current version
 * @param {string} latest - Latest version
 * @returns {boolean} True if latest is newer
 */
function isNewerVersion(current, latest) {
  try {
    // Remove 'v' prefix if present
    current = current.replace(/^v/, '')
    latest = latest.replace(/^v/, '')

    const currentParts = current.split('.').map(Number)
    const latestParts = latest.split('.').map(Number)

    for (let i = 0; i < 3; i++) {
      const currentPart = currentParts[i] || 0
      const latestPart = latestParts[i] || 0

      if (latestPart > currentPart) return true
      if (latestPart < currentPart) return false
    }

    return false
  } catch {
    return false
  }
}

/**
 * Get current package version
 * @returns {Promise<string|null>} Current version or null
 */
async function getCurrentVersion() {
  try {
    const packagePath = path.join(__dirname, '..', '..', 'package.json')
    const content = await fs.readFile(packagePath, 'utf-8')
    const packageData = JSON.parse(content)
    return packageData.version
  } catch {
    return null
  }
}

/**
 * Check if update check is disabled via environment
 * @returns {boolean} True if disabled
 */
function isCheckDisabled() {
  const disabled = process.env.PROGUARDIAN_NO_UPDATE_CHECK || 
                  process.env.NO_UPDATE_NOTIFIER ||
                  process.env.CI ||
                  process.env.CONTINUOUS_INTEGRATION
  
  return disabled === '1' || disabled === 'true'
}

/**
 * Show update notification
 * @param {string} currentVersion - Current version
 * @param {string} latestVersion - Latest version
 */
function showUpdateNotification(currentVersion, latestVersion) {
  const updateMessage = `
${chalk.yellow('╭─────────────────────────────────────────────────────╮')}
${chalk.yellow('│')}                                                     ${chalk.yellow('│')}
${chalk.yellow('│')}  ${chalk.bold('Update available!')} ${logger.dim(`${currentVersion} → ${latestVersion}`)}              ${chalk.yellow('│')}
${chalk.yellow('│')}                                                     ${chalk.yellow('│')}
${chalk.yellow('│')}  Run ${chalk.cyan('npm update -g @proguardian/cli')} to update     ${chalk.yellow('│')}
${chalk.yellow('│')}                                                     ${chalk.yellow('│')}
${chalk.yellow('│')}  ${logger.dim('Disable this check with PROGUARDIAN_NO_UPDATE_CHECK=1')} ${chalk.yellow('│')}
${chalk.yellow('│')}                                                     ${chalk.yellow('│')}
${chalk.yellow('╰─────────────────────────────────────────────────────╯')}
`
  console.log(updateMessage)
}

/**
 * Check for updates asynchronously
 * This function runs in the background and doesn't block
 */
export async function checkForUpdates() {
  // Skip if disabled
  if (isCheckDisabled()) {
    return
  }

  try {
    // Get current version
    const currentVersion = await getCurrentVersion()
    if (!currentVersion) {
      return
    }

    // Check cache
    const cache = await readCache()
    const now = Date.now()

    // If cache is fresh, check if we need to show notification
    if (cache && cache.lastCheck && (now - cache.lastCheck) < CHECK_INTERVAL) {
      if (cache.latestVersion && cache.notified !== cache.latestVersion) {
        if (isNewerVersion(currentVersion, cache.latestVersion)) {
          showUpdateNotification(currentVersion, cache.latestVersion)
          await writeCache({
            ...cache,
            notified: cache.latestVersion,
          })
        }
      }
      return
    }

    // Fetch latest version
    const packageInfo = await fetchPackageInfo(PACKAGE_NAME)
    if (!packageInfo || !packageInfo['dist-tags'] || !packageInfo['dist-tags'].latest) {
      return
    }

    const latestVersion = packageInfo['dist-tags'].latest

    // Update cache
    await writeCache({
      lastCheck: now,
      latestVersion,
      currentVersion,
      notified: cache?.notified,
    })

    // Show notification if update available
    if (isNewerVersion(currentVersion, latestVersion)) {
      showUpdateNotification(currentVersion, latestVersion)
      await writeCache({
        lastCheck: now,
        latestVersion,
        currentVersion,
        notified: latestVersion,
      })
    }
  } catch {
    // Silently ignore all errors - update check should never break the CLI
  }
}

/**
 * Check for updates in the background without blocking
 * This returns immediately and runs the check asynchronously
 */
export function checkForUpdatesInBackground() {
  // Use setImmediate to ensure this doesn't block the main thread
  setImmediate(() => {
    checkForUpdates().catch(() => {
      // Ignore errors - update check should never break the CLI
    })
  })
}