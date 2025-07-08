import chalk from 'chalk'
import which from 'which'
import { getTargetFilename, CLI_CLAUDE, CLI_GEMINI } from '../utils/cli-detector.js'
import { secureReadFile, securePathExists, secureReadJSON } from '../utils/file-security.js'
import { validateOptions, validateSafePath } from '../utils/validation.js'
import { handleError } from '../utils/errors.js'

export async function checkCommand(options = {}) {
  try {
    // Validate command options
    validateOptions('check', options)

    console.log(chalk.cyan('🔍 Checking Guardian setup...\n'))

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
      } catch (error) {
        console.log(chalk.yellow('⚠️  Could not read .proguardian file'))
        if (options.verbose) {
          console.log(chalk.gray(`   Error: ${error.message}`))
        }
      }
    }

    // Check for target file (CLAUDE.md or GEMINI.md)
    const targetPath = validateSafePath(targetFilename, process.cwd())
    if (await securePathExists(targetPath)) {
      console.log(`${chalk.green('✓')} ${targetFilename} found`)

      // Verify it's the Guardian version
      const content = await secureReadFile(targetPath, { maxSize: 5 * 1024 * 1024 })
      if (content.includes('GUARDIAN - Senior Developer Protocol')) {
        console.log(`${chalk.green('✓')} Guardian protocol detected`)
      } else {
        console.log(chalk.yellow(`⚠️  ${targetFilename} exists but is not Guardian version`))
        console.log(chalk.gray('   Run: proguardian init --force'))
        allGood = false
      }
    } else {
      console.log(`${chalk.red('✗')} ${targetFilename} not found`)
      console.log(chalk.gray('   Run: proguardian init'))
      allGood = false
    }

    // Check for .proguardian marker
    if (await securePathExists(markerPath)) {
      console.log(`${chalk.green('✓')} .proguardian configuration found`)
      try {
        const markerData = await secureReadJSON(markerPath)
        if (markerData.cliType) {
          const cliName = markerData.cliType === CLI_CLAUDE ? 'Claude Code' : 'Gemini CLI'
          console.log(chalk.gray(`   Configured for: ${cliName}`))
        }
      } catch {
        // Already logged above
      }
    } else {
      console.log(chalk.yellow('⚠️  .proguardian marker missing'))
      allGood = false
    }

    // Check for Claude Code or Gemini CLI
    console.log()
    console.log(chalk.cyan('Checking for AI assistants...'))

    let claudeFound = false
    let geminiFound = false

    try {
      await which('claude')
      claudeFound = true
      console.log(`${chalk.green('✓')} Claude Code CLI found`)
    } catch {
      console.log(`${chalk.gray('○')} Claude Code CLI not found`)
    }

    try {
      await which('gemini')
      geminiFound = true
      console.log(`${chalk.green('✓')} Gemini CLI found`)
    } catch {
      console.log(`${chalk.gray('○')} Gemini CLI not found`)
    }

    if (!claudeFound && !geminiFound) {
      console.log()
      console.log(chalk.yellow('⚠️  No AI assistant CLIs found'))
      console.log(chalk.gray('   Install with:'))
      console.log(chalk.gray('   npm install -g @anthropic/claude-code'))
      console.log(chalk.gray('   npm install -g @google/gemini-cli'))
      allGood = false
    }

    // Summary
    console.log()
    if (allGood) {
      console.log(chalk.green('✅ Guardian is fully configured and ready!'))
      console.log()
      console.log(chalk.cyan('You can now use:'))
      if (cliType === CLI_CLAUDE && claudeFound) {
        console.log(`  • ${chalk.bold('claude')} - With Guardian supervision`)
      } else if (cliType === CLI_GEMINI && geminiFound) {
        console.log(`  • ${chalk.bold('gemini')} - With Guardian supervision`)
      } else {
        // Show available CLI that matches configuration
        if (claudeFound) console.log(`  • ${chalk.bold('claude')} - With Guardian supervision`)
        if (geminiFound) console.log(`  • ${chalk.bold('gemini')} - With Guardian supervision`)
      }
    } else {
      console.log(chalk.yellow('⚠️  Guardian setup incomplete'))
      console.log(chalk.gray('   Follow the suggestions above to complete setup'))
    }

    // If fix option is provided, attempt to fix issues
    if (options.fix && !allGood) {
      console.log()
      console.log(chalk.cyan('Attempting to fix issues...'))

      // If no target file exists, suggest running init
      if (!(await securePathExists(targetPath))) {
        console.log(chalk.yellow('Run: proguardian init'))
      }
    }
  } catch (error) {
    handleError(error, { exit: true, verbose: options.verbose })
  }
}
