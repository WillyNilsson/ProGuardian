/**
 * Secure file operation utilities for ProGuardian CLI
 * Provides safe file operations with permission checks and atomic writes
 */

import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import { promisify } from 'util'
import { PermissionError, SecurityError, ValidationError } from './errors.js'
import { validateSafePath } from './validation.js'

const access = promisify(fs.access)

/**
 * Check if we have required permissions for a file operation
 */
export async function checkPermissions(filePath, mode) {
  try {
    await access(filePath, mode)
    return true
  } catch {
    return false
  }
}

/**
 * Safely read a file with validation and permission checks
 */
export async function secureReadFile(filePath, options = {}) {
  const { encoding = 'utf-8', maxSize = 10 * 1024 * 1024 } = options // 10MB default max

  // Validate path
  const safePath = validateSafePath(filePath)

  // Check read permissions
  if (!(await checkPermissions(safePath, fs.constants.R_OK))) {
    throw new PermissionError('read', filePath)
  }

  // Check file size to prevent memory exhaustion
  const stats = await fs.stat(safePath)
  if (stats.size > maxSize) {
    throw new SecurityError(
      `File too large: ${stats.size} bytes exceeds maximum of ${maxSize} bytes`,
    )
  }

  // Read the file
  return fs.readFile(safePath, encoding)
}

/**
 * Safely write a file with atomic operations
 */
export async function secureWriteFile(filePath, content, options = {}) {
  const { encoding = 'utf-8', mode = 0o644 } = options

  // Validate path
  const safePath = validateSafePath(filePath)
  const dir = path.dirname(safePath)

  // Ensure directory exists and we can write to it
  await fs.ensureDir(dir)

  // Check write permissions on directory
  if (!(await checkPermissions(dir, fs.constants.W_OK))) {
    throw new PermissionError('write to directory', dir)
  }

  // If file exists, check write permissions
  if (await fs.pathExists(safePath)) {
    if (!(await checkPermissions(safePath, fs.constants.W_OK))) {
      throw new PermissionError('write', filePath)
    }
  }

  // Write atomically using a temporary file
  const tmpPath = `${safePath}.tmp.${crypto.randomBytes(6).toString('hex')}`

  try {
    // Write to temporary file
    await fs.writeFile(tmpPath, content, { encoding, mode })

    // Atomically rename to target
    await fs.rename(tmpPath, safePath)
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tmpPath)
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}

/**
 * Safely copy a file with validation
 */
export async function secureCopyFile(source, destination, options = {}) {
  const { overwrite = false } = options

  // Validate paths
  const safeSource = validateSafePath(source)
  const safeDestination = validateSafePath(destination)

  // Check source exists and is readable
  if (!(await fs.pathExists(safeSource))) {
    throw new ValidationError('source', source, 'File does not exist')
  }

  if (!(await checkPermissions(safeSource, fs.constants.R_OK))) {
    throw new PermissionError('read', source)
  }

  // Check destination
  if ((await fs.pathExists(safeDestination)) && !overwrite) {
    throw new ValidationError('destination', destination, 'File already exists')
  }

  const destDir = path.dirname(safeDestination)
  await fs.ensureDir(destDir)

  if (!(await checkPermissions(destDir, fs.constants.W_OK))) {
    throw new PermissionError('write to directory', destDir)
  }

  // Perform the copy
  await fs.copy(safeSource, safeDestination, { overwrite })
}

/**
 * Safely create a directory
 */
export async function secureCreateDir(dirPath, options = {}) {
  const { mode = 0o755 } = options

  // Validate path
  const safePath = validateSafePath(dirPath)
  const parentDir = path.dirname(safePath)

  // Check parent directory permissions
  if (await fs.pathExists(parentDir)) {
    if (!(await checkPermissions(parentDir, fs.constants.W_OK))) {
      throw new PermissionError('create directory in', parentDir)
    }
  }

  // Create directory
  await fs.ensureDir(safePath, mode)
}

/**
 * Safely check if a path exists
 */
export async function securePathExists(filePath) {
  try {
    const safePath = validateSafePath(filePath)
    return await fs.pathExists(safePath)
  } catch {
    // Path validation failed - treat as not existing
    return false
  }
}

/**
 * Safely read JSON file
 */
export async function secureReadJSON(filePath, options = {}) {
  const content = await secureReadFile(filePath, options)

  try {
    return JSON.parse(content)
  } catch {
    throw new ValidationError('json', filePath, 'Invalid JSON format')
  }
}

/**
 * Safely write JSON file
 */
export async function secureWriteJSON(filePath, data, options = {}) {
  const { spaces = 2, ...writeOptions } = options

  let content
  try {
    content = JSON.stringify(data, null, spaces)
  } catch {
    throw new ValidationError('data', 'object', 'Cannot serialize to JSON')
  }

  await secureWriteFile(filePath, content, writeOptions)
}

/**
 * Get file stats safely
 */
export async function secureGetStats(filePath) {
  const safePath = validateSafePath(filePath)

  if (!(await fs.pathExists(safePath))) {
    throw new ValidationError('path', filePath, 'File does not exist')
  }

  return fs.stat(safePath)
}

/**
 * List directory contents safely
 */
export async function secureReadDir(dirPath, options = {}) {
  const { withFileTypes = false } = options

  const safePath = validateSafePath(dirPath)

  if (!(await checkPermissions(safePath, fs.constants.R_OK))) {
    throw new PermissionError('read directory', dirPath)
  }

  const stats = await fs.stat(safePath)
  if (!stats.isDirectory()) {
    throw new ValidationError('path', dirPath, 'Not a directory')
  }

  return fs.readdir(safePath, { withFileTypes })
}
