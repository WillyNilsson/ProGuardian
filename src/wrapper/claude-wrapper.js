#!/usr/bin/env node

import { spawn } from 'child_process'
import path from 'path'
import chalk from 'chalk'
import { fileURLToPath } from 'url'
import { securePathExists, secureCopyFile } from '../utils/file-security.js'
import { validateSafePath } from '../utils/validation.js'
import { handleError } from '../utils/errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// This wrapper intercepts the 'claude' command

async function runClaudeWithGuardian() {
  try {
    // Check if Guardian is initialized in this directory
    const guardianMarkerPath = validateSafePath('.proguardian', process.cwd())
    const claudeMdPath = validateSafePath('CLAUDE.md', process.cwd())

    if (await securePathExists(guardianMarkerPath)) {
      console.log(chalk.cyan('🛡️  Guardian mode active\n'))

      // Ensure CLAUDE.md exists and is up to date
      if (!(await securePathExists(claudeMdPath))) {
        console.log(chalk.yellow('Restoring CLAUDE.md...'))
        const templateRelativePath = path.join('..', '..', 'templates', 'CLAUDE.md')
        const templatePath = validateSafePath(templateRelativePath, __dirname)
        await secureCopyFile(templatePath, claudeMdPath)
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
          console.error(chalk.red('Invalid argument detected'))
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

      // Force include CLAUDE.md in context if not already included
      if (!safeArgs.includes('--context-file') && !safeArgs.includes('-c')) {
        safeArgs.push('--context-file', 'CLAUDE.md')
      } else {
        // Check if CLAUDE.md is already in context
        let hasClaudeMd = false
        for (let i = 0; i < safeArgs.length; i++) {
          if (
            (safeArgs[i] === '--context-file' || safeArgs[i] === '-c') &&
            i + 1 < safeArgs.length &&
            safeArgs[i + 1] === 'CLAUDE.md'
          ) {
            hasClaudeMd = true
            break
          }
        }

        if (!hasClaudeMd) {
          safeArgs.push('--context-file', 'CLAUDE.md')
        }
      }

      // Set environment variables safely (no user input here)
      const env = {
        ...process.env,
        CLAUDE_GUARDIAN_MODE: 'active',
        CLAUDE_SYSTEM_PROMPT_PREPEND: 'You must follow the instructions in CLAUDE.md',
      }

      // Launch real Claude with modified args using execFile for safety
      const claudeOriginal = spawn('claude-original', safeArgs, {
        stdio: 'inherit',
        env: env,
        shell: false, // Prevent shell injection
      })

      claudeOriginal.on('error', (error) => {
        if (error.code === 'ENOENT') {
          console.error(chalk.red('Error: claude-original not found'))
          console.error(chalk.yellow('Run: proguardian install-wrapper'))
        } else {
          console.error(chalk.red('Error launching Claude:'), error.message)
        }
        process.exit(1)
      })

      claudeOriginal.on('exit', (code) => {
        process.exit(code || 0)
      })
    } else {
      // No Guardian mode, run Claude normally with safety checks
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
          console.error(chalk.red('Invalid argument detected'))
          process.exit(1)
        }
      }

      const claude = spawn('claude-original', args, {
        stdio: 'inherit',
        shell: false, // Prevent shell injection
      })

      claude.on('error', (error) => {
        if (error.code === 'ENOENT') {
          console.error(chalk.red('Error: claude-original not found'))
          console.error(chalk.yellow('This wrapper requires the original Claude CLI'))
        } else {
          console.error(chalk.red('Error launching Claude:'), error.message)
        }
        process.exit(1)
      })

      claude.on('exit', (code) => {
        process.exit(code || 0)
      })
    }
  } catch (error) {
    handleError(error, { exit: true })
  }
}

// Option 3: Create a proxy that modifies the AI's responses
// This is kept as a comment for potential future implementation
// async function createGuardianProxy() {
//   // This would require deeper integration:
//   // 1. Intercept Claude's API calls
//   // 2. Modify system prompts before sending
//   // 3. Potentially filter/modify responses
//
//   // Example pseudo-code:
//   /*
//   const originalFetch = global.fetch;
//   global.fetch = async (url, options) => {
//     if (url.includes('anthropic.com/messages')) {
//       const body = JSON.parse(options.body);
//
//       // Prepend Guardian instructions to every message
//       if (!body.system) {
//         body.system = '';
//       }
//       body.system = GUARDIAN_PROMPT + '\n\n' + body.system;
//
//       options.body = JSON.stringify(body);
//     }
//
//     return originalFetch(url, options);
//   };
//   */
// }

runClaudeWithGuardian().catch((error) => {
  console.error(chalk.red('Fatal error:'), error.message)
  process.exit(1)
})
