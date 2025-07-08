import chalk from 'chalk'
import which from 'which'
import { getTargetFilename, CLI_CLAUDE, CLI_GEMINI } from '../utils/cli-detector.js'
import { secureReadFile, securePathExists, secureReadJSON } from '../utils/file-security.js'
import { validateOptions, validateSafePath } from '../utils/validation.js'
import { handleError } from '../utils/errors.js'
import { log, success, error, warn } from '../utils/logger.js'

export async function checkCommand(options = {}) {
  try {
    // Validate command options
    validateOptions('check', options)

    log(chalk.cyan('🔍 Checking Guardian setup...\n'))

    let allGood = true
    let cliType = CLI_CLAUDE // Default to Claude for backward compatibility
    let targetFilename = 'CLAUDE.md'

    // Check for .proguardian marker to determine CLI type
    const markerPath = validateSafePath('.proguardian', process.cwd())
    if (await securePathExists(markerPath)) {
      try {
        const markerData = await secureReadJSON(markerPath)
        if (markerData.cliType) {
          cliType = markerData.cliType
          targetFilename = getTargetFilename(cliType)
        }
      } catch (err) {
        warn('Could not read .proguardian file')
        if (options.verbose) {
          log(chalk.gray(`   Error: ${err.message}`))
        }
      }
    }

    // Check for target file (CLAUDE.md or GEMINI.md)
    const targetPath = validateSafePath(targetFilename, process.cwd())
    if (await securePathExists(targetPath)) {
      success(`${targetFilename} found`)

      // Verify it's the Guardian version
      const content = await secureReadFile(targetPath, { maxSize: 5 * 1024 * 1024 })
      if (content.includes('GUARDIAN - Senior Developer Protocol')) {
        success('Guardian protocol detected')
      } else {
        warn(`${targetFilename} exists but is not Guardian version`)
        log(chalk.gray('   Run: proguardian init --force'))
        allGood = false
      }
    } else {
      error(`${targetFilename} not found`)
      log(chalk.gray('   Run: proguardian init'))
      allGood = false
    }

    // Check for .proguardian marker
    if (await securePathExists(markerPath)) {
      success('.proguardian configuration found')
      try {
        const markerData = await secureReadJSON(markerPath)
        if (markerData.cliType) {
          const cliName = markerData.cliType === CLI_CLAUDE ? 'Claude Code' : 'Gemini CLI'
          log(chalk.gray(`   Configured for: ${cliName}`))
        }
      } catch {
        // Already logged above
      }
    } else {
      warn('.proguardian marker missing')
      allGood = false
    }

    // Check for Claude Code or Gemini CLI
    log()
    log(chalk.cyan('Checking for AI assistants...'))

    let claudeFound = false
    let geminiFound = false

    try {
      await which('claude')
      claudeFound = true
      success('Claude Code CLI found')
    } catch {
      log(`${chalk.gray('○')} Claude Code CLI not found`)
    }

    try {
      await which('gemini')
      geminiFound = true
      success('Gemini CLI found')
    } catch {
      log(`${chalk.gray('○')} Gemini CLI not found`)
    }

    if (!claudeFound && !geminiFound) {
      log()
      warn('No AI assistant CLIs found')
      log(chalk.gray('   Install with:'))
      log(chalk.gray('   npm install -g @anthropic/claude-code'))
      log(chalk.gray('   npm install -g @google/gemini-cli'))
      allGood = false
    }

    // Summary
    log()
    if (allGood) {
      success('Guardian is fully configured and ready!')
      log()
      log(chalk.cyan('You can now use:'))
      if (cliType === CLI_CLAUDE && claudeFound) {
        log(`  • ${chalk.bold('claude')} - With Guardian supervision`)
      } else if (cliType === CLI_GEMINI && geminiFound) {
        log(`  • ${chalk.bold('gemini')} - With Guardian supervision`)
      } else {
        // Show available CLI that matches configuration
        if (claudeFound) log(`  • ${chalk.bold('claude')} - With Guardian supervision`)
        if (geminiFound) log(`  • ${chalk.bold('gemini')} - With Guardian supervision`)
      }
    } else {
      warn('Guardian setup incomplete')
      log(chalk.gray('   Follow the suggestions above to complete setup'))
    }

    // If fix option is provided, attempt to fix issues
    if (options.fix && !allGood) {
      log()
      log(chalk.cyan('Attempting to fix issues...'))

      // If no target file exists, suggest running init
      if (!(await securePathExists(targetPath))) {
        warn('Run: proguardian init')
      }
    }
  } catch (err) {
    handleError(err, { exit: true, verbose: options.verbose })
  }
}
