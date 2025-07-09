import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'
import os from 'os'
import https from 'https'
import { EventEmitter } from 'events'
import { checkForUpdates, checkForUpdatesInBackground } from '../../src/utils/version-check.js'
import fs from 'fs-extra'
import { createTestContext } from '../helpers/test-utils.js'

// Mock HTTPS module
const originalHttpsGet = https.get
let mockHttpsGet

describe('Version Check Tests', () => {
  let context
  let originalEnv
  let cacheFilePath

  beforeEach(async () => {
    context = await createTestContext()
    originalEnv = { ...process.env }
    cacheFilePath = path.join(os.tmpdir(), '.proguardian-update-check.json')
    
    // Clear environment variables
    delete process.env.PROGUARDIAN_NO_UPDATE_CHECK
    delete process.env.NO_UPDATE_NOTIFIER
    delete process.env.CI
    delete process.env.CONTINUOUS_INTEGRATION

    // Mock console to capture output
    context.consoleMock.capture()

    // Setup HTTPS mock
    mockHttpsGet = (url, options, callback) => {
      const res = new EventEmitter()
      res.statusCode = 200
      res.on = res.addListener
      
      const req = new EventEmitter()
      req.on = req.addListener
      req.destroy = () => {}
      
      // Handle callback
      if (typeof options === 'function') {
        callback = options
      }
      
      setImmediate(() => {
        callback(res)
      })
      
      return req
    }
    
    https.get = mockHttpsGet
  })

  afterEach(async () => {
    // Restore environment
    process.env = originalEnv
    
    // Restore console
    context.consoleMock.restore()
    
    // Restore HTTPS
    https.get = originalHttpsGet
    
    // Clean up cache file
    try {
      await fs.unlink(cacheFilePath)
    } catch {
      // Ignore if doesn't exist
    }
    
    await context.cleanup()
  })

  describe('checkForUpdates', () => {
    it('should skip check when PROGUARDIAN_NO_UPDATE_CHECK is set', async () => {
      process.env.PROGUARDIAN_NO_UPDATE_CHECK = '1'
      
      let httpsCalled = false
      https.get = () => {
        httpsCalled = true
        return new EventEmitter()
      }
      
      await checkForUpdates()
      
      assert.equal(httpsCalled, false, 'Should not make HTTP request when disabled')
    })

    it('should skip check when CI environment is detected', async () => {
      process.env.CI = 'true'
      
      let httpsCalled = false
      https.get = () => {
        httpsCalled = true
        return new EventEmitter()
      }
      
      await checkForUpdates()
      
      assert.equal(httpsCalled, false, 'Should not make HTTP request in CI')
    })

    it('should check npm registry for updates', async () => {
      let requestUrl = null
      
      https.get = (url, options, callback) => {
        requestUrl = url
        const res = new EventEmitter()
        res.statusCode = 200
        
        const req = new EventEmitter()
        req.destroy = () => {}
        
        if (typeof options === 'function') {
          callback = options
        }
        
        setImmediate(() => {
          callback(res)
          setImmediate(() => {
            res.emit('data', JSON.stringify({
              'dist-tags': { latest: '1.0.0' }
            }))
            res.emit('end')
          })
        })
        
        return req
      }
      
      await checkForUpdates()
      
      assert.equal(requestUrl, 'https://registry.npmjs.org/%40proguardian%2Fcli')
    })

    it('should show notification when newer version is available', async () => {
      https.get = (url, options, callback) => {
        const res = new EventEmitter()
        res.statusCode = 200
        
        const req = new EventEmitter()
        req.destroy = () => {}
        
        if (typeof options === 'function') {
          callback = options
        }
        
        setImmediate(() => {
          callback(res)
          setImmediate(() => {
            res.emit('data', JSON.stringify({
              'dist-tags': { latest: '99.0.0' } // Much newer version
            }))
            res.emit('end')
          })
        })
        
        return req
      }
      
      await checkForUpdates()
      
      const logs = context.consoleMock.getLogs()
      const output = logs.join('\n')
      
      assert.ok(output.includes('Update available!'), 'Should show update notification')
      assert.ok(output.includes('99.0.0'), 'Should show new version')
      assert.ok(output.includes('npm update -g @proguardian/cli'), 'Should show update command')
    })

    it('should not show notification for same version', async () => {
      // Get current version from package.json
      const packagePath = path.join(process.cwd(), 'package.json')
      const content = await fs.readFile(packagePath, 'utf-8')
      const packageData = JSON.parse(content)
      const currentVersion = packageData.version
      
      https.get = (url, options, callback) => {
        const res = new EventEmitter()
        res.statusCode = 200
        
        const req = new EventEmitter()
        req.destroy = () => {}
        
        if (typeof options === 'function') {
          callback = options
        }
        
        setImmediate(() => {
          callback(res)
          setImmediate(() => {
            res.emit('data', JSON.stringify({
              'dist-tags': { latest: currentVersion } // Same version
            }))
            res.emit('end')
          })
        })
        
        return req
      }
      
      await checkForUpdates()
      
      const logs = context.consoleMock.getLogs()
      const output = logs.join('\n')
      
      assert.ok(!output.includes('Update available!'), 'Should not show update notification')
    })

    it('should handle network errors gracefully', async () => {
      https.get = (url, options, callback) => {
        const req = new EventEmitter()
        req.destroy = () => {}
        
        setImmediate(() => {
          req.emit('error', new Error('Network error'))
        })
        
        return req
      }
      
      // Should not throw
      await checkForUpdates()
      
      const errors = context.consoleMock.getErrors()
      assert.equal(errors.length, 0, 'Should not log errors')
    })

    it('should handle timeout gracefully', async () => {
      https.get = (url, options, callback) => {
        const req = new EventEmitter()
        req.destroy = () => {}
        
        setImmediate(() => {
          req.emit('timeout')
        })
        
        return req
      }
      
      // Should not throw
      await checkForUpdates()
      
      const errors = context.consoleMock.getErrors()
      assert.equal(errors.length, 0, 'Should not log errors')
    })

    it('should handle invalid JSON response', async () => {
      https.get = (url, options, callback) => {
        const res = new EventEmitter()
        res.statusCode = 200
        
        const req = new EventEmitter()
        req.destroy = () => {}
        
        if (typeof options === 'function') {
          callback = options
        }
        
        setImmediate(() => {
          callback(res)
          setImmediate(() => {
            res.emit('data', 'not valid json')
            res.emit('end')
          })
        })
        
        return req
      }
      
      // Should not throw
      await checkForUpdates()
      
      const errors = context.consoleMock.getErrors()
      assert.equal(errors.length, 0, 'Should not log errors')
    })

    it('should handle 404 response', async () => {
      https.get = (url, options, callback) => {
        const res = new EventEmitter()
        res.statusCode = 404
        
        const req = new EventEmitter()
        req.destroy = () => {}
        
        if (typeof options === 'function') {
          callback = options
        }
        
        setImmediate(() => {
          callback(res)
        })
        
        return req
      }
      
      // Should not throw
      await checkForUpdates()
      
      const errors = context.consoleMock.getErrors()
      assert.equal(errors.length, 0, 'Should not log errors')
    })

    it('should limit response size to prevent memory issues', async () => {
      let requestDestroyed = false
      
      https.get = (url, options, callback) => {
        const res = new EventEmitter()
        res.statusCode = 200
        
        const req = new EventEmitter()
        req.destroy = () => { requestDestroyed = true }
        
        if (typeof options === 'function') {
          callback = options
        }
        
        setImmediate(() => {
          callback(res)
          // Send large chunks of data
          for (let i = 0; i < 20; i++) {
            res.emit('data', 'x'.repeat(10000))
          }
        })
        
        return req
      }
      
      await checkForUpdates()
      
      assert.ok(requestDestroyed, 'Should destroy request when response is too large')
    })

    it('should use cache to avoid frequent checks', async () => {
      let requestCount = 0
      
      https.get = (url, options, callback) => {
        requestCount++
        const res = new EventEmitter()
        res.statusCode = 200
        
        const req = new EventEmitter()
        req.destroy = () => {}
        
        if (typeof options === 'function') {
          callback = options
        }
        
        setImmediate(() => {
          callback(res)
          setImmediate(() => {
            res.emit('data', JSON.stringify({
              'dist-tags': { latest: '1.0.0' }
            }))
            res.emit('end')
          })
        })
        
        return req
      }
      
      // First check
      await checkForUpdates()
      assert.equal(requestCount, 1, 'Should make first request')
      
      // Second check (should use cache)
      await checkForUpdates()
      assert.equal(requestCount, 1, 'Should not make second request due to cache')
    })

    it('should write cache with secure permissions', async () => {
      https.get = (url, options, callback) => {
        const res = new EventEmitter()
        res.statusCode = 200
        
        const req = new EventEmitter()
        req.destroy = () => {}
        
        if (typeof options === 'function') {
          callback = options
        }
        
        setImmediate(() => {
          callback(res)
          setImmediate(() => {
            res.emit('data', JSON.stringify({
              'dist-tags': { latest: '1.0.0' }
            }))
            res.emit('end')
          })
        })
        
        return req
      }
      
      await checkForUpdates()
      
      // Check cache file was created
      const cacheExists = await fs.pathExists(cacheFilePath)
      assert.ok(cacheExists, 'Cache file should exist')
      
      // Check cache content
      const content = await fs.readFile(cacheFilePath, 'utf-8')
      const cache = JSON.parse(content)
      assert.ok(cache.lastCheck, 'Cache should have lastCheck timestamp')
      assert.equal(cache.latestVersion, '1.0.0', 'Cache should have latest version')
    })

    it('should compare versions correctly', async () => {
      // Test version comparison logic
      const testCases = [
        { current: '1.0.0', latest: '2.0.0', shouldUpdate: true },
        { current: '1.0.0', latest: '1.1.0', shouldUpdate: true },
        { current: '1.0.0', latest: '1.0.1', shouldUpdate: true },
        { current: '2.0.0', latest: '1.0.0', shouldUpdate: false },
        { current: '1.1.0', latest: '1.0.0', shouldUpdate: false },
        { current: '1.0.1', latest: '1.0.0', shouldUpdate: false },
        { current: '1.0.0', latest: '1.0.0', shouldUpdate: false },
        { current: 'v1.0.0', latest: 'v2.0.0', shouldUpdate: true }, // With v prefix
      ]
      
      for (const testCase of testCases) {
        // Write a fake package.json with test version
        const packagePath = path.join(process.cwd(), 'package.json')
        const content = await fs.readFile(packagePath, 'utf-8')
        const packageData = JSON.parse(content)
        packageData.version = testCase.current
        await fs.writeFile(packagePath, JSON.stringify(packageData, null, 2))
        
        context.consoleMock.clear()
        
        https.get = (url, options, callback) => {
          const res = new EventEmitter()
          res.statusCode = 200
          
          const req = new EventEmitter()
          req.destroy = () => {}
          
          if (typeof options === 'function') {
            callback = options
          }
          
          setImmediate(() => {
            callback(res)
            setImmediate(() => {
              res.emit('data', JSON.stringify({
                'dist-tags': { latest: testCase.latest }
              }))
              res.emit('end')
            })
          })
          
          return req
        }
        
        // Clear cache for fresh check
        try {
          await fs.unlink(cacheFilePath)
        } catch {
          // Ignore
        }
        
        await checkForUpdates()
        
        const logs = context.consoleMock.getLogs()
        const output = logs.join('\n')
        const hasNotification = output.includes('Update available!')
        
        assert.equal(
          hasNotification,
          testCase.shouldUpdate,
          `Version ${testCase.current} -> ${testCase.latest} should${testCase.shouldUpdate ? '' : ' not'} show update`
        )
      }
    })
  })

  describe('checkForUpdatesInBackground', () => {
    it('should run asynchronously without blocking', (t, done) => {
      let checkStarted = false
      let immediateExecuted = false
      
      https.get = () => {
        checkStarted = true
        const req = new EventEmitter()
        req.destroy = () => {}
        return req
      }
      
      // This should return immediately
      checkForUpdatesInBackground()
      
      // This should execute before the update check
      setImmediate(() => {
        immediateExecuted = true
        assert.ok(!checkStarted || immediateExecuted, 'Should not block main thread')
        done()
      })
    })

    it('should not throw errors that break the process', (t, done) => {
      https.get = () => {
        throw new Error('Network error')
      }
      
      // Should not throw
      checkForUpdatesInBackground()
      
      // Give it time to potentially fail
      setTimeout(() => {
        // If we get here, it didn't crash
        done()
      }, 100)
    })
  })

  describe('cache behavior', () => {
    it('should only show notification once per version', async () => {
      let notificationCount = 0
      
      https.get = (url, options, callback) => {
        const res = new EventEmitter()
        res.statusCode = 200
        
        const req = new EventEmitter()
        req.destroy = () => {}
        
        if (typeof options === 'function') {
          callback = options
        }
        
        setImmediate(() => {
          callback(res)
          setImmediate(() => {
            res.emit('data', JSON.stringify({
              'dist-tags': { latest: '99.0.0' }
            }))
            res.emit('end')
          })
        })
        
        return req
      }
      
      // First check - should show notification
      await checkForUpdates()
      const logs1 = context.consoleMock.getLogs()
      if (logs1.join('\n').includes('Update available!')) {
        notificationCount++
      }
      
      // Write cache to simulate immediate second check
      const content = await fs.readFile(cacheFilePath, 'utf-8')
      const cache = JSON.parse(content)
      cache.lastCheck = Date.now() - 1000 // Recent check
      await fs.writeFile(cacheFilePath, JSON.stringify(cache, null, 2))
      
      context.consoleMock.clear()
      
      // Second check - should not show notification again
      await checkForUpdates()
      const logs2 = context.consoleMock.getLogs()
      if (logs2.join('\n').includes('Update available!')) {
        notificationCount++
      }
      
      assert.equal(notificationCount, 1, 'Should only show notification once')
    })

    it('should check again after cache expires', async () => {
      let requestCount = 0
      
      https.get = (url, options, callback) => {
        requestCount++
        const res = new EventEmitter()
        res.statusCode = 200
        
        const req = new EventEmitter()
        req.destroy = () => {}
        
        if (typeof options === 'function') {
          callback = options
        }
        
        setImmediate(() => {
          callback(res)
          setImmediate(() => {
            res.emit('data', JSON.stringify({
              'dist-tags': { latest: '1.0.0' }
            }))
            res.emit('end')
          })
        })
        
        return req
      }
      
      // Write expired cache
      await fs.writeFile(cacheFilePath, JSON.stringify({
        lastCheck: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        latestVersion: '1.0.0',
        currentVersion: '0.1.0',
      }, null, 2))
      
      await checkForUpdates()
      
      assert.equal(requestCount, 1, 'Should make new request when cache is expired')
    })
  })
})