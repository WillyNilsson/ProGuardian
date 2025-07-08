import path from 'path'
import chalk from 'chalk'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'
import { determineCLI, getTargetFilename, CLI_CLAUDE } from '../utils/cli-detector.js'
import {
  secureReadFile,
  secureWriteFile,
  securePathExists,
  secureWriteJSON,
} from '../utils/file-security.js'
import { validateOptions, validateSafePath } from '../utils/validation.js'
import { handleError } from '../utils/errors.js'
import { log, success, warn } from '../utils/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function initCommand(options = {}, deps = {}) {
  try {
    // Extract dependencies with defaults
    const {
      determineCLI: _determineCLI = determineCLI,
      getTargetFilename: _getTargetFilename = getTargetFilename,
    } = deps

    // Validate command options
    validateOptions('init', options)

    // Determine which CLI to configure for
    const cliType = await _determineCLI(options)
    if (!cliType) {
      // No CLI available and user was already informed
      return
    }

    // Support custom path or use default based on CLI type
    const targetFilename = options.path || _getTargetFilename(cliType)
    // Support passing a base directory for testing
    const baseDir = options.baseDir || process.cwd()
    const targetPath = validateSafePath(targetFilename, baseDir)
    const guardianMarker = '## 🛡️ GUARDIAN MODE ACTIVE'

    // Check if target file already exists
    if (await securePathExists(targetPath)) {
      // Read existing file
      let existingContent = await secureReadFile(targetPath, { maxSize: 5 * 1024 * 1024 }) // 5MB max for config files

      // Check if Guardian is already added
      if (existingContent.includes(guardianMarker)) {
        warn(`Guardian mode is already active in ${targetFilename}`)
        if (!options.force) {
          return
        }
        warn('   Reinstalling Guardian section...')
        // Remove existing Guardian section
        const guardianStart = existingContent.indexOf(guardianMarker)
        existingContent = existingContent.substring(0, guardianStart).trim()
      }

      // Get the template path
      const templatePath = path.resolve(__dirname, '..', '..', 'templates', targetFilename)

      // Ensure template exists (use fs directly for templates)
      if (!(await fs.pathExists(templatePath))) {
        throw new Error(`Template file not found: ${targetFilename}`)
      }

      // Read template directly (not subject to cwd validation)
      const guardianContent = await fs.readFile(templatePath, 'utf-8')

      const enhancedContent = `${existingContent}

${guardianMarker}

${guardianContent}`

      await secureWriteFile(targetPath, enhancedContent)
      success(`Added Guardian mode to existing ${targetFilename}`)
    } else {
      // No target file exists, suggest running CLI init first
      warn(`No ${targetFilename} found in this project.`)
      log()
      log('Recommended approach:')
      const cliCommand = cliType === CLI_CLAUDE ? 'claude' : 'gemini'
      log(`  1. Run ${chalk.cyan(`${cliCommand} init`)} to analyze your project`)
      log(`  2. Run ${chalk.cyan('proguardian init')} to add Guardian mode`)
      log()
      log(
        `Or use ${chalk.cyan('proguardian init --force')} to create Guardian-only ${targetFilename}`,
      )

      if (!options.force) {
        return
      }

      // Force create Guardian-only file
      const templatePath = path.resolve(__dirname, '..', '..', 'templates', targetFilename)

      // Ensure template exists (use fs directly for templates)
      if (!(await fs.pathExists(templatePath))) {
        throw new Error(`Template file not found: ${targetFilename}`)
      }

      // Read template and add Guardian marker
      const guardianContent = await fs.readFile(templatePath, 'utf-8')
      const fullContent = `${guardianMarker}\n\n${guardianContent}`

      // Write the complete file
      await secureWriteFile(targetPath, fullContent)
      success(`Created Guardian-only ${targetFilename}`)
    }

    // Create .proguardian marker file
    const markerPath = validateSafePath('.proguardian', baseDir)
    const markerContent = {
      version: '0.1.0',
      initialized: new Date().toISOString(),
      mode: 'guardian',
      cliType: cliType,
      targetFile: targetFilename,
      enhanced: await securePathExists(targetPath),
    }

    await secureWriteJSON(markerPath, markerContent)

    success('Guardian supervision active!')
    log()
    log(chalk.cyan('What happened:'))
    log(`  • Guardian instructions added to ${targetFilename}`)
    log('  • Project knowledge preserved')
    log('  • Quality gates now enforced')
    log()
    log(chalk.green('Guardian is now protecting your codebase! 🛡️'))
  } catch (err) {
    handleError(err, { exit: true, verbose: options.verbose })
  }
}
