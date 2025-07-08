import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'
import fs from 'fs-extra'
import os from 'os'
import {
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
} from '../../src/utils/file-security.js'
import {
  PermissionError,
  SecurityError,
  ValidationError,
  PathTraversalError,
} from '../../src/utils/errors.js'

describe('File Security Tests', () => {
  let testDir
  let originalCwd

  beforeEach(async () => {
    // Save original working directory
    originalCwd = process.cwd()
    // Create a temporary test directory within the project
    testDir = path.join(originalCwd, 'test-tmp', `proguardian-test-${Date.now()}`)
    await fs.ensureDir(testDir)
    process.chdir(testDir)
  })

  afterEach(async () => {
    // Clean up test directory
    process.chdir(originalCwd)
    await fs.remove(path.join(originalCwd, 'test-tmp'))
  })

  describe('checkPermissions', () => {
    it('should return true for readable file', async () => {
      const testFile = 'readable.txt'
      await fs.writeFile(testFile, 'test')

      const result = await checkPermissions(testFile, fs.constants.R_OK)
      assert.equal(result, true)
    })

    it('should return false for non-existent file', async () => {
      const result = await checkPermissions('non-existent.txt', fs.constants.R_OK)
      assert.equal(result, false)
    })
  })

  describe('secureReadFile', () => {
    it('should read file content with validation', async () => {
      const testFile = 'test.txt'
      const content = 'Hello, World!'
      await fs.writeFile(testFile, content)

      const result = await secureReadFile(testFile)
      assert.equal(result, content)
    })

    it('should reject path traversal attempts', async () => {
      await assert.rejects(
        async () => await secureReadFile('../../../etc/passwd'),
        PathTraversalError,
      )
    })

    it('should reject files exceeding size limit', async () => {
      const testFile = 'large.txt'
      const largeContent = 'x'.repeat(1024 * 1024) // 1MB
      await fs.writeFile(testFile, largeContent)

      await assert.rejects(
        async () => await secureReadFile(testFile, { maxSize: 1024 }), // 1KB limit
        SecurityError,
      )
    })

    it('should handle different encodings', async () => {
      const testFile = 'buffer.bin'
      const buffer = Buffer.from([0x00, 0x01, 0x02])
      await fs.writeFile(testFile, buffer)

      const result = await secureReadFile(testFile, { encoding: null })
      assert(Buffer.isBuffer(result))
      assert.deepEqual(result, buffer)
    })
  })

  describe('secureWriteFile', () => {
    it('should write file atomically', async () => {
      const testFile = 'write.txt'
      const content = 'Test content'

      await secureWriteFile(testFile, content)

      const result = await fs.readFile(testFile, 'utf-8')
      assert.equal(result, content)
    })

    it('should create directory if not exists', async () => {
      const nestedFile = path.join('nested', 'dir', 'file.txt')

      await secureWriteFile(nestedFile, 'content')

      assert(await fs.pathExists(nestedFile))
    })

    it('should reject path traversal in write', async () => {
      await assert.rejects(
        async () => await secureWriteFile('../../../tmp/evil.txt', 'evil'),
        PathTraversalError,
      )
    })

    it('should handle write permissions correctly', async () => {
      const testFile = 'readonly.txt'
      await fs.writeFile(testFile, 'original')
      await fs.chmod(testFile, '444') // read-only

      await assert.rejects(
        async () => await secureWriteFile(testFile, 'new content'),
        PermissionError,
      )

      // Restore permissions for cleanup
      await fs.chmod(testFile, '644')
    })
  })

  describe('secureCopyFile', () => {
    it('should copy file with validation', async () => {
      const source = 'source.txt'
      const dest = 'dest.txt'
      const content = 'Copy me'

      await fs.writeFile(source, content)
      await secureCopyFile(source, dest)

      const result = await fs.readFile(dest, 'utf-8')
      assert.equal(result, content)
    })

    it('should reject copying non-existent file', async () => {
      await assert.rejects(
        async () => await secureCopyFile('non-existent.txt', 'dest.txt'),
        ValidationError,
      )
    })

    it('should reject overwriting without flag', async () => {
      const source = 'source.txt'
      const dest = 'dest.txt'

      await fs.writeFile(source, 'content')
      await fs.writeFile(dest, 'existing')

      await assert.rejects(async () => await secureCopyFile(source, dest), ValidationError)
    })

    it('should overwrite with flag', async () => {
      const source = 'source.txt'
      const dest = 'dest.txt'

      await fs.writeFile(source, 'new content')
      await fs.writeFile(dest, 'old content')

      await secureCopyFile(source, dest, { overwrite: true })

      const result = await fs.readFile(dest, 'utf-8')
      assert.equal(result, 'new content')
    })
  })

  describe('secureCreateDir', () => {
    it('should create directory safely', async () => {
      const newDir = 'newdir'

      await secureCreateDir(newDir)

      assert(await fs.pathExists(newDir))
      const stats = await fs.stat(newDir)
      assert(stats.isDirectory())
    })

    it('should create nested directories', async () => {
      const nestedDir = path.join('a', 'b', 'c')

      await secureCreateDir(nestedDir)

      assert(await fs.pathExists(nestedDir))
    })

    it('should reject path traversal in directory creation', async () => {
      await assert.rejects(
        async () => await secureCreateDir('../../../tmp/evil-dir'),
        PathTraversalError,
      )
    })
  })

  describe('securePathExists', () => {
    it('should return true for existing path', async () => {
      const testFile = 'exists.txt'
      await fs.writeFile(testFile, 'exists')

      const result = await securePathExists(testFile)
      assert.equal(result, true)
    })

    it('should return false for non-existing path', async () => {
      const result = await securePathExists('non-existent.txt')
      assert.equal(result, false)
    })

    it('should return false for invalid paths', async () => {
      const result = await securePathExists('../../../etc/passwd')
      assert.equal(result, false)
    })
  })

  describe('secureReadJSON', () => {
    it('should read and parse JSON file', async () => {
      const testFile = 'data.json'
      const data = { name: 'test', value: 42 }
      await fs.writeJson(testFile, data)

      const result = await secureReadJSON(testFile)
      assert.deepEqual(result, data)
    })

    it('should reject invalid JSON', async () => {
      const testFile = 'invalid.json'
      await fs.writeFile(testFile, 'not json')

      await assert.rejects(async () => await secureReadJSON(testFile), ValidationError)
    })
  })

  describe('secureWriteJSON', () => {
    it('should write JSON with formatting', async () => {
      const testFile = 'output.json'
      const data = { name: 'test', nested: { value: 42 } }

      await secureWriteJSON(testFile, data)

      const content = await fs.readFile(testFile, 'utf-8')
      assert(content.includes('  "name": "test"')) // Check indentation

      const parsed = JSON.parse(content)
      assert.deepEqual(parsed, data)
    })

    it('should handle circular references gracefully', async () => {
      const testFile = 'circular.json'
      const data = { name: 'test' }
      data.circular = data // Create circular reference

      await assert.rejects(async () => await secureWriteJSON(testFile, data), ValidationError)
    })
  })

  describe('secureGetStats', () => {
    it('should get file stats safely', async () => {
      const testFile = 'stats.txt'
      await fs.writeFile(testFile, 'content')

      const stats = await secureGetStats(testFile)
      assert(stats.isFile())
      assert(stats.size > 0)
    })

    it('should reject non-existent files', async () => {
      await assert.rejects(async () => await secureGetStats('non-existent.txt'), ValidationError)
    })
  })

  describe('secureReadDir', () => {
    it('should list directory contents', async () => {
      // Create some test files
      await fs.writeFile('file1.txt', 'content1')
      await fs.writeFile('file2.txt', 'content2')
      await fs.ensureDir('subdir')

      const contents = await secureReadDir(testDir)
      assert(contents.includes('file1.txt'))
      assert(contents.includes('file2.txt'))
      assert(contents.includes('subdir'))
    })

    it('should work with withFileTypes option', async () => {
      await fs.writeFile('file.txt', 'content')
      await fs.ensureDir('dir')

      const contents = await secureReadDir(testDir, { withFileTypes: true })

      const file = contents.find((entry) => entry.name === 'file.txt')
      const dir = contents.find((entry) => entry.name === 'dir')

      assert(file.isFile())
      assert(dir.isDirectory())
    })

    it('should reject reading non-directory', async () => {
      const testFile = 'notdir.txt'
      await fs.writeFile(testFile, 'content')

      await assert.rejects(async () => await secureReadDir(testFile), ValidationError)
    })
  })
})
