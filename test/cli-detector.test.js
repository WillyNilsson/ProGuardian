import { test } from 'node:test'
import assert from 'node:assert'
import { getTargetFilename, CLI_CLAUDE, CLI_GEMINI } from '../src/utils/cli-detector.js'

test('getTargetFilename returns correct filenames', () => {
  assert.strictEqual(getTargetFilename(CLI_CLAUDE), 'CLAUDE.md')
  assert.strictEqual(getTargetFilename(CLI_GEMINI), 'GEMINI.md')
})

test('getTargetFilename throws on unknown CLI type', () => {
  assert.throws(() => {
    getTargetFilename('unknown')
  }, /Invalid CLI type/)
})
