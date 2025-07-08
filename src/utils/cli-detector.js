import which from 'which'
import chalk from 'chalk'
import { validateCLIType } from './validation.js'
import { ValidationError } from './errors.js'
import { log, success, error, warn } from './logger.js'

// CLI type constants
export const CLI_CLAUDE = 'claude'
export const CLI_GEMINI = 'gemini'

/**
 * Detects which CLI tools are available on the system
 * @returns {Promise<{claude: boolean, gemini: boolean}>}
 */
export async function detectCLI() {
  const available = {
    claude: false,
    gemini: false,
  }

  try {
    await which('claude')
    available.claude = true
  } catch {
    // Claude CLI not found
  }

  try {
    await which('gemini')
    available.gemini = true
  } catch {
    // Gemini CLI not found
  }

  return available
}

/**
 * Gets the target filename based on CLI type
 * @param {string} cliType - Either 'claude' or 'gemini'
 * @returns {string} The target filename
 */
export function getTargetFilename(cliType) {
  // Validate CLI type first
  try {
    validateCLIType(cliType)
  } catch (err) {
    if (err instanceof ValidationError) {
      throw new Error(`Invalid CLI type: ${cliType}`)
    }
    throw err
  }

  switch (cliType) {
    case CLI_CLAUDE:
      return 'CLAUDE.md'
    case CLI_GEMINI:
      return 'GEMINI.md'
    default:
      // This should never happen due to validation above
      throw new Error(`Unknown CLI type: ${cliType}`)
  }
}

/**
 * Prompts user to select CLI type when auto-detection finds multiple
 * @param {Object} available - Object with claude and gemini boolean flags
 * @returns {string} Selected CLI type (for backward compatibility)
 */
export function promptForCLI(available) {
  warn('\nMultiple AI CLI tools detected.')
  log('Which would you like to configure ProGuardian for?\n')

  if (available.claude) {
    log('  1) Claude Code')
  }
  if (available.gemini) {
    log('  2) Gemini CLI')
  }

  log('\nPlease enter your choice (1 or 2): ')

  // For backward compatibility with tests, return synchronously
  // The actual interactive prompt is handled in promptForCLIAsync
  if (available.claude) {
    log(chalk.gray('Defaulting to Claude Code...'))
    return CLI_CLAUDE
  }
  return CLI_GEMINI
}

/**
 * Async version that actually prompts for user input
 * @param {Object} available - Object with claude and gemini boolean flags
 * @returns {Promise<string>} Selected CLI type
 */
export async function promptForCLIAsync(available) {
  warn('\nMultiple AI CLI tools detected.')
  log('Which would you like to configure ProGuardian for?\n')

  const options = []
  if (available.claude) {
    log('  1) Claude Code')
    options.push({ choice: '1', value: CLI_CLAUDE })
  }
  if (available.gemini) {
    log('  2) Gemini CLI')
    options.push({ choice: '2', value: CLI_GEMINI })
  }

  // If not in TTY mode, default to first available
  if (!process.stdin.isTTY) {
    log('\nPlease enter your choice (1 or 2): ')
    const defaultChoice = options[0].value
    log(chalk.gray(`Non-interactive mode detected. Defaulting to ${defaultChoice}...`))
    return defaultChoice
  }

  // Use readline to get user input in interactive mode
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question('\nPlease enter your choice (1 or 2): ', (answer) => {
      rl.close()
      
      const selected = options.find(opt => opt.choice === answer.trim())
      if (selected) {
        resolve(selected.value)
      } else {
        // Invalid input - default to first available option
        log(chalk.gray(`Invalid choice. Defaulting to ${options[0].value}...`))
        resolve(options[0].value)
      }
    })
  })
}

/**
 * Determines which CLI to use based on options and detection
 * @param {Object} options - Command options with cli flag
 * @returns {Promise<string|null>} Selected CLI type or null if none available
 */
export async function determineCLI(options) {
  // If explicit option provided, validate and use it
  if (options.cli) {
    try {
      return validateCLIType(options.cli)
    } catch {
      error(`Invalid CLI type: ${options.cli}`)
      warn('Valid options are: claude, gemini')
      return null
    }
  }

  // Legacy support for old options
  if (options.claude) {
    return CLI_CLAUDE
  }
  if (options.gemini) {
    return CLI_GEMINI
  }

  // Otherwise, detect available CLIs
  const available = await detectCLI()

  if (!available.claude && !available.gemini) {
    error('No AI CLI tools detected.')
    warn('\nPlease install one of the following:')
    log(`  • Claude Code: ${chalk.cyan('npm install -g @anthropic/claude-code')}`)
    log(`  • Gemini CLI: ${chalk.cyan('npm install -g @google/gemini-cli')}`)
    log(`\nThen run ${chalk.cyan('proguardian init')} again.`)
    return null
  }

  // If only one is available, use it
  if (available.claude && !available.gemini) {
    success('Detected Claude Code CLI')
    return CLI_CLAUDE
  }
  if (available.gemini && !available.claude) {
    success('Detected Gemini CLI')
    return CLI_GEMINI
  }

  // If both are available, prompt user
  return promptForCLIAsync(available)
}
