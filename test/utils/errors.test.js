import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  ValidationError,
  SecurityError,
  FileOperationError,
  CLINotFoundError,
  PermissionError,
  handleError,
  formatError
} from '../../src/utils/errors.js'

describe('Error Utilities Tests', () => {
  let originalConsoleError
  let originalProcessExit
  let consoleErrors
  let exitCalled
  let exitCode

  before(() => {
    // Mock console.error and process.exit
    originalConsoleError = console.error
    originalProcessExit = process.exit
  })

  after(() => {
    // Restore original methods
    console.error = originalConsoleError
    process.exit = originalProcessExit
  })

  beforeEach(() => {
    consoleErrors = []
    exitCalled = false
    exitCode = null

    console.error = (...args) => {
      consoleErrors.push(args.join(' '))
    }

    process.exit = (code) => {
      exitCalled = true
      exitCode = code
    }
  })

  describe('Custom Error Classes', () => {
    it('ValidationError should have correct properties', () => {
      const error = new ValidationError('Invalid input', 'username')
      
      assert(error instanceof Error)
      assert(error instanceof ValidationError)
      assert.equal(error.name, 'ValidationError')
      assert.equal(error.message, 'Invalid input')
      assert.equal(error.field, 'username')
      assert.equal(error.code, 'VALIDATION_ERROR')
    })

    it('SecurityError should have correct properties', () => {
      const error = new SecurityError('Access denied', 'path-traversal')
      
      assert(error instanceof Error)
      assert(error instanceof SecurityError)
      assert.equal(error.name, 'SecurityError')
      assert.equal(error.message, 'Access denied')
      assert.equal(error.violation, 'path-traversal')
      assert.equal(error.code, 'SECURITY_ERROR')
    })

    it('FileOperationError should have correct properties', () => {
      const error = new FileOperationError('read', '/test/file.txt', 'File not found')
      
      assert(error instanceof Error)
      assert(error instanceof FileOperationError)
      assert.equal(error.name, 'FileOperationError')
      assert.equal(error.message, 'Failed to read /test/file.txt: File not found')
      assert.equal(error.operation, 'read')
      assert.equal(error.path, '/test/file.txt')
      assert.equal(error.code, 'FILE_OPERATION_ERROR')
    })

    it('CLINotFoundError should have correct properties', () => {
      const error = new CLINotFoundError('claude')
      
      assert(error instanceof Error)
      assert(error instanceof CLINotFoundError)
      assert.equal(error.name, 'CLINotFoundError')
      assert.equal(error.message, 'CLI tool "claude" not found in PATH')
      assert.equal(error.cli, 'claude')
      assert.equal(error.code, 'CLI_NOT_FOUND')
    })

    it('PermissionError should have correct properties', () => {
      const error = new PermissionError('write', '/protected/file')
      
      assert(error instanceof Error)
      assert(error instanceof PermissionError)
      assert.equal(error.name, 'PermissionError')
      assert.equal(error.message, 'Permission denied to write /protected/file')
      assert.equal(error.operation, 'write')
      assert.equal(error.resource, '/protected/file')
      assert.equal(error.code, 'PERMISSION_ERROR')
    })
  })

  describe('handleError function', () => {
    it('should handle ValidationError appropriately', () => {
      const error = new ValidationError('Invalid email format', 'email')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Validation Error:')))
      assert(consoleErrors.some(line => line.includes('Invalid email format')))
      assert(consoleErrors.some(line => line.includes('Field: email')))
      assert(!exitCalled)
    })

    it('should handle SecurityError with security message', () => {
      const error = new SecurityError('Path traversal detected', 'path-traversal')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Security Violation:')))
      assert(consoleErrors.some(line => line.includes('Path traversal detected')))
      assert(consoleErrors.some(line => line.includes('This appears to be a security issue')))
    })

    it('should handle FileOperationError with context', () => {
      const error = new FileOperationError('write', '/test/file.txt', 'Permission denied')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('File Operation Error:')))
      assert(consoleErrors.some(line => line.includes('Failed to write /test/file.txt')))
    })

    it('should handle CLINotFoundError with installation instructions', () => {
      const error = new CLINotFoundError('claude')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('CLI Not Found:')))
      assert(consoleErrors.some(line => line.includes('claude')))
      assert(consoleErrors.some(line => line.includes('installation instructions')))
    })

    it('should handle PermissionError with sudo suggestion', () => {
      const error = new PermissionError('write', '/usr/local/bin/claude')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Permission Error:')))
      assert(consoleErrors.some(line => line.includes('Permission denied')))
      assert(consoleErrors.some(line => line.includes('Try running with sudo')))
    })

    it('should handle generic Error', () => {
      const error = new Error('Something went wrong')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Error:')))
      assert(consoleErrors.some(line => line.includes('Something went wrong')))
    })

    it('should show stack trace in verbose mode', () => {
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at test.js:10:5'
      
      handleError(error, { exit: false, verbose: true })
      
      assert(consoleErrors.some(line => line.includes('Stack trace:')))
      assert(consoleErrors.some(line => line.includes('at test.js:10:5')))
    })

    it('should exit when exit option is true', () => {
      const error = new Error('Fatal error')
      
      handleError(error, { exit: true })
      
      assert(exitCalled)
      assert.equal(exitCode, 1)
    })

    it('should not exit when exit option is false', () => {
      const error = new Error('Non-fatal error')
      
      handleError(error, { exit: false })
      
      assert(!exitCalled)
    })

    it('should handle errors with cause', () => {
      const cause = new Error('Root cause')
      const error = new Error('High level error', { cause })
      
      handleError(error, { exit: false, verbose: true })
      
      assert(consoleErrors.some(line => line.includes('High level error')))
      assert(consoleErrors.some(line => line.includes('Caused by:')))
      assert(consoleErrors.some(line => line.includes('Root cause')))
    })

    it('should handle null/undefined errors gracefully', () => {
      handleError(null, { exit: false })
      assert(consoleErrors.some(line => line.includes('Unknown error occurred')))

      consoleErrors = []
      
      handleError(undefined, { exit: false })
      assert(consoleErrors.some(line => line.includes('Unknown error occurred')))
    })

    it('should handle errors with custom codes', () => {
      const error = new Error('Custom error')
      error.code = 'ENOENT'
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Code: ENOENT')))
    })
  })

  describe('formatError function', () => {
    it('should format error message properly', () => {
      const error = new Error('Test error message')
      const formatted = formatError(error)
      
      assert(formatted.includes('Test error message'))
    })

    it('should include error code if present', () => {
      const error = new Error('Test error')
      error.code = 'TEST_CODE'
      
      const formatted = formatError(error)
      
      assert(formatted.includes('Code: TEST_CODE'))
    })

    it('should include field for ValidationError', () => {
      const error = new ValidationError('Invalid value', 'testField')
      const formatted = formatError(error)
      
      assert(formatted.includes('Field: testField'))
    })

    it('should include operation for FileOperationError', () => {
      const error = new FileOperationError('read', '/test/path', 'Not found')
      const formatted = formatError(error)
      
      assert(formatted.includes('Operation: read'))
      assert(formatted.includes('Path: /test/path'))
    })

    it('should include stack trace in verbose mode', () => {
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at file.js:10:5\n    at other.js:20:10'
      
      const formatted = formatError(error, true)
      
      assert(formatted.includes('Stack trace:'))
      assert(formatted.includes('at file.js:10:5'))
      assert(formatted.includes('at other.js:20:10'))
    })

    it('should format errors with cause', () => {
      const cause = new Error('Root cause')
      const error = new Error('Main error', { cause })
      
      const formatted = formatError(error, true)
      
      assert(formatted.includes('Main error'))
      assert(formatted.includes('Caused by:'))
      assert(formatted.includes('Root cause'))
    })

    it('should handle circular references in error objects', () => {
      const error = new Error('Circular error')
      error.circular = error // Create circular reference
      
      // Should not throw
      const formatted = formatError(error)
      assert(formatted.includes('Circular error'))
    })

    it('should handle non-Error objects', () => {
      const formatted = formatError('String error')
      assert(formatted.includes('String error'))
      
      const formatted2 = formatError({ message: 'Object error' })
      assert(formatted2.includes('Object error'))
      
      const formatted3 = formatError(null)
      assert(formatted3.includes('Unknown error'))
    })
  })

  describe('Error Integration', () => {
    it('should properly chain handleError with custom errors', () => {
      const rootCause = new Error('Database connection failed')
      const fileError = new FileOperationError('read', '/config/db.json', rootCause.message)
      fileError.cause = rootCause
      
      handleError(fileError, { exit: false, verbose: true })
      
      assert(consoleErrors.some(line => line.includes('File Operation Error')))
      assert(consoleErrors.some(line => line.includes('Failed to read /config/db.json')))
      assert(consoleErrors.some(line => line.includes('Database connection failed')))
    })

    it('should handle nested validation errors', () => {
      const innerError = new ValidationError('Must be positive', 'age')
      const outerError = new ValidationError('Invalid user data', 'user')
      outerError.cause = innerError
      
      handleError(outerError, { exit: false, verbose: true })
      
      assert(consoleErrors.some(line => line.includes('Invalid user data')))
      assert(consoleErrors.some(line => line.includes('Field: user')))
      assert(consoleErrors.some(line => line.includes('Must be positive')))
      assert(consoleErrors.some(line => line.includes('Field: age')))
    })
  })
})