import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mockConsole } from '../helpers/test-utils.js'
import { getTargetFilename, CLI_CLAUDE, CLI_GEMINI } from '../../src/utils/cli-detector.js'

describe('CLI Detector', () => {
  describe('getTargetFilename()', () => {
    it('should return correct filename for claude', () => {
      assert.equal(getTargetFilename('claude'), 'CLAUDE.md')
    })

    it('should return correct filename for gemini', () => {
      assert.equal(getTargetFilename('gemini'), 'GEMINI.md')
    })

    it('should throw error for invalid CLI type', () => {
      assert.throws(
        () => getTargetFilename('invalid'),
        Error,
        'Should throw error for invalid CLI type',
      )

      assert.throws(() => getTargetFilename(''), Error, 'Should throw error for empty CLI type')

      assert.throws(() => getTargetFilename(null), Error, 'Should throw error for null CLI type')
    })

    it('should be case-sensitive', () => {
      assert.throws(() => getTargetFilename('Claude'), Error, 'Should throw error for wrong case')

      assert.throws(() => getTargetFilename('GEMINI'), Error, 'Should throw error for wrong case')
    })
  })

  // Note: Testing detectCLI, determineCLI, and promptForCLI would require
  // more complex mocking of ES modules which is challenging with Node's test runner.
  // These functions are better tested through integration tests or by using
  // a more advanced testing framework that supports ES module mocking.

  describe('CLI constants', () => {
    it('should export correct constants', () => {
      assert.equal(CLI_CLAUDE, 'claude')
      assert.equal(CLI_GEMINI, 'gemini')
    })

    it('should have different values for each CLI', () => {
      assert.notEqual(CLI_CLAUDE, CLI_GEMINI)
    })
  })
})
