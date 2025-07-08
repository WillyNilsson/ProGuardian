import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Claude Wrapper Tests', () => {
  describe('Module Structure', () => {
    it('should export as executable script', async () => {
      const wrapperPath = path.join(__dirname, '../../src/wrapper/claude-wrapper.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(wrapperPath, 'utf-8')
      
      // Should have shebang for direct execution
      assert(content.startsWith('#!/usr/bin/env node'))
      
      // Should import required modules
      assert(content.includes("import { spawn } from 'child_process'"))
      assert(content.includes("import { securePathExists"))
      assert(content.includes("import { validateSafePath"))
    })

    it('should have proper security checks', async () => {
      const wrapperPath = path.join(__dirname, '../../src/wrapper/claude-wrapper.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(wrapperPath, 'utf-8')
      
      // Should validate arguments for shell injection
      assert(content.includes("arg.includes(';')"))
      assert(content.includes("arg.includes('|')"))
      assert(content.includes("arg.includes('&')"))
      assert(content.includes("arg.includes('`')"))
      assert(content.includes("arg.includes('$')"))
      
      // Should use spawn with shell: false
      assert(content.includes("shell: false"))
    })

    it('should handle Guardian mode detection', async () => {
      const wrapperPath = path.join(__dirname, '../../src/wrapper/claude-wrapper.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(wrapperPath, 'utf-8')
      
      // Should check for .proguardian marker
      assert(content.includes("'.proguardian'"))
      assert(content.includes("securePathExists(guardianMarkerPath)"))
      
      // Should handle CLAUDE.md
      assert(content.includes("'CLAUDE.md'"))
      assert(content.includes("--context-file"))
      
      // Should set Guardian environment variables
      assert(content.includes("CLAUDE_GUARDIAN_MODE"))
      assert(content.includes("CLAUDE_SYSTEM_PROMPT_PREPEND"))
    })

    it('should handle errors appropriately', async () => {
      const wrapperPath = path.join(__dirname, '../../src/wrapper/claude-wrapper.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(wrapperPath, 'utf-8')
      
      // Should handle ENOENT error
      assert(content.includes("error.code === 'ENOENT'"))
      assert(content.includes("claude-original not found"))
      
      // Should suggest running install-wrapper
      assert(content.includes("proguardian install-wrapper"))
      
      // Should use handleError utility
      assert(content.includes("handleError(error"))
    })

    it('should prevent argument duplication', async () => {
      const wrapperPath = path.join(__dirname, '../../src/wrapper/claude-wrapper.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(wrapperPath, 'utf-8')
      
      // Should check if CLAUDE.md is already in context
      assert(content.includes("hasClaudeMd"))
      assert(content.includes("!hasClaudeMd"))
      
      // Should handle --context-file and -c flags
      assert(content.includes("'--context-file'"))
      assert(content.includes("'-c'"))
    })
  })

  describe('Security Features', () => {
    it('should validate all arguments in both modes', async () => {
      const wrapperPath = path.join(__dirname, '../../src/wrapper/claude-wrapper.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(wrapperPath, 'utf-8')
      
      // Count occurrences of argument validation
      const validationRegex = /arg\.includes\('\|'\)/g
      const matches = content.match(validationRegex)
      
      // Should validate in both Guardian and normal mode
      assert(matches && matches.length >= 2)
    })

    it('should use secure file operations', async () => {
      const wrapperPath = path.join(__dirname, '../../src/wrapper/claude-wrapper.js')
      const { readFile } = await import('fs/promises')
      
      const content = await readFile(wrapperPath, 'utf-8')
      
      // Should use security utilities
      assert(content.includes("validateSafePath"))
      assert(content.includes("securePathExists"))
      assert(content.includes("secureCopyFile"))
      
      // Should not use raw fs operations
      assert(!content.includes("fs.readFile"))
      assert(!content.includes("fs.writeFile"))
      assert(!content.includes("fs.copyFile"))
    })
  })
})