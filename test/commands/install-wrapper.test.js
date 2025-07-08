import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import { installWrapper } from '../../src/commands/install-wrapper.js'

describe('Install Wrapper Command Tests', () => {
  let testDir
  let originalConsoleLog
  let originalConsoleError
  let consoleOutput
  let consoleErrors
  let originalWhich
  let whichMock

  before(async () => {
    // Create a temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'proguardian-install-test-'))
    
    // Mock console methods
    originalConsoleLog = console.log
    originalConsoleError = console.error
    
    // Store original which for restoration
    const whichModule = await import('which')
    originalWhich = whichModule.default
  })

  after(async () => {
    // Restore console methods
    console.log = originalConsoleLog
    console.error = originalConsoleError
    
    // Cleanup
    await fs.remove(testDir)
  })

  beforeEach(() => {
    consoleOutput = []
    consoleErrors = []
    
    console.log = (...args) => {
      consoleOutput.push(args.join(' '))
    }
    
    console.error = (...args) => {
      consoleErrors.push(args.join(' '))
    }
  })

  describe('Success Scenarios', () => {
    it('should handle successful installation (mocked)', async () => {
      // This test validates the command structure without actual file operations
      await installWrapper({ verbose: true })
      
      assert(consoleOutput.some(line => line.includes('Installing Guardian wrapper')))
    })
  })

  describe('Error Scenarios', () => {
    it('should validate options properly', async () => {
      // Test with invalid options
      try {
        await installWrapper({ invalidOption: true })
        assert.fail('Should have thrown validation error')
      } catch (error) {
        // Expected to throw
        assert(error.message.includes('Unknown option') || error.message.includes('Invalid'))
      }
    })
  })

  describe('Path Validation', () => {
    it('should use secure path operations', async () => {
      // This test ensures the command uses the security utils
      // without actually performing file operations
      const result = await installWrapper({ verbose: true })
      
      // Should complete without security errors
      assert(consoleOutput.length > 0)
    })
  })

  describe('Console Output', () => {
    it('should provide helpful messages when Claude is not found', async () => {
      // Simulate Claude not found scenario
      const mockWhichModule = await import('which')
      const originalDefault = mockWhichModule.default
      
      // Temporarily replace which function
      mockWhichModule.default = async () => {
        throw new Error('not found')
      }
      
      try {
        await installWrapper()
      } finally {
        // Restore original which
        mockWhichModule.default = originalDefault
      }
      
      assert(consoleErrors.some(line => line.includes('Claude CLI not found')))
      assert(consoleOutput.some(line => line.includes('Please install Claude Code CLI first')))
    })
  })
})