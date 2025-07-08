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
        console.log(chalk.yellow(`⚠️  Guardian mode is already active in ${targetFilename}`))
        if (!options.force) {
          return
        }
        console.log(chalk.yellow('   Reinstalling Guardian section...'))
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
      console.log(`${chalk.green('✓')} Added Guardian mode to existing ${targetFilename}`)
    } else {
      // No target file exists, suggest running CLI init first
      console.log(chalk.yellow(`No ${targetFilename} found in this project.`))
      console.log()
      console.log('Recommended approach:')
      const cliCommand = cliType === CLI_CLAUDE ? 'claude' : 'gemini'
      console.log(`  1. Run ${chalk.cyan(`${cliCommand} init`)} to analyze your project`)
      console.log(`  2. Run ${chalk.cyan('proguardian init')} to add Guardian mode`)
      console.log()
      console.log(
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
      console.log(`${chalk.green('✓')} Created Guardian-only ${targetFilename}`)
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

    console.log(`${chalk.green('✓')} Guardian supervision active!`)
    console.log()
    console.log(chalk.cyan('What happened:'))
    console.log(`  • Guardian instructions added to ${targetFilename}`)
    console.log('  • Project knowledge preserved')
    console.log('  • Quality gates now enforced')
    console.log()
    console.log(chalk.green('Guardian is now protecting your codebase! 🛡️'))
  } catch (error) {
    handleError(error, { exit: true, verbose: options.verbose })
  }
}
