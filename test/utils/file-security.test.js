import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  secureCopyFile,
  secureReadFile,
  secureWriteFile,
  secureCreateDir,
  checkPermissions,
  securePathExists,
  secureReadJSON,
  secureWriteJSON,
  secureGetStats,
  secureReadDir
} from '../../src/utils/file-security.js'

describe('File Security Tests', () => {
  it('should export all required functions', () => {
    // Just verify the functions exist
    assert(typeof secureCopyFile === 'function')
    assert(typeof secureReadFile === 'function')
    assert(typeof secureWriteFile === 'function')
    assert(typeof secureCreateDir === 'function')
    assert(typeof checkPermissions === 'function')
    assert(typeof securePathExists === 'function')
    assert(typeof secureReadJSON === 'function')
    assert(typeof secureWriteJSON === 'function')
    assert(typeof secureGetStats === 'function')
    assert(typeof secureReadDir === 'function')
  })
})