import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  ValidationError,
  SecurityError,
  FileOperationError,
  CLINotFoundError,
  PermissionError,
  PathTraversalError,
  CommandInjectionError,
  ProGuardianError,
  handleError,
  formatError,
  sanitizeErrorMessage
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
      const error = new ValidationError('username', 'must be alphanumeric')
      
      assert(error instanceof Error)
      assert(error instanceof ProGuardianError)
      assert(error instanceof ValidationError)
      assert.equal(error.name, 'ValidationError')
      assert.equal(error.message, 'Invalid username: must be alphanumeric')
      assert.equal(error.field, 'username')
      assert.equal(error.requirement, 'must be alphanumeric')
      assert.equal(error.code, 'VALIDATION_ERROR')
      assert(error.stack)
    })

    it('ValidationError should include sanitized value when provided', () => {
      const error = new ValidationError('email', 'must be valid', 'user@example.com')
      
      assert.equal(error.message, 'Invalid email: must be valid (got: <email>)')
      assert.equal(error.value, 'user@example.com')
    })

    it('SecurityError should have correct properties', () => {
      const error = new SecurityError('Access denied to /etc/passwd', { type: 'path-traversal' })
      
      assert(error instanceof Error)
      assert(error instanceof ProGuardianError)
      assert(error instanceof SecurityError)
      assert.equal(error.name, 'SecurityError')
      assert.equal(error.message, 'Access denied to <path>')
      assert.deepEqual(error.details, { type: 'path-traversal' })
      assert.equal(error.code, 'SECURITY_ERROR')
    })

    it('FileOperationError should have correct properties', () => {
      const error = new FileOperationError('read', '/test/file.txt', 'File not found')
      
      assert(error instanceof Error)
      assert(error instanceof ProGuardianError)
      assert(error instanceof FileOperationError)
      assert.equal(error.name, 'FileOperationError')
      assert.equal(error.message, 'File operation failed: Cannot read file.txt: File not found')
      assert.equal(error.operation, 'read')
      assert.equal(error.filePath, '/test/file.txt')
      assert.equal(error.details, 'File not found')
      assert.equal(error.code, 'FILE_OPERATION_ERROR')
    })

    it('CLINotFoundError should have correct properties', () => {
      const error = new CLINotFoundError('claude')
      
      assert(error instanceof Error)
      assert(error instanceof ProGuardianError)
      assert(error instanceof CLINotFoundError)
      assert.equal(error.name, 'CLINotFoundError')
      assert.equal(error.message, 'claude CLI not found. Please install it first.')
      assert.equal(error.cliName, 'claude')
      assert.equal(error.code, 'CLI_NOT_FOUND')
    })

    it('PermissionError should have correct properties', () => {
      const error = new PermissionError('write', '/protected/file')
      
      assert(error instanceof Error)
      assert(error instanceof ProGuardianError)
      assert(error instanceof PermissionError)
      assert.equal(error.name, 'PermissionError')
      assert.equal(error.message, 'Permission denied: Cannot write file')
      assert.equal(error.operation, 'write')
      assert.equal(error.code, 'PERMISSION_ERROR')
    })

    it('PathTraversalError should have correct properties', () => {
      const error = new PathTraversalError('../../../etc/passwd')
      
      assert(error instanceof Error)
      assert(error instanceof ProGuardianError)
      assert(error instanceof SecurityError)
      assert(error instanceof PathTraversalError)
      assert.equal(error.name, 'PathTraversalError')
      assert.equal(error.message, 'Invalid path: Path traversal attempt detected')
      assert.equal(error.attemptedPath, '../../../etc/passwd')
      assert.equal(error.code, 'SECURITY_ERROR')
    })

    it('CommandInjectionError should have correct properties', () => {
      const error = new CommandInjectionError('rm -rf /')
      
      assert(error instanceof Error)
      assert(error instanceof ProGuardianError)
      assert(error instanceof SecurityError)
      assert(error instanceof CommandInjectionError)
      assert.equal(error.name, 'CommandInjectionError')
      assert.equal(error.message, 'Invalid command: Potentially unsafe characters detected')
      assert.equal(error.command, 'rm -rf /')
      assert.equal(error.code, 'SECURITY_ERROR')
    })

    it('Error.captureStackTrace should work correctly', () => {
      const error = new ValidationError('field', 'requirement')
      const stack = error.stack
      
      assert(stack)
      assert(stack.includes('ValidationError'))
      // Stack should not include the constructor itself
      assert(!stack.includes('Error.captureStackTrace'))
    })
  })

  describe('sanitizeErrorMessage function', () => {
    it('should sanitize Unix paths', () => {
      assert.equal(
        sanitizeErrorMessage('/home/user/secret/file.txt'),
        '<path>'
      )
      assert.equal(
        sanitizeErrorMessage('Failed to read /etc/passwd'),
        'Failed to read <path>'
      )
    })

    it('should sanitize Windows paths', () => {
      assert.equal(
        sanitizeErrorMessage('C:\\Users\\Admin\\Documents\\secret.txt'),
        '<path>'
      )
      assert.equal(
        sanitizeErrorMessage('Cannot access C:/Windows/System32/config'),
        'Cannot access <path>'
      )
    })

    it('should sanitize network paths', () => {
      assert.equal(
        sanitizeErrorMessage('\\\\server\\share\\folder\\file.txt'),
        '<path>'
      )
    })

    it('should sanitize path traversal attempts', () => {
      assert.equal(
        sanitizeErrorMessage('../../../etc/passwd'),
        '<path>'
      )
      // Windows path traversal  
      const windowsPath = '..\\..\\..\\Windows\\System32'
      const result = sanitizeErrorMessage(windowsPath)
      assert.equal(result, '<path>')
    })

    it('should sanitize email addresses', () => {
      assert.equal(
        sanitizeErrorMessage('Invalid email: user@example.com'),
        'Invalid email: <email>'
      )
      assert.equal(
        sanitizeErrorMessage('Send to admin.user+tag@company.co.uk'),
        'Send to <email>'
      )
    })

    it('should sanitize IP addresses', () => {
      assert.equal(
        sanitizeErrorMessage('Connection from 192.168.1.1 failed'),
        'Connection from <ip> failed'
      )
      assert.equal(
        sanitizeErrorMessage('IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334'),
        'IPv6: <ip>'
      )
    })

    it('should sanitize IDs and tokens', () => {
      assert.equal(
        sanitizeErrorMessage('User ID: 12345678'),
        'User ID: <id>'
      )
      assert.equal(
        sanitizeErrorMessage('Token: a1b2c3d4e5f6789abcdef123456789012'),
        'Token: <token>'
      )
      assert.equal(
        sanitizeErrorMessage('Key: dGVzdCBiYXNlNjQgZW5jb2RlZCBzdHJpbmc='),
        'Key: <token>'
      )
      // Test UUID sanitization
      assert.equal(
        sanitizeErrorMessage('ID: 550e8400-e29b-41d4-a716-446655440000'),
        'ID: <uuid>'
      )
    })

    it('should handle multiple sensitive items', () => {
      const input = 'User user@example.com from 192.168.1.1 accessed /home/user/data'
      const expected = 'User <email> from <ip> accessed <path>'
      assert.equal(sanitizeErrorMessage(input), expected)
    })

    it('should handle non-string inputs', () => {
      assert.equal(sanitizeErrorMessage(null), 'null')
      assert.equal(sanitizeErrorMessage(undefined), 'undefined')
      assert.equal(sanitizeErrorMessage(123), '123')
      assert.equal(sanitizeErrorMessage({ key: 'value' }), '[object Object]')
    })

    it('should not over-sanitize normal text', () => {
      assert.equal(
        sanitizeErrorMessage('Normal error message'),
        'Normal error message'
      )
      assert.equal(
        sanitizeErrorMessage('Port 80 is standard'),
        'Port 80 is standard'
      )
    })
  })

  describe('handleError function', () => {
    it('should handle ValidationError appropriately', () => {
      const error = new ValidationError('email', 'must be valid format')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Validation failed:')))
      assert(consoleErrors.some(line => line.includes('Invalid email: must be valid format')))
      assert(!exitCalled)
    })

    it('should handle SecurityError with security message', () => {
      const error = new SecurityError('Path traversal detected in /etc/passwd', { type: 'path-traversal' })
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Security violation:')))
      assert(consoleErrors.some(line => line.includes('Path traversal detected in <path>')))
      assert(!exitCalled)
    })

    it('should handle FileOperationError with context', () => {
      const error = new FileOperationError('write', '/test/file.txt', 'Permission denied')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('FILE_OPERATION_ERROR:')))
      assert(consoleErrors.some(line => line.includes('Cannot write file.txt')))
    })

    it('should handle CLINotFoundError', () => {
      const error = new CLINotFoundError('claude')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('CLI_NOT_FOUND:')))
      assert(consoleErrors.some(line => line.includes('claude CLI not found')))
    })

    it('should handle PermissionError', () => {
      const error = new PermissionError('write', '/usr/local/bin/claude')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Permission denied:')))
      assert(consoleErrors.some(line => line.includes('Cannot write claude')))
    })

    it('should handle generic Error', () => {
      const error = new Error('Something went wrong')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('An unexpected error occurred')))
    })

    it('should show error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const error = new Error('Dev error')
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Dev error')))
      
      process.env.NODE_ENV = originalEnv
    })

    it('should show security error details in verbose development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const error = new SecurityError('Hack attempt', { ip: '192.168.1.1', path: '/etc/passwd' })
      handleError(error, { exit: false, verbose: true })
      
      assert(consoleErrors.some(line => line.includes('Security violation:')))
      assert(consoleErrors.some(line => line.includes('Details:')))
      
      process.env.NODE_ENV = originalEnv
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

    it('should not show stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      
      const error = new Error('Production error')
      error.stack = 'Error: Production error\n    at test.js:10:5'
      
      handleError(error, { exit: false, verbose: true })
      
      assert(consoleErrors.some(line => line.includes('An unexpected error occurred')))
      assert(!consoleErrors.some(line => line.includes('at test.js:10:5')))
      
      process.env.NODE_ENV = originalEnv
    })

    it('should handle null/undefined errors gracefully', () => {
      handleError(null, { exit: false })
      assert(consoleErrors.some(line => line.includes('An unexpected error occurred')))

      consoleErrors = []
      
      handleError(undefined, { exit: false })
      assert(consoleErrors.some(line => line.includes('An unexpected error occurred')))
    })

    it('should handle ProGuardianError with code', () => {
      const error = new ValidationError('username', 'too short')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Validation failed:')))
      assert(consoleErrors.some(line => line.includes('Invalid username: too short')))
    })
  })

  describe('formatError function', () => {
    it('should format error message properly', () => {
      const error = new Error('Test error message')
      const formatted = formatError(error)
      
      assert.equal(formatted, 'Test error message')
    })

    it('should include error code if present', () => {
      const error = new ProGuardianError('Test error', 'TEST_CODE')
      
      const formatted = formatError(error)
      
      assert.equal(formatted, '[TEST_CODE] Test error')
    })

    it('should handle various input types', () => {
      assert.equal(formatError('String error'), 'String error')
      assert.equal(formatError(123), '123')
      assert.equal(formatError(null), 'Unknown error')
      assert.equal(formatError(undefined), 'Unknown error')
      assert.equal(formatError({ message: 'Object with message' }), 'Object with message')
      assert.equal(formatError({}), 'Unknown error')
    })

    it('should handle errors with cause in verbose mode', () => {
      const cause = new Error('Root cause')
      const error = new Error('Main error')
      error.cause = cause
      
      const formatted = formatError(error, true)
      
      assert(formatted.includes('Main error'))
      assert(formatted.includes('Caused by: Root cause'))
    })

    it('should include stack trace in verbose mode for development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at file.js:10:5\n    at other.js:20:10'
      
      const formatted = formatError(error, true)
      
      assert(formatted.includes('Test error'))
      assert(formatted.includes('at file.js:10:5'))
      
      process.env.NODE_ENV = originalEnv
    })

    it('should not include stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at file.js:10:5'
      
      const formatted = formatError(error, true)
      
      assert.equal(formatted, 'Test error')
      assert(!formatted.includes('at file.js:10:5'))
      
      process.env.NODE_ENV = originalEnv
    })

    it('should handle nested causes', () => {
      const rootCause = new Error('Database error')
      const middleCause = new Error('Repository error')
      middleCause.cause = rootCause
      const error = new Error('Service error')
      error.cause = middleCause
      
      const formatted = formatError(error, true)
      
      assert(formatted.includes('Service error'))
      assert(formatted.includes('Caused by: Repository error'))
      assert(formatted.includes('Caused by: Database error'))
    })

    it('should format ProGuardianError subclasses correctly', () => {
      const validationError = new ValidationError('email', 'invalid format')
      assert.equal(formatError(validationError), '[VALIDATION_ERROR] Invalid email: invalid format')
      
      const securityError = new SecurityError('Suspicious activity from 192.168.1.1')
      assert.equal(formatError(securityError), '[SECURITY_ERROR] Suspicious activity from <ip>')
      
      const fileError = new FileOperationError('read', '/secret/data.txt', 'Access denied')
      assert.equal(formatError(fileError), '[FILE_OPERATION_ERROR] File operation failed: Cannot read data.txt: Access denied')
    })
  })

  describe('Error Integration', () => {
    it('should handle real-world security scenarios', () => {
      // Simulate a path traversal attempt
      const error = new PathTraversalError('../../../etc/passwd')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Security violation:')))
      assert(consoleErrors.some(line => line.includes('Path traversal attempt detected')))
      assert(!consoleErrors.some(line => line.includes('../../../etc/passwd'))) // Should not leak the path
    })

    it('should handle command injection attempts', () => {
      const error = new CommandInjectionError('rm -rf / --no-preserve-root')
      
      handleError(error, { exit: false })
      
      assert(consoleErrors.some(line => line.includes('Security violation:')))
      assert(consoleErrors.some(line => line.includes('Potentially unsafe characters detected')))
      assert(!consoleErrors.some(line => line.includes('rm -rf'))) // Should not leak the command
    })

    it('should properly sanitize multiple sensitive data types', () => {
      const error = new SecurityError(
        'User admin@company.com from 192.168.1.100 tried to access /home/admin/secrets.txt',
        { user: 'admin@company.com', ip: '192.168.1.100', path: '/home/admin/secrets.txt' }
      )
      
      handleError(error, { exit: false })
      
      const errorOutput = consoleErrors.join(' ')
      assert(errorOutput.includes('<email>'))
      assert(errorOutput.includes('<ip>'))
      assert(errorOutput.includes('<path>'))
      assert(!errorOutput.includes('admin@company.com'))
      assert(!errorOutput.includes('192.168.1.100'))
      assert(!errorOutput.includes('/home/admin/secrets.txt'))
    })

    it('should test inheritance chain', () => {
      const error = new PathTraversalError('../../etc/passwd')
      
      assert(error instanceof Error)
      assert(error instanceof ProGuardianError)
      assert(error instanceof SecurityError)
      assert(error instanceof PathTraversalError)
      
      // Should have all expected properties
      assert.equal(error.name, 'PathTraversalError')
      assert.equal(error.code, 'SECURITY_ERROR')
      assert(error.message)
      assert(error.stack)
    })
  })
})