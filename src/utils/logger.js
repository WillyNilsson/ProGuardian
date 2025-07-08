/**
 * Logger utility for ProGuardian CLI
 * Provides a consistent logging interface that can be easily tested and controlled
 */

import chalk from 'chalk'

export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
}

class Logger {
  constructor() {
    this.level = LogLevel.INFO
    this.silent = false
    // Allow output functions to be overridden for testing
    this.outputHandlers = {
      log: console.log, // eslint-disable-line no-console
      error: console.error,
      warn: console.warn,
    }
  }

  setSilent(silent) {
    this.silent = silent
  }

  setLevel(level) {
    this.level = level
  }

  setOutputHandler(type, handler) {
    this.outputHandlers[type] = handler
  }

  log(...args) {
    if (!this.silent && this.level >= LogLevel.INFO) {
      this.outputHandlers.log(...args)
    }
  }

  info(...args) {
    this.log(...args)
  }

  success(message) {
    this.log(`${chalk.green('✓')} ${message}`)
  }

  error(message, error = null) {
    if (!this.silent && this.level >= LogLevel.ERROR) {
      this.outputHandlers.error(chalk.red(`✗ ${message}`))
      if (error && this.level >= LogLevel.DEBUG) {
        this.outputHandlers.error(error)
      }
    }
  }

  warn(message) {
    if (!this.silent && this.level >= LogLevel.WARN) {
      this.outputHandlers.warn(chalk.yellow(`⚠ ${message}`))
    }
  }

  debug(...args) {
    if (!this.silent && this.level >= LogLevel.DEBUG) {
      this.outputHandlers.log(chalk.gray(...args))
    }
  }

  // Special formatting methods
  highlight(message) {
    return chalk.cyan(message)
  }

  dim(message) {
    return chalk.gray(message)
  }

  bold(message) {
    return chalk.bold(message)
  }
}

// Export singleton instance
export const logger = new Logger()

// Export convenience methods
export const log = (...args) => logger.log(...args)
export const info = (...args) => logger.info(...args)
export const success = (message) => logger.success(message)
export const error = (message, err) => logger.error(message, err)
export const warn = (message) => logger.warn(message)
export const debug = (...args) => logger.debug(...args)