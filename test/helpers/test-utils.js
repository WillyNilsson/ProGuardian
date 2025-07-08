import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Creates a temporary test directory
 * @returns {Promise<string>} Path to the temporary directory
 */
export async function setupTestDir() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proguardian-test-'))
  return tmpDir
}

/**
 * Cleans up a test directory
 * @param {string} dirPath - Path to the directory to clean up
 */
export async function cleanupTestDir(dirPath) {
  if (!dirPath || !dirPath.includes('proguardian-test-')) {
    throw new Error('Invalid test directory path')
  }

  // Try to get current directory, but handle failures gracefully
  let currentDir
  try {
    currentDir = process.cwd()
  } catch {
    // If we can't get cwd, we're in a weird state - skip cleanup
    return
  }

  // Ensure we're not in the directory we're about to delete
  if (currentDir === dirPath || currentDir.startsWith(dirPath + path.sep)) {
    // Change to a safe directory first
    try {
      process.chdir(path.dirname(dirPath)) // Go to parent of temp dir
    } catch {
      try {
        process.chdir(os.tmpdir()) // Go to temp dir root
      } catch {
        try {
          process.chdir(os.homedir()) // Go home (cross-platform)
        } catch {
          // Can't change directory, skip cleanup
          return
        }
      }
    }
  }

  try {
    await fs.rm(dirPath, { recursive: true, force: true })
  } catch (error) {
    // Ignore errors during cleanup
  }
}

/**
 * Captures console output during test execution
 * @returns {Object} Object with methods to capture and restore console
 */
export function mockConsole() {
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn

  const logs = []
  const errors = []
  const warnings = []

  return {
    capture() {
      console.log = (...args) => logs.push(args.join(' '))
      console.error = (...args) => errors.push(args.join(' '))
      console.warn = (...args) => warnings.push(args.join(' '))
    },
    restore() {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
    },
    getLogs() {
      return logs
    },
    getErrors() {
      return errors
    },
    getWarnings() {
      return warnings
    },
    getAll() {
      return {
        logs,
        errors,
        warnings,
      }
    },
    clear() {
      logs.length = 0
      errors.length = 0
      warnings.length = 0
    },
  }
}

/**
 * Creates a mock file system structure
 * @param {string} basePath - Base path for the mock file system
 * @param {Object} structure - File system structure to create
 */
export async function createMockFS(basePath, structure) {
  for (const [filePath, content] of Object.entries(structure)) {
    const fullPath = path.join(basePath, filePath)
    const dir = path.dirname(fullPath)

    // Create directories if needed
    await fs.mkdir(dir, { recursive: true })

    // Write file content
    if (content !== null) {
      await fs.writeFile(fullPath, content, 'utf8')
    }
  }
}

/**
 * Reads a file from the mock file system
 * @param {string} basePath - Base path for the mock file system
 * @param {string} filePath - Relative path to the file
 * @returns {Promise<string>} File content
 */
export async function readMockFile(basePath, filePath) {
  const fullPath = path.join(basePath, filePath)
  return await fs.readFile(fullPath, 'utf8')
}

/**
 * Checks if a file exists in the mock file system
 * @param {string} basePath - Base path for the mock file system
 * @param {string} filePath - Relative path to the file
 * @returns {Promise<boolean>} True if file exists
 */
export async function mockFileExists(basePath, filePath) {
  const fullPath = path.join(basePath, filePath)
  try {
    await fs.access(fullPath)
    return true
  } catch {
    return false
  }
}

/**
 * Creates a mock for the 'which' command
 * @param {Object} commands - Object mapping command names to paths or null
 * @returns {Function} Mock which function
 */
export function mockWhich(commands = {}) {
  return async (cmd) => {
    if (commands[cmd]) {
      return commands[cmd]
    }
    throw new Error(`not found: ${cmd}`)
  }
}

/**
 * Changes the current working directory for a test
 * @param {string} newCwd - New working directory
 * @returns {Function} Function to restore original cwd
 */
export function changeCwd(newCwd) {
  let originalCwd
  try {
    originalCwd = process.cwd()
  } catch {
    // If we can't even get cwd, return a no-op
    return () => {}
  }

  try {
    process.chdir(newCwd)
  } catch (error) {
    // If we can't change to the new directory, don't change at all
    return () => {} // No-op restore function
  }

  return () => {
    try {
      process.chdir(originalCwd)
    } catch (error) {
      // If we can't restore to original, try to get to a safe directory
      try {
        process.chdir(os.homedir())
      } catch {
        // If all else fails, stay where we are
      }
    }
  }
}

/**
 * Creates a test context with common setup
 * @returns {Object} Test context object
 */
export async function createTestContext() {
  const testDir = await setupTestDir()
  const consoleMock = mockConsole()
  // Store original CWD but don't change to test directory by default
  const originalCwd = process.cwd()

  return {
    testDir,
    consoleMock,
    originalCwd,
    // Provide a method to change to test dir if needed
    changeToTestDir() {
      return changeCwd(testDir)
    },
    async cleanup() {
      // Make sure we're not in the test directory before deleting it
      const currentCwd = process.cwd()
      if (currentCwd.startsWith(testDir)) {
        try {
          process.chdir(originalCwd)
        } catch {
          try {
            process.chdir(os.homedir())
          } catch {
            // Can't change directory
          }
        }
      }

      consoleMock.restore()
      await cleanupTestDir(testDir)
    },
  }
}

/**
 * Waits for a promise with a timeout
 * @param {Promise} promise - Promise to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} message - Error message on timeout
 * @returns {Promise} The original promise or timeout error
 */
export async function withTimeout(promise, timeout = 5000, message = 'Operation timed out') {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeout)
  })

  return Promise.race([promise, timeoutPromise])
}

/**
 * Gets the absolute path to a template file
 * @param {string} filename - Template filename
 * @returns {string} Absolute path to template
 */
export function getTemplatePath(filename) {
  return path.resolve(__dirname, '..', '..', 'templates', filename)
}

/**
 * Asserts that content contains expected text
 * @param {string} content - Content to check
 * @param {string} expectedContent - Expected content
 */
export function assertFileContains(content, expectedContent) {
  if (!content.includes(expectedContent)) {
    throw new Error(`Content should contain "${expectedContent}"`)
  }
}

/**
 * Asserts that content does not contain unexpected text
 * @param {string} content - Content to check
 * @param {string} unexpectedContent - Unexpected content
 */
export function assertFileDoesNotContain(content, unexpectedContent) {
  if (content.includes(unexpectedContent)) {
    throw new Error(`Content should not contain "${unexpectedContent}"`)
  }
}
