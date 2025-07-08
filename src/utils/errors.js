/**
 * Custom error classes for ProGuardian CLI
 * These provide specific error types for better error handling and security
 */

import path from 'path'

/**
 * Sanitize error messages to prevent information disclosure
 */
export function sanitizeErrorMessage(message) {
  if (typeof message !== 'string') {
    return String(message)
  }

  let safe = message

  // Remove IPv6 addresses FIRST (before ID replacement)
  // Full IPv6 pattern
  safe = safe.replace(/([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}/g, '<ip>')
  // Compressed IPv6 patterns
  safe = safe.replace(/([0-9a-fA-F]{1,4}:){1,7}:/g, '<ip>')
  safe = safe.replace(/:([0-9a-fA-F]{1,4}:){1,7}/g, '<ip>')
  // Any remaining IPv6-like patterns
  safe = safe.replace(/([0-9a-fA-F]{1,4}:){2,}[0-9a-fA-F]{0,4}/g, '<ip>')

  // Remove paths - handle relative paths FIRST to avoid partial matches
  // Relative paths: ../path or ./path (must have at least one slash)
  safe = safe.replace(/\.{1,2}([\\/][^\s"'<>|]*)+/g, '<path>')
  
  // Then handle absolute paths
  // Windows absolute paths: C:\path or C:/path
  safe = safe.replace(/[a-zA-Z]:[\\//][^\s"'<>|]+/g, '<path>')
  // Unix absolute paths: /path (but not if it's already <path>)
  safe = safe.replace(/(?<!<path>)\/[^\s"'<>|]+/g, '<path>')
  // Windows UNC paths: \\server\share
  safe = safe.replace(/\\\\[^\s"'<>|]+/g, '<path>')

  // Remove UUIDs BEFORE other ID replacements
  safe = safe.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '<uuid>')

  // Remove potential sensitive data patterns
  safe = safe.replace(/\b\d{4,}\b/g, '<id>') // IDs (4+ digits)
  safe = safe.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '<email>') // Emails
  safe = safe.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>') // IPv4 addresses
  
  // Remove potential tokens/secrets (long hex strings, base64-like strings)
  safe = safe.replace(/\b[a-fA-F0-9]{32,}\b/g, '<token>') // Hex tokens (32+ chars)
  safe = safe.replace(/[A-Za-z0-9+/]{20,}={0,2}/g, '<token>') // Base64-like tokens

  return safe
}

export class ProGuardianError extends Error {
  constructor(message, code) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    Error.captureStackTrace(this, this.constructor)
  }
}

export class SecurityError extends ProGuardianError {
  constructor(message, details = {}) {
    // Never expose sensitive details in error messages
    const safeMessage = sanitizeErrorMessage(message)
    super(safeMessage, 'SECURITY_ERROR')
    this.details = details
  }
}

export class ValidationError extends ProGuardianError {
  constructor(field, requirement, value = undefined) {
    // Include sanitized value in message if provided
    let message = `Invalid ${field}: ${requirement}`
    if (value !== undefined) {
      const sanitizedValue = sanitizeErrorMessage(String(value))
      message += ` (got: ${sanitizedValue})`
    }
    super(message, 'VALIDATION_ERROR')
    this.field = field
    this.requirement = requirement
    this.value = value
  }
}

export class PermissionError extends ProGuardianError {
  constructor(operation, filePath) {
    // Don't expose full paths in error messages
    // Use path.basename for cross-platform compatibility
    const safePath = filePath ? path.basename(filePath) : 'file'
    const message = `Permission denied: Cannot ${operation} ${safePath}`
    super(message, 'PERMISSION_ERROR')
    this.operation = operation
  }
}

export class PathTraversalError extends SecurityError {
  constructor(attemptedPath) {
    super('Invalid path: Path traversal attempt detected')
    this.attemptedPath = attemptedPath
  }
}

export class CommandInjectionError extends SecurityError {
  constructor(command) {
    super('Invalid command: Potentially unsafe characters detected')
    this.command = command // Store for debugging, but don't expose in message
  }
}

export class FileOperationError extends ProGuardianError {
  constructor(operation, filePath, details) {
    const safePath = filePath ? path.basename(filePath) : 'file'
    const message = `File operation failed: Cannot ${operation} ${safePath}${details ? ': ' + details : ''}`
    super(message, 'FILE_OPERATION_ERROR')
    this.operation = operation
    this.filePath = filePath
    this.details = details
  }
}

export class CLINotFoundError extends ProGuardianError {
  constructor(cliName) {
    super(`${cliName} CLI not found. Please install it first.`, 'CLI_NOT_FOUND')
    this.cliName = cliName
  }
}

/**
 * Format error for display
 */
export function formatError(error, verbose = false) {
  if (!error) {
    return 'Unknown error'
  }

  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'number') {
    return String(error)
  }

  let result = error.message || 'Unknown error'

  if (error.code) {
    result = `[${error.code}] ${result}`
  }

  if (verbose && error.cause) {
    result += '\nCaused by: ' + formatError(error.cause, verbose)
  }

  if (verbose && error.stack && process.env.NODE_ENV === 'development') {
    result += '\n' + error.stack
  }

  return result
}

/**
 * Handle errors consistently across the application
 */
export function handleError(error, options = {}) {
  const { exit = true, verbose = false } = options

  if (error instanceof SecurityError) {
    console.error('Security violation:', error.message)
    if (verbose && process.env.NODE_ENV === 'development') {
      console.error('Details:', error.details)
    }
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.message)
  } else if (error instanceof PermissionError) {
    console.error('Permission denied:', error.message)
  } else if (error instanceof ProGuardianError) {
    console.error(`${error.code}:`, error.message)
  } else {
    // Unknown errors - don't expose stack traces in production
    console.error('An unexpected error occurred')
    if (verbose || process.env.NODE_ENV === 'development') {
      console.error(error)
    }
  }

  if (exit) {
    process.exit(1)
  }
}
