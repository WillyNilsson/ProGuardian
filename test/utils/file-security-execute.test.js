import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import {
  secureCopyFile,
  secureReadFile,
  secureWriteFile,
  secureDeleteFile,
  secureCreateDir,
  checkPermissions,
  ensureSecurePermissions,
  isSymlink,
  securePathExists,
  secureReadJSON,
  secureWriteJSON,
  secureGetStats,
  secureReadDir
} from '../../src/utils/file-security.js'
import { SecurityError, FileOperationError } from '../../src/utils/errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('File Security Execution Tests', () => {
  let testDir

  before(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proguardian-exec-test-'))
  })

  after(async () => {
    await fs.remove(testDir)
  })

  describe('secureCreateDir execution', () => {
    it('should create directory successfully', async () => {
      const dirPath = path.join(testDir, 'newdir')
      
      await secureCreateDir(dirPath)
      
      const stats = await fs.stat(dirPath)
      assert(stats.isDirectory())
    })

    it('should handle existing directory', async () => {
      const dirPath = path.join(testDir, 'existingdir')
      await fs.ensureDir(dirPath)
      
      // Should not throw
      await secureCreateDir(dirPath)
    })

    it('should reject path traversal', async () => {
      await assert.rejects(
        () => secureCreateDir('../../../tmp/evil'),
        SecurityError
      )
    })
  })

  describe('securePathExists execution', () => {
    it('should check file existence', async () => {
      const filePath = path.join(testDir, 'exists.txt')
      await fs.writeFile(filePath, 'content')
      
      const exists = await securePathExists(filePath)
      assert(exists)
    })

    it('should return false for non-existent', async () => {
      const filePath = path.join(testDir, 'notexists.txt')
      
      const exists = await securePathExists(filePath)
      assert(!exists)
    })

    it('should reject unsafe paths', async () => {
      await assert.rejects(
        () => securePathExists('../../etc/passwd'),
        SecurityError
      )
    })
  })

  describe('secureDeleteFile execution', () => {
    it('should delete existing file', async () => {
      const filePath = path.join(testDir, 'delete.txt')
      await fs.writeFile(filePath, 'delete me')
      
      await secureDeleteFile(filePath)
      
      assert(!await fs.pathExists(filePath))
    })

    it('should handle non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.txt')
      
      // Should not throw
      await secureDeleteFile(filePath)
    })
  })

  describe('ensureSecurePermissions execution', () => {
    it('should set file permissions', async () => {
      const filePath = path.join(testDir, 'secure.txt')
      await fs.writeFile(filePath, 'content')
      
      await ensureSecurePermissions(filePath)
      
      const stats = await fs.stat(filePath)
      // Check that owner has read/write
      assert(stats.mode & 0o600)
    })

    it('should set directory permissions', async () => {
      const dirPath = path.join(testDir, 'securedir')
      await fs.ensureDir(dirPath)
      
      await ensureSecurePermissions(dirPath)
      
      const stats = await fs.stat(dirPath)
      // Check that owner has read/write/execute
      assert(stats.mode & 0o700)
    })
  })

  describe('isSymlink execution', () => {
    it('should detect regular files as non-symlinks', async () => {
      const filePath = path.join(testDir, 'regular.txt')
      await fs.writeFile(filePath, 'content')
      
      const result = await isSymlink(filePath)
      assert(!result)
    })

    it('should detect directories as non-symlinks', async () => {
      const dirPath = path.join(testDir, 'regulardir')
      await fs.ensureDir(dirPath)
      
      const result = await isSymlink(dirPath)
      assert(!result)
    })

    it('should return false for non-existent', async () => {
      const filePath = path.join(testDir, 'nosuchfile.txt')
      
      const result = await isSymlink(filePath)
      assert(!result)
    })
  })

  describe('secureReadJSON execution', () => {
    it('should read valid JSON', async () => {
      const jsonPath = path.join(testDir, 'valid.json')
      const data = { test: true, number: 42, nested: { value: 'hello' } }
      await fs.writeJSON(jsonPath, data)
      
      const result = await secureReadJSON(jsonPath)
      assert.deepEqual(result, data)
    })

    it('should handle malformed JSON', async () => {
      const jsonPath = path.join(testDir, 'malformed.json')
      await fs.writeFile(jsonPath, '{ invalid json')
      
      await assert.rejects(
        () => secureReadJSON(jsonPath),
        FileOperationError
      )
    })
  })

  describe('secureWriteJSON execution', () => {
    it('should write formatted JSON', async () => {
      const jsonPath = path.join(testDir, 'output.json')
      const data = { formatted: true, indent: 2 }
      
      await secureWriteJSON(jsonPath, data)
      
      const content = await fs.readFile(jsonPath, 'utf-8')
      assert(content.includes('  "formatted": true'))
      assert(content.includes('  "indent": 2'))
    })

    it('should handle circular references', async () => {
      const jsonPath = path.join(testDir, 'circular.json')
      const data = { a: 1 }
      data.circular = data // Create circular reference
      
      await assert.rejects(
        () => secureWriteJSON(jsonPath, data),
        FileOperationError
      )
    })
  })

  describe('secureGetStats execution', () => {
    it('should get file statistics', async () => {
      const filePath = path.join(testDir, 'stats.txt')
      const content = 'test content'
      await fs.writeFile(filePath, content)
      
      const stats = await secureGetStats(filePath)
      
      assert(stats.isFile())
      assert.equal(stats.size, content.length)
    })

    it('should get directory statistics', async () => {
      const dirPath = path.join(testDir, 'statsdir')
      await fs.ensureDir(dirPath)
      
      const stats = await secureGetStats(dirPath)
      
      assert(stats.isDirectory())
    })
  })

  describe('secureReadDir execution', () => {
    it('should read directory contents', async () => {
      const dirPath = path.join(testDir, 'readdir')
      await fs.ensureDir(dirPath)
      await fs.writeFile(path.join(dirPath, 'a.txt'), 'a')
      await fs.writeFile(path.join(dirPath, 'b.txt'), 'b')
      await fs.ensureDir(path.join(dirPath, 'subdir'))
      
      const files = await secureReadDir(dirPath)
      
      assert(files.includes('a.txt'))
      assert(files.includes('b.txt'))
      assert(files.includes('subdir'))
    })

    it('should support filtering', async () => {
      const dirPath = path.join(testDir, 'filterdir')
      await fs.ensureDir(dirPath)
      await fs.writeFile(path.join(dirPath, 'include.txt'), 'yes')
      await fs.writeFile(path.join(dirPath, 'exclude.log'), 'no')
      
      const files = await secureReadDir(dirPath, {
        filter: (name) => name.endsWith('.txt')
      })
      
      assert(files.includes('include.txt'))
      assert(!files.includes('exclude.log'))
    })
  })
})