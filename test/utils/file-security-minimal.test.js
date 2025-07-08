import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import {
  securePathExists,
  secureReadJSON,
  secureWriteJSON,
  secureGetStats,
  secureReadDir,
  secureCreateDir,
  secureDeleteFile
} from '../../src/utils/file-security.js'

describe('File Security Additional Tests', () => {
  let testDir

  before(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proguardian-security-test-'))
  })

  after(async () => {
    await fs.remove(testDir)
  })

  describe('secureCreateDir', () => {
    it('should create directory with validation', async () => {
      const dirPath = path.join(testDir, 'testdir')
      
      await secureCreateDir(dirPath)
      
      assert(await fs.pathExists(dirPath))
    })

    it('should reject invalid paths', async () => {
      await assert.rejects(
        () => secureCreateDir('../../../evil'),
        /Path traversal/
      )
    })
  })

  describe('secureDeleteFile', () => {
    it('should delete file safely', async () => {
      const filePath = path.join(testDir, 'delete-me.txt')
      await fs.writeFile(filePath, 'content')
      
      await secureDeleteFile(filePath)
      
      assert(!await fs.pathExists(filePath))
    })

    it('should handle missing files gracefully', async () => {
      const filePath = path.join(testDir, 'missing.txt')
      
      // Should not throw
      await secureDeleteFile(filePath)
    })
  })

  describe('secureReadJSON', () => {
    it('should read JSON files', async () => {
      const jsonPath = path.join(testDir, 'test.json')
      const data = { test: true, value: 42 }
      await fs.writeJSON(jsonPath, data)
      
      const result = await secureReadJSON(jsonPath)
      
      assert.deepEqual(result, data)
    })

    it('should reject invalid JSON', async () => {
      const badPath = path.join(testDir, 'bad.json')
      await fs.writeFile(badPath, 'not json')
      
      await assert.rejects(
        () => secureReadJSON(badPath),
        /Invalid JSON/
      )
    })
  })

  describe('secureWriteJSON', () => {
    it('should write JSON files', async () => {
      const jsonPath = path.join(testDir, 'output.json')
      const data = { written: true }
      
      await secureWriteJSON(jsonPath, data)
      
      const content = await fs.readJSON(jsonPath)
      assert.deepEqual(content, data)
    })

    it('should format JSON nicely', async () => {
      const jsonPath = path.join(testDir, 'formatted.json')
      const data = { a: 1, b: 2 }
      
      await secureWriteJSON(jsonPath, data)
      
      const content = await fs.readFile(jsonPath, 'utf-8')
      assert(content.includes('  ')) // Check indentation
    })
  })

  describe('secureGetStats', () => {
    it('should get file stats', async () => {
      const filePath = path.join(testDir, 'stats.txt')
      await fs.writeFile(filePath, 'content')
      
      const stats = await secureGetStats(filePath)
      
      assert(stats.isFile())
      assert(stats.size > 0)
    })

    it('should reject invalid paths', async () => {
      await assert.rejects(
        () => secureGetStats('../../etc/passwd'),
        /Path traversal/
      )
    })
  })

  describe('secureReadDir', () => {
    it('should read directory contents', async () => {
      const dirPath = path.join(testDir, 'readdir')
      await fs.ensureDir(dirPath)
      await fs.writeFile(path.join(dirPath, 'file1.txt'), 'content1')
      await fs.writeFile(path.join(dirPath, 'file2.txt'), 'content2')
      
      const files = await secureReadDir(dirPath)
      
      assert(files.includes('file1.txt'))
      assert(files.includes('file2.txt'))
    })

    it('should support filtering', async () => {
      const dirPath = path.join(testDir, 'filterdir')
      await fs.ensureDir(dirPath)
      await fs.writeFile(path.join(dirPath, 'keep.txt'), 'content')
      await fs.writeFile(path.join(dirPath, 'ignore.log'), 'log')
      
      const files = await secureReadDir(dirPath, { 
        filter: (name) => name.endsWith('.txt') 
      })
      
      assert(files.includes('keep.txt'))
      assert(!files.includes('ignore.log'))
    })
  })
})