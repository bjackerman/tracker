import { describe, it, expect, beforeEach } from 'vitest'
import * as StorageService from '../StorageService'
import type { TrackerState } from '../../types/index'

function makeMinimalState(): TrackerState {
  return {
    version: 1,
    projects: [],
    tasks: [],
    tags: [],
    savedViews: [],
    templates: [],
  }
}

beforeEach(async () => {
  await StorageService.clearDB()
})

describe('save()', () => {
  it('returns ok: true on a successful save', async () => {
    const result = await StorageService.save(makeMinimalState())
    expect(result.ok).toBe(true)
  })
})

describe('load() corrupt data handling', () => {
  it('returns null when no data is stored', async () => {
    const result = await StorageService.load()
    expect(result).toBeNull()
  })
})

describe('exportJSON', () => {
  it('returns a valid JSON string', () => {
    const state = makeMinimalState()
    const json = StorageService.exportJSON(state)
    expect(() => JSON.parse(json)).not.toThrow()
  })
})

describe('importJSON', () => {
  it('returns ok: true for valid JSON matching the TrackerState schema', () => {
    const state = makeMinimalState()
    const json = StorageService.exportJSON(state)
    const result = StorageService.importJSON(json)
    expect(result.ok).toBe(true)
  })

  it('returns ok: false with INVALID_JSON error for malformed JSON', () => {
    const result = StorageService.importJSON('not valid json {{{')
    expect(result.ok).toBe(false)
  })
})

describe('save and load round-trip', () => {
  it('loads back a state that was previously saved (deep equality)', async () => {
    const state = makeMinimalState()
    await StorageService.save(state)
    const loaded = await StorageService.load()
    expect(loaded).toEqual(state)
  })

  it('sets loadError to false after a successful load', async () => {
    const state = makeMinimalState()
    await StorageService.save(state)
    await StorageService.load()
    expect(StorageService.loadError).toBe(false)
  })
})
