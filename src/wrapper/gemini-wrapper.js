#!/usr/bin/env node

import { spawn } from 'child_process'
import path from 'path'
import chalk from 'chalk'
import { fileURLToPath } from 'url'
import { securePathExists, secureCopyFile } from '../utils/file-security.js'
import { validateSafePath } from '../utils/validation.js'
import { handleError } from '../utils/errors.js'
import { log, error, warn } from '../utils/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// This wrapper intercepts the 'gemini' command

async function runGeminiWithGuardian() {
  try {
    // Check if Guardian is initialized in this directory
    const guardianMarkerPath = validateSafePath('.proguardian', process.cwd())
    const geminiMdPath = validateSafePath('GEMINI.md', process.cwd())

    if (await securePathExists(guardianMarkerPath)) {
      log(chalk.cyan('🛡️  Guardian mode active\n'))

      // Ensure GEMINI.md exists and is up to date
      if (!(await securePathExists(geminiMdPath))) {
        warn('Restoring GEMINI.md...')
        const templateRelativePath = path.join('..', '..', 'templates', 'GEMINI.md')
        const templatePath = validateSafePath(templateRelativePath, __dirname)
        await secureCopyFile(templatePath, geminiMdPath)
      }

      // Parse and validate command line arguments
      const args = process.argv.slice(2)
      const safeArgs = []

      // Process arguments safely
      let skipNext = false
      for (let i = 0; i < args.length; i++) {
        if (skipNext) {
          skipNext = false
          continue
        }

        const arg = args[i]

        // Validate argument doesn't contain shell injection characters
        if (
          typeof arg !== 'string' ||
          arg.includes(';') ||
          arg.includes('|') ||
          arg.includes('&') ||
          arg.includes('`') ||
          arg.includes('$')
        ) {
          error('Invalid argument detected')
          process.exit(1)
        }

        safeArgs.push(arg)

        // Check if this argument expects a value
        if (arg === '--context-file' || arg === '-c') {
          skipNext = true
          if (i + 1 < args.length) {
            safeArgs.push(args[i + 1])
          }
        }
      }

      // Force include GEMINI.md in context if not already included
      if (!safeArgs.includes('--context-file') && !safeArgs.includes('-c')) {
        safeArgs.push('--context-file', 'GEMINI.md')
      } else {
        // Check if GEMINI.md is already in context
        let hasGeminiMd = false
        for (let i = 0; i < safeArgs.length; i++) {
          if (
            (safeArgs[i] === '--context-file' || safeArgs[i] === '-c') &&
            i + 1 < safeArgs.length &&
            safeArgs[i + 1] === 'GEMINI.md'
          ) {
            hasGeminiMd = true
            break
          }
        }

        if (!hasGeminiMd) {
          safeArgs.push('--context-file', 'GEMINI.md')
        }
      }

      // Set environment variables safely (no user input here)
      const guardianEnforcement = `⚠️ GUARDIAN PROTOCOL ACTIVE ⚠️

You MUST follow the Guardian Review-Gate Workflow:
1. ANALYZE request → CREATE plan → REVIEW plan (fix if needed)
2. IMPLEMENT only after plan passes → REVIEW code (fix if needed)
3. PLAN tests only after code passes → REVIEW test plan (fix if needed)
4. IMPLEMENT tests → RUN tests → REVIEW results
5. If tests fail: DIAGNOSE → PLAN fix → REVIEW → FIX → RE-TEST

CRITICAL: You cannot proceed to next step until current review passes
FORBIDDEN: Skipping reviews, proceeding with issues, placeholder code
REQUIRED: Show evidence of each review (checklist items checked)

Each review must check relevant items from GEMINI.md quality checklist.`
      
      const env = {
        ...process.env,
        GEMINI_GUARDIAN_MODE: 'active',
        GEMINI_SYSTEM_PROMPT_PREPEND: guardianEnforcement,
      }

      // Launch real Gemini with modified args using execFile for safety
      const geminiOriginal = spawn('gemini-original', safeArgs, {
        stdio: 'inherit',
        env: env,
        shell: false, // Prevent shell injection
      })

      geminiOriginal.on('error', (err) => {
        if (err.code === 'ENOENT') {
          error('Error: gemini-original not found')
          warn('Run: proguardian install-wrapper')
        } else {
          error(`Error launching Gemini: ${err.message}`)
        }
        process.exit(1)
      })

      geminiOriginal.on('exit', (code) => {
        process.exit(code || 0)
      })
    } else {
      // No Guardian mode, run Gemini normally with safety checks
      const args = process.argv.slice(2)

      // Basic argument validation even in normal mode
      for (const arg of args) {
        if (
          typeof arg !== 'string' ||
          arg.includes(';') ||
          arg.includes('|') ||
          arg.includes('&') ||
          arg.includes('`') ||
          arg.includes('$')
        ) {
          error('Invalid argument detected')
          process.exit(1)
        }
      }

      const gemini = spawn('gemini-original', args, {
        stdio: 'inherit',
        shell: false, // Prevent shell injection
      })

      gemini.on('error', (err) => {
        if (err.code === 'ENOENT') {
          error('Error: gemini-original not found')
          warn('This wrapper requires the original Gemini CLI')
        } else {
          error(`Error launching Gemini: ${err.message}`)
        }
        process.exit(1)
      })

      gemini.on('exit', (code) => {
        process.exit(code || 0)
      })
    }
  } catch (err) {
    handleError(err, { exit: true })
  }
}

runGeminiWithGuardian().catch((err) => {
  error(`Fatal error: ${err.message}`)
  process.exit(1)
})