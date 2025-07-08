import path from 'path'
import chalk from 'chalk'
import which from 'which'
import { fileURLToPath } from 'url'
import { securePathExists, secureCopyFile, checkPermissions } from '../utils/file-security.js'
import { validateOptions, validateSafePath } from '../utils/validation.js'
import { handleError, PermissionError } from '../utils/errors.js'
import fs from 'fs-extra'
import { log, success, error, warn } from '../utils/logger.js'
import '../utils/cli-detector.js' // For side effects only

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function installWrapperForCLI(cliName, wrapperName, options) {
  try {
    // Find where the CLI is installed
    let cliPath
    try {
      cliPath = await which(cliName)
    } catch {
      return false // CLI not found
    }

    const cliDir = path.dirname(cliPath)

    // Check write permissions on the directory
    if (!(await checkPermissions(cliDir, fs.constants.W_OK))) {
      throw new PermissionError('write to directory', cliDir)
    }

    // Validate paths
    const backupPath = validateSafePath(`${cliName}-original`, cliDir)

    // Backup original binary
    if (!(await securePathExists(backupPath))) {
      log(chalk.gray(`Backing up original ${cliName} to ${path.basename(backupPath)}`))
      await secureCopyFile(cliPath, backupPath)

      // Make backup executable
      await fs.chmod(backupPath, '755')
    } else if (!options.force) {
      warn(`Backup for ${cliName} already exists. Use --force to overwrite.`)
      return true // Already installed
    }

    // Install our wrapper
    const wrapperRelativePath = path.join('..', 'wrapper', wrapperName)
    const wrapperSource = validateSafePath(wrapperRelativePath, __dirname)

    log(chalk.gray(`Installing wrapper to ${path.basename(cliPath)}`))
    await secureCopyFile(wrapperSource, cliPath, { overwrite: true })
    await fs.chmod(cliPath, '755')

    success(`Guardian wrapper installed for ${cliName}!`)
    log(chalk.gray(`  Original ${cliName} backed up to: ${cliName}-original`))

    return true
  } catch (err) {
    if (err instanceof PermissionError) {
      error(`Permission denied for ${cliName}: ${err.message}`)
      log()
      warn('Try running with sudo:')
      log(chalk.gray('  sudo proguardian install-wrapper'))
      log()
      warn('Or use the alternative approach:')
      log(chalk.gray('  Add this to your shell profile (~/.bashrc or ~/.zshrc):'))
      log(chalk.gray(`  alias ${cliName}="proguardian-${cliName}"`))
      return false
    } else {
      throw err
    }
  }
}

export async function installWrapper(options = {}) {
  try {
    // Validate command options
    validateOptions('install-wrapper', options)

    log(chalk.cyan('Installing Guardian wrapper...\n'))

    // Check which CLI tools are available
    let claudeInstalled = false
    let geminiInstalled = false

    // Try to install wrapper for Claude
    try {
      claudeInstalled = await installWrapperForCLI('claude', 'claude-wrapper.js', options)
    } catch (err) {
      if (!(err instanceof PermissionError)) {
        throw err
      }
    }

    // Try to install wrapper for Gemini
    try {
      geminiInstalled = await installWrapperForCLI('gemini', 'gemini-wrapper.js', options)
    } catch (err) {
      if (!(err instanceof PermissionError)) {
        throw err
      }
    }

    // Summary
    if (!claudeInstalled && !geminiInstalled) {
      error('No AI CLI tools found to wrap')
      log()
      log(chalk.gray('Please install one of the following first:'))
      log(chalk.gray('  Claude Code: npm install -g @anthropic/claude-code'))
      log(chalk.gray('  Gemini CLI: npm install -g @google/gemini-cli'))
      return
    }

    // Additional security note
    log()
    log(chalk.cyan('Security note:'))
    log(chalk.gray('  The wrapper enforces Guardian mode when .proguardian exists'))
    log(chalk.gray('  Run "proguardian check" to verify your setup'))

    // Show which CLIs were wrapped
    log()
    log(chalk.cyan('Wrapped CLIs:'))
    if (claudeInstalled) {
      log(chalk.green('  ✓ claude'))
    }
    if (geminiInstalled) {
      log(chalk.green('  ✓ gemini'))
    }
  } catch (err) {
    handleError(err, { exit: true, verbose: options.verbose })
  }
}