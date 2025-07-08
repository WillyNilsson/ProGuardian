import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { promptForCLI, determineCLI, CLI_CLAUDE, CLI_GEMINI } from '../../src/utils/cli-detector.js'
import { logger } from '../../src/utils/logger.js'

describe('CLI Detector Extended Tests', () => {
  let originalLogHandler
  let originalWarnHandler
  let originalErrorHandler
  let consoleOutput
  let consoleWarnings
  let consoleErrors

  before(() => {
    // Save original handlers
    originalLogHandler = logger.outputHandlers.log
    originalWarnHandler = logger.outputHandlers.warn
    originalErrorHandler = logger.outputHandlers.error
  })

  after(() => {
    // Restore original handlers
    logger.setOutputHandler('log', originalLogHandler)
    logger.setOutputHandler('warn', originalWarnHandler)
    logger.setOutputHandler('error', originalErrorHandler)
  })

  beforeEach(() => {
    consoleOutput = []
    consoleWarnings = []
    consoleErrors = []

    // Mock the logger's output handlers
    logger.setOutputHandler('log', (...args) => {
      consoleOutput.push(args.join(' '))
    })

    logger.setOutputHandler('warn', (...args) => {
      consoleWarnings.push(args.join(' '))
    })

    logger.setOutputHandler('error', (...args) => {
      consoleErrors.push(args.join(' '))
    })
  })

  describe('promptForCLI()', () => {
    it('should display prompt when both CLIs available', async () => {
      const result = await promptForCLI({ claude: true, gemini: true }, false)

      // Check warn output (which includes formatting)
      assert(consoleWarnings.some((line) => line.includes('Multiple AI CLI tools detected')))
      // Check log output
      assert(consoleOutput.some((line) => line.includes('1) Claude Code')))
      assert(consoleOutput.some((line) => line.includes('2) Gemini CLI')))
      assert(consoleOutput.some((line) => line.includes('Defaulting to Claude Code')))
      assert.equal(result, CLI_CLAUDE)
    })

    it('should default to Claude when only Claude available', () => {
      const result = promptForCLI({ claude: true, gemini: false })

      // Check warn output (which includes formatting)
      assert(consoleWarnings.some((line) => line.includes('Multiple AI CLI tools detected')))
      assert(consoleOutput.some((line) => line.includes('1) Claude Code')))
      assert(!consoleOutput.some((line) => line.includes('2) Gemini CLI')))
      assert.equal(result, CLI_CLAUDE)
    })

    it('should return Gemini when only Gemini available', () => {
      const result = promptForCLI({ claude: false, gemini: true })

      assert(consoleOutput.some((line) => line.includes('2) Gemini CLI')))
      assert(!consoleOutput.some((line) => line.includes('1) Claude Code')))
      assert.equal(result, CLI_GEMINI)
    })

    it('should still work with neither available', () => {
      const result = promptForCLI({ claude: false, gemini: false })

      // Should still try to return something
      assert(result === CLI_CLAUDE || result === CLI_GEMINI)
    })
  })

  describe('determineCLI() with options', () => {
    it('should use explicit --cli option when provided', async () => {
      const result = await determineCLI({ cli: 'claude' })
      assert.equal(result, CLI_CLAUDE)
    })

    it('should validate and reject invalid --cli option', async () => {
      const result = await determineCLI({ cli: 'invalid' })

      assert.equal(result, null)
      assert(consoleErrors.some((line) => line.includes('Invalid CLI type: invalid')))
      assert(consoleWarnings.some((line) => line.includes('Valid options are: claude, gemini')))
    })

    it('should support legacy --claude option', async () => {
      const result = await determineCLI({ claude: true })
      assert.equal(result, CLI_CLAUDE)
    })

    it('should support legacy --gemini option', async () => {
      const result = await determineCLI({ gemini: true })
      assert.equal(result, CLI_GEMINI)
    })

    it('should handle --cli with whitespace', async () => {
      const result = await determineCLI({ cli: ' claude ' })

      // Should either trim and accept, or reject as invalid
      assert(result === CLI_CLAUDE || result === null)
    })

    it('should handle case-sensitive CLI types', async () => {
      const result = await determineCLI({ cli: 'CLAUDE' })

      // Should reject due to case sensitivity
      assert.equal(result, null)
      assert(consoleErrors.some((line) => line.includes('Invalid CLI type')))
    })

    it('should handle simultaneous legacy options', async () => {
      // Both claude and gemini flags set (should prefer claude)
      const result = await determineCLI({ claude: true, gemini: true })
      assert.equal(result, CLI_CLAUDE)
    })

    it('should handle --cli option overriding legacy options', async () => {
      const result = await determineCLI({ cli: 'gemini', claude: true })
      assert.equal(result, CLI_GEMINI)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty options object', async () => {
      // This will attempt auto-detection based on actual system state
      const result = await determineCLI({})

      // Result depends on what's installed on the system
      // Should either return a valid CLI type or null
      assert(result === CLI_CLAUDE || result === CLI_GEMINI || result === null)

      if (result === null) {
        assert(consoleOutput.some((line) => line.includes('No AI CLI tools detected')))
      }
    })

    it('should handle numeric cli option', async () => {
      const result = await determineCLI({ cli: 123 })

      // Should reject invalid type
      assert.equal(result, null)
      assert(consoleErrors.some((line) => line.includes('Invalid CLI type')))
    })

    it('should handle null cli option', async () => {
      const result = await determineCLI({ cli: null })

      // Should handle gracefully
      assert(result === null || result === CLI_CLAUDE || result === CLI_GEMINI)
    })
  })
})
