#!/usr/bin/env node

/*
 * Copyright 2024 Willy Nilsson
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { program } from 'commander'
import { initCommand } from '../src/commands/init.js'
import { checkCommand } from '../src/commands/check.js'
import { installWrapper } from '../src/commands/install-wrapper.js'
import chalk from 'chalk'
import { handleError } from '../src/utils/errors.js'

// Global error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Unexpected error:'), error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled promise rejection:'), reason)
  process.exit(1)
})

program
  .name('proguardian')
  .description('Guardian supervision for AI coding assistants')
  .version('0.1.0')

program
  .command('init')
  .description('Initialize Guardian supervision in your project')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('-c, --cli <type>', 'Specify CLI type (claude or gemini)')
  .option('-v, --verbose', 'Show detailed error information')
  .action(async (options) => {
    try {
      // Convert old CLI options to new format for backward compatibility
      if (options.claude) {
        options.cli = 'claude'
        delete options.claude
      } else if (options.gemini) {
        options.cli = 'gemini'
        delete options.gemini
      }

      await initCommand(options)
    } catch (error) {
      handleError(error, { exit: true, verbose: options.verbose })
    }
  })

program
  .command('check')
  .description('Verify Guardian setup')
  .option('--fix', 'Attempt to fix issues automatically')
  .option('-v, --verbose', 'Show detailed error information')
  .action(async (options) => {
    try {
      await checkCommand(options)
    } catch (error) {
      handleError(error, { exit: true, verbose: options.verbose })
    }
  })

program
  .command('install-wrapper')
  .description('Install Guardian wrapper for Claude CLI')
  .option('--global', 'Install globally')
  .option('-f, --force', 'Force reinstall even if backup exists')
  .option('-v, --verbose', 'Show detailed error information')
  .action(async (options) => {
    try {
      await installWrapper(options)
    } catch (error) {
      handleError(error, { exit: true, verbose: options.verbose })
    }
  })

// Custom help formatting
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name(),
})

// Validate arguments before parsing
const args = process.argv.slice(2)
for (const arg of args) {
  if (typeof arg === 'string' && (arg.includes('\n') || arg.includes('\r') || arg.includes('\0'))) {
    console.error(chalk.red('Invalid command line argument detected'))
    process.exit(1)
  }
}

program.parse()

// Show help if no command provided
if (!args.length) {
  program.outputHelp()
}
