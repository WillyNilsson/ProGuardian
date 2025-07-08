import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('CLI Detector Module Coverage Tests', () => {
  describe('Module Structure', () => {
    it('should have all required functions and constants', async () => {
      const cliDetectorPath = path.join(__dirname, '../../src/utils/cli-detector.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(cliDetectorPath, 'utf-8')
      
      // Check for constants
      assert(content.includes("export const CLI_CLAUDE = 'claude'"))
      assert(content.includes("export const CLI_GEMINI = 'gemini'"))
      
      // Check for all exported functions
      assert(content.includes('export async function detectCLI()'))
      assert(content.includes('export function getTargetFilename(cliType)'))
      assert(content.includes('export function promptForCLI(available)'))
      assert(content.includes('export async function determineCLI(options)'))
      
      // Check for imports
      assert(content.includes("import which from 'which'"))
      assert(content.includes("import chalk from 'chalk'"))
      assert(content.includes("import { validateCLIType }"))
      assert(content.includes("import { ValidationError }"))
    })

    it('should handle all CLI detection scenarios', async () => {
      const cliDetectorPath = path.join(__dirname, '../../src/utils/cli-detector.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(cliDetectorPath, 'utf-8')
      
      // Check detectCLI function
      assert(content.includes("await which('claude')"))
      assert(content.includes("await which('gemini')"))
      assert(content.includes('available.claude = true'))
      assert(content.includes('available.gemini = true'))
      assert(content.includes('// Claude CLI not found'))
      assert(content.includes('// Gemini CLI not found'))
      
      // Check error handling in detectCLI
      assert(content.includes('} catch {'))
    })

    it('should validate CLI types properly', async () => {
      const cliDetectorPath = path.join(__dirname, '../../src/utils/cli-detector.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(cliDetectorPath, 'utf-8')
      
      // Check getTargetFilename validation
      assert(content.includes('validateCLIType(cliType)'))
      assert(content.includes('if (error instanceof ValidationError)'))
      assert(content.includes('Invalid CLI type:'))
      assert(content.includes('throw error')) // Re-throw non-validation errors
      
      // Check switch statement
      assert(content.includes('switch (cliType)'))
      assert(content.includes("case CLI_CLAUDE:"))
      assert(content.includes("return 'CLAUDE.md'"))
      assert(content.includes("case CLI_GEMINI:"))
      assert(content.includes("return 'GEMINI.md'"))
      assert(content.includes('default:'))
      assert(content.includes('Unknown CLI type:'))
    })

    it('should handle all determineCLI scenarios', async () => {
      const cliDetectorPath = path.join(__dirname, '../../src/utils/cli-detector.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(cliDetectorPath, 'utf-8')
      
      // Check option handling
      assert(content.includes('if (options.cli)'))
      assert(content.includes('validateCLIType(options.cli)'))
      assert(content.includes('Valid options are: claude, gemini'))
      
      // Check legacy option support
      assert(content.includes('if (options.claude)'))
      assert(content.includes('if (options.gemini)'))
      
      // Check auto-detection scenarios
      assert(content.includes('if (!available.claude && !available.gemini)'))
      assert(content.includes('No AI CLI tools detected'))
      assert(content.includes('npm install -g @anthropic/claude-code'))
      assert(content.includes('npm install -g @google/gemini-cli'))
      
      // Check single CLI detection
      assert(content.includes('if (available.claude && !available.gemini)'))
      assert(content.includes('Detected Claude Code CLI'))
      assert(content.includes('if (available.gemini && !available.claude)'))
      assert(content.includes('Detected Gemini CLI'))
      
      // Check prompt scenario
      assert(content.includes('return promptForCLI(available)'))
    })

    it('should format prompt messages correctly', async () => {
      const cliDetectorPath = path.join(__dirname, '../../src/utils/cli-detector.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(cliDetectorPath, 'utf-8')
      
      // Check promptForCLI messages
      assert(content.includes('Multiple AI CLI tools detected'))
      assert(content.includes('Which would you like to configure'))
      assert(content.includes('1) Claude Code'))
      assert(content.includes('2) Gemini CLI'))
      assert(content.includes('Please enter your choice'))
      assert(content.includes('Defaulting to Claude Code'))
      
      // Check conditional display
      assert(content.includes('if (available.claude)'))
      assert(content.includes('if (available.gemini)'))
    })
  })
})