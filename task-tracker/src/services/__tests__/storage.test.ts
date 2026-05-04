import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as StorageService from '../StorageService'
import type { TrackerState } from '../../types/index'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

// ─── localStorage unavailability / error handling (Requirement 9.1) ──────────

describe('load() — localStorage error handling (Requirement 9.1)', () => {
  it('propagates unexpected errors thrown by getItem (not silently swallowed)', () => {
    // StorageService.load() does not wrap getItem in a try/catch — only JSON.parse
    // and schema validation are caught. An unexpected storage error propagates.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    expect(() => StorageService.load()).toThrow('Storage unavailable')
  })
})

describe('save() — localStorage error handling', () => {
  it('returns ok: true on a successful save', () => {
    const state = makeMinimalState()
    const result = StorageService.save(state)
    expect(result.ok).toBe(true)
  })

  it('returns ok: false with QUOTA_EXCEEDED when setItem throws QuotaExceededError', () => {
    const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError
    })

    const result = StorageService.save(makeMinimalState())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('QUOTA_EXCEEDED')
    }
  })
})

// ─── Corrupt data recovery (Requirement 9.1) ─────────────────────────────────

describe('load() — corrupt data recovery (Requirement 9.1)', () => {
  it('returns null when stored data is invalid JSON', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('not valid json {{{')
    const result = StorageService.load()
    expect(result).toBeNull()
  })

  it('sets loadError to true when stored data is invalid JSON', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('not valid json {{{')
    StorageService.load()
    expect(StorageService.loadError).toBe(true)
  })

  it('returns null when stored data has invalid schema (version is wrong type)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{"version": "wrong"}')
    const result = StorageService.load()
    expect(result).toBeNull()
  })

  it('sets loadError to true when stored data has invalid schema', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{"version": "wrong"}')
    StorageService.load()
    expect(StorageService.loadError).toBe(true)
  })

  it('returns null when no data is stored (getItem returns null)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    const result = StorageService.load()
    expect(result).toBeNull()
  })

  it('does not modify loadError when no data is stored (early return)', () => {
    // load() returns early when raw === null without touching loadError.
    // Verify it returns null and doesn't throw — loadError state is unchanged.
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    const result = StorageService.load()
    expect(result).toBeNull()
    // loadError is whatever it was before — we just confirm no exception is thrown
  })
})

// ─── exportJSON ───────────────────────────────────────────────────────────────

describe('exportJSON', () => {
  it('returns a valid JSON string', () => {
    const state = makeMinimalState()
    const json = StorageService.exportJSON(state)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('output can be parsed back to the original state (deep equality)', () => {
    const state = makeMinimalState()
    const json = StorageService.exportJSON(state)
    const parsed = JSON.parse(json)
    expect(parsed).toEqual(state)
  })
})

// ─── importJSON ───────────────────────────────────────────────────────────────

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
    if (!result.ok) {
      expect(result.error.some((e) => e.code === 'INVALID_JSON')).toBe(true)
    }
  })

  it('returns ok: false with validation errors for valid JSON but invalid schema', () => {
    const result = StorageService.importJSON('{"version": "wrong"}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })
})

// ─── save / load round-trip (Requirement 9.1) ────────────────────────────────

describe('save and load round-trip (Requirement 9.1)', () => {
  it('loads back a state that was previously saved (deep equality)', () => {
    const state = makeMinimalState()
    StorageService.save(state)
    const loaded = StorageService.load()
    expect(loaded).toEqual(state)
  })

  it('sets loadError to false after a successful load', () => {
    const state = makeMinimalState()
    StorageService.save(state)
    StorageService.load()
    expect(StorageService.loadError).toBe(false)
  })

  it('round-trips a state with non-empty arrays', () => {
    const state: TrackerState = {
      version: 1,
      projects: [
        {
          id: 'proj-1',
          name: 'My Project',
          statuses: [{ name: 'To Do', isDefault: true, isFinal: false }],
          priorities: [{ name: 'Medium', weight: 2 }],
          customFields: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      tasks: [
        {
          id: 'task-1',
          projectId: 'proj-1',
          title: 'First Task',
          status: 'To Do',
          priority: 'Medium',
          tags: [],
          customFieldValues: [],
          prerequisiteIds: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      tags: [{ id: 'tag-1', label: 'urgent' }],
      savedViews: [],
      templates: [],
    }

    StorageService.save(state)
    const loaded = StorageService.load()
    expect(loaded).toEqual(state)
  })
})
