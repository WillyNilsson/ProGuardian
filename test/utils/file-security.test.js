import { describe, it, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import {
  secureCopyFile,
  secureReadFile,
  secureWriteFile,
  secureDeleteFile,
  secureCreateDirectory,
  checkPermissions,
  ensureSecurePermissions,
  isSymlink
} from '../../src/utils/file-security.js'
import { SecurityError, FileOperationError } from '../../src/utils/errors.js'

describe('File Security Tests', () => {
  let testDir
  let testFile
  let testContent

  before(async () => {
    // Create a temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proguardian-security-test-'))
    testFile = path.join(testDir, 'test.txt')
    testContent = 'Test content'
  })

  after(async () => {
    // Cleanup
    await fs.remove(testDir)
  })

  beforeEach(async () => {
    // Reset test file
    await fs.writeFile(testFile, testContent)
  })

  describe('secureCopyFile', () => {
    it('should copy file successfully', async () => {
      const destFile = path.join(testDir, 'copy.txt')
      
      await secureCopyFile(testFile, destFile)
      
      assert(await fs.pathExists(destFile))
      const content = await fs.readFile(destFile, 'utf-8')
      assert.equal(content, testContent)
    })

    it('should reject path traversal in source', async () => {
      const destFile = path.join(testDir, 'copy.txt')
      
      await assert.rejects(
        () => secureCopyFile('../../../etc/passwd', destFile),
        SecurityError
      )
    })

    it('should reject path traversal in destination', async () => {
      await assert.rejects(
        () => secureCopyFile(testFile, '../../../tmp/evil.txt'),
        SecurityError
      )
    })

    it('should handle non-existent source file', async () => {
      const destFile = path.join(testDir, 'copy.txt')
      
      await assert.rejects(
        () => secureCopyFile(path.join(testDir, 'nonexistent.txt'), destFile),
        FileOperationError
      )
    })

    it('should respect overwrite option', async () => {
      const destFile = path.join(testDir, 'existing.txt')
      await fs.writeFile(destFile, 'existing content')
      
      // Should fail without overwrite
      await assert.rejects(
        () => secureCopyFile(testFile, destFile),
        FileOperationError
      )
      
      // Should succeed with overwrite
      await secureCopyFile(testFile, destFile, { overwrite: true })
      const content = await fs.readFile(destFile, 'utf-8')
      assert.equal(content, testContent)
    })

    it('should preserve file permissions', async () => {
      const destFile = path.join(testDir, 'copy.txt')
      
      // Set specific permissions on source
      await fs.chmod(testFile, 0o644)
      
      await secureCopyFile(testFile, destFile, { preserveMode: true })
      
      const stats = await fs.stat(destFile)
      // Check readable/writable bits (platform-independent)
      assert(stats.mode & 0o400) // readable by owner
      assert(stats.mode & 0o200) // writable by owner
    })
  })

  describe('secureReadFile', () => {
    it('should read file successfully', async () => {
      const content = await secureReadFile(testFile)
      assert.equal(content, testContent)
    })

    it('should reject path traversal', async () => {
      await assert.rejects(
        () => secureReadFile('../../../etc/passwd'),
        SecurityError
      )
    })

    it('should handle non-existent file', async () => {
      await assert.rejects(
        () => secureReadFile(path.join(testDir, 'nonexistent.txt')),
        FileOperationError
      )
    })

    it('should support different encodings', async () => {
      // Write with specific encoding
      const utf16Content = 'UTF-16 content: 你好'
      const utf16File = path.join(testDir, 'utf16.txt')
      await fs.writeFile(utf16File, utf16Content, 'utf16le')
      
      const content = await secureReadFile(utf16File, { encoding: 'utf16le' })
      assert.equal(content, utf16Content)
    })

    it('should read binary files as Buffer', async () => {
      const binaryFile = path.join(testDir, 'binary.bin')
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF])
      await fs.writeFile(binaryFile, binaryData)
      
      const content = await secureReadFile(binaryFile, { encoding: null })
      assert(Buffer.isBuffer(content))
      assert.deepEqual(content, binaryData)
    })
  })

  describe('secureWriteFile', () => {
    it('should write file successfully', async () => {
      const newFile = path.join(testDir, 'new.txt')
      const newContent = 'New content'
      
      await secureWriteFile(newFile, newContent)
      
      const content = await fs.readFile(newFile, 'utf-8')
      assert.equal(content, newContent)
    })

    it('should reject path traversal', async () => {
      await assert.rejects(
        () => secureWriteFile('../../../tmp/evil.txt', 'evil content'),
        SecurityError
      )
    })

    it('should create parent directories if needed', async () => {
      const nestedFile = path.join(testDir, 'nested', 'deep', 'file.txt')
      
      await secureWriteFile(nestedFile, 'nested content', { createDirs: true })
      
      assert(await fs.pathExists(nestedFile))
      const content = await fs.readFile(nestedFile, 'utf-8')
      assert.equal(content, 'nested content')
    })

    it('should set file mode', async () => {
      const modeFile = path.join(testDir, 'mode.txt')
      
      await secureWriteFile(modeFile, 'content', { mode: 0o600 })
      
      const stats = await fs.stat(modeFile)
      // Check that file is readable/writable by owner only
      assert(stats.mode & 0o600)
    })

    it('should handle write errors', async () => {
      // Try to write to a directory as if it were a file
      await assert.rejects(
        () => secureWriteFile(testDir, 'content'),
        FileOperationError
      )
    })
  })

  describe('secureDeleteFile', () => {
    it('should delete file successfully', async () => {
      const deleteFile = path.join(testDir, 'delete.txt')
      await fs.writeFile(deleteFile, 'to be deleted')
      
      await secureDeleteFile(deleteFile)
      
      assert(!await fs.pathExists(deleteFile))
    })

    it('should reject path traversal', async () => {
      await assert.rejects(
        () => secureDeleteFile('../../../tmp/important.txt'),
        SecurityError
      )
    })

    it('should handle non-existent file', async () => {
      // Should not throw for non-existent file
      await secureDeleteFile(path.join(testDir, 'nonexistent.txt'))
    })

    it('should not delete directories', async () => {
      const subDir = path.join(testDir, 'subdir')
      await fs.ensureDir(subDir)
      
      await assert.rejects(
        () => secureDeleteFile(subDir),
        FileOperationError
      )
    })
  })

  describe('secureCreateDirectory', () => {
    it('should create directory successfully', async () => {
      const newDir = path.join(testDir, 'newdir')
      
      await secureCreateDirectory(newDir)
      
      assert(await fs.pathExists(newDir))
      const stats = await fs.stat(newDir)
      assert(stats.isDirectory())
    })

    it('should reject path traversal', async () => {
      await assert.rejects(
        () => secureCreateDirectory('../../../tmp/evil-dir'),
        SecurityError
      )
    })

    it('should create nested directories', async () => {
      const nestedDir = path.join(testDir, 'level1', 'level2', 'level3')
      
      await secureCreateDirectory(nestedDir)
      
      assert(await fs.pathExists(nestedDir))
    })

    it('should handle existing directory', async () => {
      const existingDir = path.join(testDir, 'existing')
      await fs.ensureDir(existingDir)
      
      // Should not throw
      await secureCreateDirectory(existingDir)
    })

    it('should set directory mode', async () => {
      const modeDir = path.join(testDir, 'modedir')
      
      await secureCreateDirectory(modeDir, { mode: 0o700 })
      
      const stats = await fs.stat(modeDir)
      // Check execute permission for directories
      assert(stats.mode & 0o700)
    })
  })

  describe('checkPermissions', () => {
    it('should check read permissions', async () => {
      const readable = await checkPermissions(testFile, fs.constants.R_OK)
      assert(readable)
    })

    it('should check write permissions', async () => {
      const writable = await checkPermissions(testFile, fs.constants.W_OK)
      assert(writable)
    })

    it('should return false for non-existent file', async () => {
      const result = await checkPermissions(
        path.join(testDir, 'nonexistent.txt'),
        fs.constants.R_OK
      )
      assert(!result)
    })

    it('should reject path traversal', async () => {
      await assert.rejects(
        () => checkPermissions('../../../etc/passwd', fs.constants.R_OK),
        SecurityError
      )
    })

    it('should handle permission denied', async () => {
      if (process.platform !== 'win32') {
        const noReadFile = path.join(testDir, 'noread.txt')
        await fs.writeFile(noReadFile, 'content')
        await fs.chmod(noReadFile, 0o000)
        
        const readable = await checkPermissions(noReadFile, fs.constants.R_OK)
        assert(!readable)
        
        // Cleanup
        await fs.chmod(noReadFile, 0o644)
      }
    })
  })

  describe('ensureSecurePermissions', () => {
    it('should set secure file permissions', async () => {
      await ensureSecurePermissions(testFile)
      
      const stats = await fs.stat(testFile)
      // Should be readable/writable by owner
      assert(stats.mode & 0o600)
    })

    it('should set secure directory permissions', async () => {
      const dir = path.join(testDir, 'securedir')
      await fs.ensureDir(dir)
      
      await ensureSecurePermissions(dir)
      
      const stats = await fs.stat(dir)
      // Should be readable/writable/executable by owner
      assert(stats.mode & 0o700)
    })

    it('should reject path traversal', async () => {
      await assert.rejects(
        () => ensureSecurePermissions('../../../tmp/file.txt'),
        SecurityError
      )
    })

    it('should handle non-existent path', async () => {
      await assert.rejects(
        () => ensureSecurePermissions(path.join(testDir, 'nonexistent.txt')),
        FileOperationError
      )
    })
  })

  describe('isSymlink', () => {
    it('should detect symlinks', async () => {
      // Skip on Windows where symlink creation requires admin rights
      if (process.platform === 'win32') return
      
      const target = path.join(testDir, 'target.txt')
      const link = path.join(testDir, 'link.txt')
      
      await fs.writeFile(target, 'target content')
      await fs.symlink(target, link)
      
      assert(await isSymlink(link))
      assert(!await isSymlink(target))
    })

    it('should return false for regular files', async () => {
      assert(!await isSymlink(testFile))
    })

    it('should return false for directories', async () => {
      assert(!await isSymlink(testDir))
    })

    it('should return false for non-existent paths', async () => {
      assert(!await isSymlink(path.join(testDir, 'nonexistent.txt')))
    })

    it('should reject path traversal', async () => {
      await assert.rejects(
        () => isSymlink('../../../etc/passwd'),
        SecurityError
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long filenames', async () => {
      const longName = 'a'.repeat(200) + '.txt'
      const longPath = path.join(testDir, longName)
      
      await secureWriteFile(longPath, 'content')
      const content = await secureReadFile(longPath)
      assert.equal(content, 'content')
    })

    it('should handle special characters in filenames', async () => {
      const specialName = 'test file (with) [special] {chars} & more.txt'
      const specialPath = path.join(testDir, specialName)
      
      await secureWriteFile(specialPath, 'content')
      assert(await fs.pathExists(specialPath))
    })

    it('should handle empty file operations', async () => {
      const emptyFile = path.join(testDir, 'empty.txt')
      
      await secureWriteFile(emptyFile, '')
      const content = await secureReadFile(emptyFile)
      assert.equal(content, '')
    })

    it('should handle concurrent operations', async () => {
      const promises = []
      
      // Perform multiple operations concurrently
      for (let i = 0; i < 10; i++) {
        const file = path.join(testDir, `concurrent-${i}.txt`)
        promises.push(secureWriteFile(file, `content ${i}`))
      }
      
      await Promise.all(promises)
      
      // Verify all files were created
      for (let i = 0; i < 10; i++) {
        const file = path.join(testDir, `concurrent-${i}.txt`)
        assert(await fs.pathExists(file))
      }
    })
  })
})