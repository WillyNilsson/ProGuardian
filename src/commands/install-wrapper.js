import path from 'path'
import chalk from 'chalk'
import which from 'which'
import { fileURLToPath } from 'url'
import { securePathExists, secureCopyFile, checkPermissions } from '../utils/file-security.js'
import { validateOptions, validateSafePath } from '../utils/validation.js'
import { handleError, PermissionError } from '../utils/errors.js'
import fs from 'fs-extra'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function installWrapper(options = {}) {
  try {
    // Validate command options
    validateOptions('install-wrapper', options)

    console.log(chalk.cyan('Installing Guardian wrapper...\n'))

    // Find where claude is installed
    let claudePath
    try {
      claudePath = await which('claude')
    } catch {
      console.error(chalk.red('Claude CLI not found'))
      console.log(chalk.gray('Please install Claude Code CLI first:'))
      console.log(chalk.gray('  npm install -g @anthropic/claude-code'))
      return
    }

    const claudeDir = path.dirname(claudePath)

    // Check write permissions on the directory
    if (!(await checkPermissions(claudeDir, fs.constants.W_OK))) {
      throw new PermissionError('write to directory', claudeDir)
    }

    // Validate paths
    const backupPath = validateSafePath('claude-original', claudeDir)

    // Backup original claude binary
    if (!(await securePathExists(backupPath))) {
      console.log(chalk.gray(`Backing up original claude to ${path.basename(backupPath)}`))
      await secureCopyFile(claudePath, backupPath)

      // Make backup executable
      await fs.chmod(backupPath, '755')
    } else if (!options.force) {
      console.log(chalk.yellow('Backup already exists. Use --force to overwrite.'))
      return
    }

    // Install our wrapper as 'claude'
    const wrapperRelativePath = path.join('..', 'wrapper', 'claude-wrapper.js')
    const wrapperSource = validateSafePath(wrapperRelativePath, __dirname)

    console.log(chalk.gray(`Installing wrapper to ${path.basename(claudePath)}`))
    await secureCopyFile(wrapperSource, claudePath, { overwrite: true })
    await fs.chmod(claudePath, '755')

    console.log(`${chalk.green('✓')} Guardian wrapper installed!`)
    console.log(chalk.gray('  Original claude backed up to: claude-original'))

    // Additional security note
    console.log()
    console.log(chalk.cyan('Security note:'))
    console.log(chalk.gray('  The wrapper enforces Guardian mode when .proguardian exists'))
    console.log(chalk.gray('  Run "proguardian check" to verify your setup'))
  } catch (error) {
    if (error instanceof PermissionError) {
      console.error(chalk.red('Permission denied:'), error.message)
      console.log()
      console.log(chalk.yellow('Try running with sudo:'))
      console.log(chalk.gray('  sudo proguardian install-wrapper'))
      console.log()
      console.log(chalk.yellow('Or use the alternative approach:'))
      console.log(chalk.gray('  Add this to your shell profile (~/.bashrc or ~/.zshrc):'))
      console.log(chalk.gray('  alias claude="proguardian-claude"'))
    } else {
      handleError(error, { exit: true, verbose: options.verbose })
    }
  }
}
