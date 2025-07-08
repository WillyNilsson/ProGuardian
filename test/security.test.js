import { describe, it } from 'node:test'
import assert from 'assert'
import {
  validateSafePath,
  sanitizePath,
  validateCLIType,
  validateCommand,
  validateOptions,
  escapeShellArg,
} from '../src/utils/validation.js'
import { PathTraversalError, ValidationError, CommandInjectionError } from '../src/utils/errors.js'
import { securePathExists } from '../src/utils/file-security.js'
import path from 'path'

describe('Security Tests', () => {
  describe('Path Traversal Protection', () => {
    it('should reject paths with ..', () => {
      assert.throws(() => {
        validateSafePath('../../../etc/passwd')
      }, PathTraversalError)
    })

    it('should reject paths with ./', () => {
      assert.throws(() => {
        validateSafePath('./../../sensitive')
      }, PathTraversalError)
    })

    it('should reject absolute paths outside cwd', () => {
      assert.throws(() => {
        validateSafePath('/etc/passwd')
      }, PathTraversalError)
    })

    it('should accept valid relative paths', () => {
      const safePath = validateSafePath('src/utils/test.js')
      assert(safePath.startsWith(process.cwd()))
    })

    it('should accept paths within project', () => {
      const safePath = validateSafePath('templates/CLAUDE.md')
      assert(safePath.includes('templates'))
    })
  })

  describe('Input Validation', () => {
    it('should validate CLI types', () => {
      assert.equal(validateCLIType('claude'), 'claude')
      assert.equal(validateCLIType('gemini'), 'gemini')

      assert.throws(() => {
        validateCLIType('invalid')
      }, ValidationError)
    })

    it('should validate command options', () => {
      assert.doesNotThrow(() => {
        validateOptions('init', { force: true, cli: 'claude' })
      })

      assert.throws(() => {
        validateOptions('init', { invalidOption: true })
      }, ValidationError)
    })

    it('should validate boolean options', () => {
      assert.throws(() => {
        validateOptions('init', { force: 'not-a-boolean' })
      }, ValidationError)
    })
  })

  describe('Command Injection Prevention', () => {
    it('should reject commands with pipe', () => {
      assert.throws(() => {
        validateCommand('ls | cat /etc/passwd')
      }, CommandInjectionError)
    })

    it('should reject commands with semicolon', () => {
      assert.throws(() => {
        validateCommand('ls; rm -rf /')
      }, CommandInjectionError)
    })

    it('should reject commands with backticks', () => {
      assert.throws(() => {
        validateCommand('echo `cat /etc/passwd`')
      }, CommandInjectionError)
    })

    it('should reject commands with dollar expressions', () => {
      assert.throws(() => {
        validateCommand('echo $(whoami)')
      }, CommandInjectionError)
    })

    it('should accept clean commands', () => {
      assert.equal(validateCommand('node index.js'), 'node index.js')
      assert.equal(validateCommand('npm test'), 'npm test')
    })
  })

  describe('Shell Argument Escaping', () => {
    it('should escape single quotes', () => {
      const escaped = escapeShellArg("test'file")
      assert(escaped.includes("'\"'\"'"))
    })

    it('should handle spaces', () => {
      const escaped = escapeShellArg('file with spaces.txt')
      assert(escaped.startsWith("'"))
      assert(escaped.endsWith("'"))
    })

    it('should handle special characters', () => {
      const escaped = escapeShellArg('file$name')
      assert(escaped.startsWith("'"))
    })

    it('should handle empty strings', () => {
      const escaped = escapeShellArg('')
      assert.equal(escaped, '""')
    })
  })

  describe('Path Sanitization', () => {
    it('should remove null bytes', () => {
      assert.throws(() => {
        sanitizePath('file\0name.txt')
      }, PathTraversalError)
    })

    it('should normalize paths', () => {
      const result = sanitizePath('src//utils///file.js')
      assert(result.includes(path.join('src', 'utils', 'file.js')))
    })

    it('should trim whitespace', () => {
      const result = sanitizePath('  file.txt  ')
      assert(result.endsWith('file.txt'))
    })

    it('should reject empty paths', () => {
      assert.throws(() => {
        sanitizePath('')
      }, ValidationError)
    })
  })

  describe('File Operations Security', () => {
    it('should safely check path existence', async () => {
      // Should not throw for valid paths
      const exists = await securePathExists('package.json')
      assert(typeof exists === 'boolean')
    })

    it('should return false for invalid paths', async () => {
      const exists = await securePathExists('../../../etc/passwd')
      assert.equal(exists, false)
    })
  })
})

// Run specific security scenario tests
describe('Security Scenarios', () => {
  it('should prevent directory traversal attacks', () => {
    const attacks = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      'valid/../../../../../../etc/shadow',
      './././../../../root',
      '~/../../root',
      '$HOME/../../etc',
    ]

    for (const attack of attacks) {
      assert.throws(
        () => {
          validateSafePath(attack)
        },
        PathTraversalError,
        `Failed to block: ${attack}`,
      )
    }
  })

  it('should prevent command injection attacks', () => {
    const attacks = [
      'echo test; cat /etc/passwd',
      'echo test | grep password',
      'echo test && rm -rf /',
      'echo test || whoami',
      'echo `cat /etc/passwd`',
      'echo $(id)',
      'echo test > /etc/passwd',
      'echo test < /etc/passwd',
      'echo {test,../../etc/passwd}',
      'echo test\ncat /etc/passwd',
    ]

    for (const attack of attacks) {
      assert.throws(
        () => {
          validateCommand(attack)
        },
        CommandInjectionError,
        `Failed to block: ${attack}`,
      )
    }
  })
})
