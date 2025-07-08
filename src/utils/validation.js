/**
 * Input validation utilities for ProGuardian CLI
 * Provides comprehensive validation for all user inputs
 */

import path from 'path'
import { ValidationError, PathTraversalError, CommandInjectionError } from './errors.js'

// Valid CLI types that we support
const VALID_CLI_TYPES = ['claude', 'gemini']

// Command option schemas
const OPTION_SCHEMAS = {
  init: {
    force: { type: 'boolean', required: false },
    cli: { type: 'string', required: false, enum: VALID_CLI_TYPES },
    verbose: { type: 'boolean', required: false },
    baseDir: { type: 'string', required: false }, // For testing
    path: { type: 'string', required: false }, // Custom path for the file
  },
  check: {
    fix: { type: 'boolean', required: false },
    verbose: { type: 'boolean', required: false },
  },
  'install-wrapper': {
    global: { type: 'boolean', required: false },
    force: { type: 'boolean', required: false },
    verbose: { type: 'boolean', required: false },
  },
}

/**
 * Validate command options against schema
 */
export function validateOptions(command, options) {
  const schema = OPTION_SCHEMAS[command]
  if (!schema) {
    throw new ValidationError('command', command, 'Unknown command')
  }

  // Check for unknown options
  const validKeys = Object.keys(schema)
  const providedKeys = Object.keys(options)
  const unknownKeys = providedKeys.filter((key) => !validKeys.includes(key))

  if (unknownKeys.length > 0) {
    throw new ValidationError('options', unknownKeys.join(', '), 'Unknown options provided')
  }

  // Validate each option
  for (const [key, rules] of Object.entries(schema)) {
    const value = options[key]

    // Check required
    if (rules.required && value === undefined) {
      throw new ValidationError(key, 'undefined', 'This option is required')
    }

    // Skip validation if not provided and not required
    if (value === undefined) continue

    // Type validation
    if (rules.type === 'boolean' && typeof value !== 'boolean') {
      throw new ValidationError(key, value, 'Must be a boolean')
    }

    if (rules.type === 'string' && typeof value !== 'string') {
      throw new ValidationError(key, value, 'Must be a string')
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      throw new ValidationError(key, value, `Must be one of: ${rules.enum.join(', ')}`)
    }
  }

  return true
}

/**
 * Validate and sanitize file paths to prevent path traversal
 */
export function validateSafePath(targetPath, basePath = process.cwd()) {
  if (!targetPath) {
    throw new ValidationError('path', targetPath, 'Path cannot be empty')
  }

  // Resolve to absolute paths
  const resolvedTarget = path.resolve(basePath, targetPath)
  const resolvedBase = path.resolve(basePath)

  // Ensure the target is within the base directory
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new PathTraversalError(targetPath)
  }

  // Additional checks for suspicious patterns
  const suspicious = ['..', './', '~', '$', '`', '|', ';', '&', '>', '<', '\\']
  const normalizedPath = path.normalize(targetPath)

  for (const pattern of suspicious) {
    if (normalizedPath.includes(pattern)) {
      throw new PathTraversalError(targetPath)
    }
  }

  return resolvedTarget
}

/**
 * Sanitize paths for safe usage
 */
export function sanitizePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new ValidationError('path', inputPath, 'Path must be a non-empty string')
  }

  // Check for null bytes before sanitizing
  if (inputPath.includes('\0')) {
    throw new PathTraversalError(inputPath)
  }

  // Normalize the path
  let sanitized = path.normalize(inputPath)

  // Remove leading/trailing whitespace
  sanitized = sanitized.trim()

  // Validate the sanitized path
  return validateSafePath(sanitized)
}

/**
 * Validate CLI type selection
 */
export function validateCLIType(cliType) {
  if (!cliType) {
    throw new ValidationError('cliType', cliType, 'CLI type cannot be empty')
  }

  if (!VALID_CLI_TYPES.includes(cliType)) {
    throw new ValidationError('cliType', cliType, `Must be one of: ${VALID_CLI_TYPES.join(', ')}`)
  }

  return cliType
}

/**
 * Validate command strings to prevent injection
 */
export function validateCommand(command) {
  if (!command || typeof command !== 'string') {
    throw new ValidationError('command', command, 'Command must be a non-empty string')
  }

  // Dangerous characters that could lead to command injection
  const dangerousChars = ['|', ';', '&', '$', '`', '>', '<', '(', ')', '{', '}', '[', ']']

  // Check for actual newline characters (not escaped ones)
  if (command.includes('\n') || command.includes('\r')) {
    throw new CommandInjectionError(command)
  }

  for (const char of dangerousChars) {
    if (command.includes(char)) {
      throw new CommandInjectionError(command)
    }
  }

  return command
}

/**
 * Validate JSON content
 */
export function validateJSON(content, schema = null) {
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content

    if (schema) {
      // Basic schema validation
      for (const [key, rules] of Object.entries(schema)) {
        if (rules.required && !(key in parsed)) {
          throw new ValidationError(key, 'undefined', 'Required field missing')
        }

        if (key in parsed && rules.type) {
          const actualType = Array.isArray(parsed[key]) ? 'array' : typeof parsed[key]
          if (actualType !== rules.type) {
            throw new ValidationError(key, parsed[key], `Expected type ${rules.type}`)
          }
        }
      }
    }

    return parsed
  } catch (error) {
    if (error instanceof ValidationError) throw error
    throw new ValidationError('json', 'invalid', 'Invalid JSON format')
  }
}

/**
 * Escape shell arguments safely
 */
export function escapeShellArg(arg) {
  if (!arg) return '""'

  // Convert to string and escape single quotes
  const str = String(arg)

  // If contains special characters, wrap in single quotes
  if (/[^A-Za-z0-9_.,@:/-]/.test(str)) {
    return `'${str.replace(/'/g, "'\"'\"'")}'`
  }

  return str
}
