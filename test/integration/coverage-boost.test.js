import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

// Import modules to boost coverage
import { detectCLI, promptForCLI, determineCLI } from '../../src/utils/cli-detector.js'
import { 
  ValidationError, 
  SecurityError, 
  FileOperationError,
  CLINotFoundError,
  PermissionError,
  PathTraversalError,
  CommandInjectionError,
  formatError
} from '../../src/utils/errors.js'
import {
  secureReadFile,
  secureWriteFile,
  secureCopyFile,
  secureCreateDir,
  checkPermissions,
  securePathExists,
  secureReadJSON,
  secureWriteJSON,
  secureGetStats,
  secureReadDir
} from '../../src/utils/file-security.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Integration Coverage Boost Tests', () => {
  let testDir

  before(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proguardian-boost-test-'))
  })

  after(async () => {
    await fs.remove(testDir)
  })

  describe('Error formatting edge cases', () => {
    it('should format PathTraversalError', () => {
      const error = new PathTraversalError('../../../etc/passwd')
      const formatted = formatError(error)
      
      assert(formatted.includes('Invalid path'))
    })

    it('should format CommandInjectionError', () => {
      const error = new CommandInjectionError('rm -rf /')
      const formatted = formatError(error)
      
      assert(formatted.includes('Invalid command'))
    })

    it('should format errors with all properties', () => {
      const error = new FileOperationError('write', '/test/file.txt', 'Access denied')
      error.code = 'EACCES'
      error.cause = new Error('Permission denied')
      
      const formatted = formatError(error, true)
      
      assert(formatted.includes('[EACCES]'))
      assert(formatted.includes('Cannot write'))
      assert(formatted.includes('Caused by:'))
    })

    it('should format non-Error objects', () => {
      const formatted1 = formatError({ message: 'Object error', code: 'TEST' })
      assert(formatted1.includes('Object error'))
      assert(formatted1.includes('TEST'))
      
      const formatted2 = formatError('String error')
      assert(formatted2.includes('String error'))
      
      const formatted3 = formatError(123)
      assert(formatted3.includes('123'))
    })
  })

  describe.skip('File security comprehensive tests', () => {
    it('should handle all secureReadFile options', async () => {
      const testFile = path.join(testDir, 'read-test.txt')
      const content = 'Test content for reading'
      await fs.writeFile(testFile, content)
      
      // Test with default options
      const result1 = await secureReadFile(testFile)
      assert.equal(result1, content)
      
      // Test with null encoding (binary)
      const result2 = await secureReadFile(testFile, { encoding: null })
      assert(Buffer.isBuffer(result2))
      
      // Test with custom encoding
      await fs.writeFile(testFile, 'UTF-16 test', 'utf16le')
      const result3 = await secureReadFile(testFile, { encoding: 'utf16le' })
      assert.equal(result3, 'UTF-16 test')
    })

    it('should handle all secureWriteFile options', async () => {
      // Test creating parent directories
      const nestedFile = path.join(testDir, 'nested', 'deep', 'file.txt')
      await secureWriteFile(nestedFile, 'nested content', { createDirs: true })
      assert(await fs.pathExists(nestedFile))
      
      // Test with specific mode
      const modeFile = path.join(testDir, 'mode-test.txt')
      await secureWriteFile(modeFile, 'mode test', { mode: 0o600 })
      const stats = await fs.stat(modeFile)
      assert(stats.mode & 0o600)
      
      // Test overwriting
      await secureWriteFile(modeFile, 'overwritten', { overwrite: true })
      const content = await fs.readFile(modeFile, 'utf-8')
      assert.equal(content, 'overwritten')
    })

    it('should handle all secureCopyFile options', async () => {
      const source = path.join(testDir, 'source.txt')
      const dest1 = path.join(testDir, 'dest1.txt')
      const dest2 = path.join(testDir, 'dest2.txt')
      
      await fs.writeFile(source, 'copy content')
      await fs.chmod(source, 0o644)
      
      // Test basic copy
      await secureCopyFile(source, dest1)
      assert(await fs.pathExists(dest1))
      
      // Test with preserve mode
      await secureCopyFile(source, dest2, { preserveMode: true })
      const sourceStats = await fs.stat(source)
      const destStats = await fs.stat(dest2)
      assert.equal(sourceStats.mode, destStats.mode)
      
      // Test overwrite protection
      await assert.rejects(
        () => secureCopyFile(source, dest1),
        FileOperationError
      )
      
      // Test with overwrite
      await secureCopyFile(source, dest1, { overwrite: true })
    })

    it('should handle secureCreateDir options', async () => {
      const dir1 = path.join(testDir, 'dir1')
      const dir2 = path.join(testDir, 'dir2')
      const nestedDir = path.join(testDir, 'parent', 'child', 'grandchild')
      
      // Test basic creation
      await secureCreateDir(dir1)
      assert(await fs.pathExists(dir1))
      
      // Test with mode
      await secureCreateDir(dir2, { mode: 0o750 })
      const stats = await fs.stat(dir2)
      assert(stats.mode & 0o750)
      
      // Test nested creation
      await secureCreateDir(nestedDir)
      assert(await fs.pathExists(nestedDir))
      
      // Test existing directory
      await secureCreateDir(dir1) // Should not throw
    })

    it('should handle all file operation errors', async () => {
      const nonExistent = path.join(testDir, 'does-not-exist.txt')
      const readOnlyFile = path.join(testDir, 'readonly.txt')
      
      // Test read errors
      await assert.rejects(
        () => secureReadFile(nonExistent),
        FileOperationError
      )
      
      // Test permission errors
      if (process.platform !== 'win32') {
        await fs.writeFile(readOnlyFile, 'content')
        await fs.chmod(readOnlyFile, 0o000)
        
        await assert.rejects(
          () => secureReadFile(readOnlyFile),
          PermissionError
        )
        
        // Cleanup
        await fs.chmod(readOnlyFile, 0o644)
      }
      
      // Test JSON parse errors
      const badJson = path.join(testDir, 'bad.json')
      await fs.writeFile(badJson, '{invalid}')
      await assert.rejects(
        () => secureReadJSON(badJson),
        FileOperationError
      )
    })
  })

  describe('CLI detector edge cases', () => {
    it('should handle promptForCLI with various states', () => {
      // Test with both available
      let result = promptForCLI({ claude: true, gemini: true })
      assert(result === 'claude' || result === 'gemini')
      
      // Test with only one available
      result = promptForCLI({ claude: true, gemini: false })
      assert.equal(result, 'claude')
      
      result = promptForCLI({ claude: false, gemini: true })
      assert.equal(result, 'gemini')
      
      // Test with neither available (edge case)
      result = promptForCLI({ claude: false, gemini: false })
      assert(result === 'claude' || result === 'gemini')
    })
  })
})