/**
 * Central export for all utility modules
 * This provides a convenient single import point for security utilities
 */

// Export all error types and handlers
export {
  ProGuardianError,
  SecurityError,
  ValidationError,
  PermissionError,
  PathTraversalError,
  CommandInjectionError,
  handleError,
} from './errors.js'

// Export all validation functions
export {
  validateOptions,
  validateSafePath,
  sanitizePath,
  validateCLIType,
  validateCommand,
  validateJSON,
  escapeShellArg,
} from './validation.js'

// Export all secure file operations
export {
  checkPermissions,
  secureReadFile,
  secureWriteFile,
  secureCopyFile,
  secureCreateDir,
  securePathExists,
  secureReadJSON,
  secureWriteJSON,
  secureGetStats,
  secureReadDir,
} from './file-security.js'

// Export CLI detection utilities
export {
  CLI_CLAUDE,
  CLI_GEMINI,
  detectCLI,
  getTargetFilename,
  promptForCLI,
  determineCLI,
} from './cli-detector.js'
