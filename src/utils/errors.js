/**
 * Custom error classes for ProGuardian CLI
 * These provide specific error types for better error handling and security
 */

/**
 * Sanitize error messages to prevent information disclosure
 */
function sanitizeErrorMessage(message) {
  // Remove absolute paths
  let safe = message.replace(/\/[\w\-/]+\//g, '<path>/')

  // Remove potential sensitive data patterns
  safe = safe.replace(/\b\d{4,}\b/g, '<id>') // IDs
  safe = safe.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '<email>') // Emails
  safe = safe.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>') // IPs

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
  constructor(field, value, requirement) {
    const message = `Invalid ${field}: ${requirement}`
    super(message, 'VALIDATION_ERROR')
    this.field = field
    this.requirement = requirement
  }
}

export class PermissionError extends ProGuardianError {
  constructor(operation, path) {
    // Don't expose full paths in error messages
    const safePath = path ? path.split('/').pop() : 'file'
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
  constructor(_command) {
    super('Invalid command: Potentially unsafe characters detected')
  }
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
