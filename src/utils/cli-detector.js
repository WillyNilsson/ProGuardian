import which from 'which'
import chalk from 'chalk'
import { validateCLIType } from './validation.js'
import { ValidationError } from './errors.js'

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
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new Error(`Invalid CLI type: ${cliType}`)
    }
    throw error
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
 * @returns {Promise<string>} Selected CLI type
 */
export function promptForCLI(available) {
  console.log(chalk.yellow('\nMultiple AI CLI tools detected.'))
  console.log('Which would you like to configure ProGuardian for?\n')

  if (available.claude) {
    console.log('  1) Claude Code')
  }
  if (available.gemini) {
    console.log('  2) Gemini CLI')
  }

  console.log('\nPlease enter your choice (1 or 2): ')

  // For now, we'll default to Claude if both are available
  // In a real implementation, you'd use inquirer or similar for interactive prompts
  if (available.claude) {
    console.log(chalk.gray('Defaulting to Claude Code...'))
    return CLI_CLAUDE
  }
  return CLI_GEMINI
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
      console.error(chalk.red(`Invalid CLI type: ${options.cli}`))
      console.log(chalk.yellow('Valid options are: claude, gemini'))
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
    console.log(chalk.red('✗ No AI CLI tools detected.'))
    console.log(chalk.yellow('\nPlease install one of the following:'))
    console.log(`  • Claude Code: ${chalk.cyan('npm install -g @anthropic/claude-code')}`)
    console.log(`  • Gemini CLI: ${chalk.cyan('npm install -g @google/gemini-cli')}`)
    console.log(`\nThen run ${chalk.cyan('proguardian init')} again.`)
    return null
  }

  // If only one is available, use it
  if (available.claude && !available.gemini) {
    console.log(`${chalk.green('✓')} Detected Claude Code CLI`)
    return CLI_CLAUDE
  }
  if (available.gemini && !available.claude) {
    console.log(`${chalk.green('✓')} Detected Gemini CLI`)
    return CLI_GEMINI
  }

  // If both are available, prompt user (for now default to Claude)
  return promptForCLI(available)
}
