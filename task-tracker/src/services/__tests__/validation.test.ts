import { describe, it, expect } from 'vitest'
import {
  validateTask,
  validateProject,
  validateCustomFieldValue,
  DEFAULT_STATUSES,
  DEFAULT_PRIORITIES,
} from '../ValidationService'
import type { Project, CustomFieldDef } from '../../types/index'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid task input with all required fields */
function makeTaskInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Test Task',
    status: 'To Do',
    priority: 'Medium',
    projectId: null,
    tags: [],
    customFieldValues: [],
    prerequisiteIds: [],
    ...overrides,
  }
}

/** Minimal project using the global defaults */
function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    statuses: DEFAULT_STATUSES,
    priorities: DEFAULT_PRIORITIES,
    customFields: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ─── Default status assignment (Requirement 1.3) ──────────────────────────────

describe('Default status assignment (Requirement 1.3)', () => {
  it('rejects task input with no status field', () => {
    const input = makeTaskInput()
    delete input['status']
    const result = validateTask(input, null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.some((e) => e.field === 'status')).toBe(true)
    }
  })

  it('accepts "To Do" status with null project (uses DEFAULT_STATUSES)', () => {
    const result = validateTask(makeTaskInput({ status: 'To Do' }), null)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.status).toBe('To Do')
    }
  })

  it('accepts "To Do" status with a project that uses DEFAULT_STATUSES', () => {
    const project = makeProject()
    const result = validateTask(makeTaskInput({ status: 'To Do' }), project)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.status).toBe('To Do')
    }
  })
})

// ─── Default priority assignment (Requirement 1.4) ───────────────────────────

describe('Default priority assignment (Requirement 1.4)', () => {
  it('rejects task input with no priority field', () => {
    const input = makeTaskInput()
    delete input['priority']
    const result = validateTask(input, null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.some((e) => e.field === 'priority')).toBe(true)
    }
  })

  it('accepts "Medium" priority with null project (uses DEFAULT_PRIORITIES)', () => {
    const result = validateTask(makeTaskInput({ priority: 'Medium' }), null)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.priority).toBe('Medium')
    }
  })

  it('accepts "Medium" priority with a project that uses DEFAULT_PRIORITIES', () => {
    const project = makeProject()
    const result = validateTask(makeTaskInput({ priority: 'Medium' }), project)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.priority).toBe('Medium')
    }
  })
})

// ─── Title validation (Requirement 1.2) ──────────────────────────────────────

describe('Title validation (Requirement 1.2)', () => {
  it('rejects empty title', () => {
    const result = validateTask(makeTaskInput({ title: '' }), null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.some((e) => e.field === 'title')).toBe(true)
    }
  })

  it('rejects whitespace-only title', () => {
    const result = validateTask(makeTaskInput({ title: '   ' }), null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.some((e) => e.field === 'title')).toBe(true)
    }
  })

  it('accepts a valid non-empty title', () => {
    const result = validateTask(makeTaskInput({ title: 'My Task' }), null)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.title).toBe('My Task')
    }
  })
})

// ─── Project name validation (Requirement 2.2) ───────────────────────────────

describe('Project name validation (Requirement 2.2)', () => {
  it('rejects empty project name', () => {
    const result = validateProject({ name: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.some((e) => e.field === 'name')).toBe(true)
    }
  })

  it('rejects whitespace-only project name', () => {
    const result = validateProject({ name: '   ' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.some((e) => e.field === 'name')).toBe(true)
    }
  })

  it('accepts a valid non-empty project name', () => {
    const result = validateProject({ name: 'My Project' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('My Project')
    }
  })
})

// ─── Custom field validation (Requirements 4.3, 4.6) ─────────────────────────

describe('Custom field validation (Requirements 4.3, 4.6)', () => {
  const textField: CustomFieldDef = { id: 'f1', name: 'Notes', type: 'text' }
  const numberField: CustomFieldDef = { id: 'f2', name: 'Score', type: 'number' }
  const booleanField: CustomFieldDef = { id: 'f3', name: 'Flagged', type: 'boolean' }
  const selectField: CustomFieldDef = {
    id: 'f4',
    name: 'Category',
    type: 'single-select',
    options: ['Alpha', 'Beta', 'Gamma'],
  }
  const dateField: CustomFieldDef = { id: 'f5', name: 'Deadline', type: 'date' }

  describe('text field', () => {
    it('accepts a string value', () => {
      const result = validateCustomFieldValue('hello', textField)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.value).toBe('hello')
    })

    it('rejects a number value', () => {
      const result = validateCustomFieldValue(42, textField)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_TYPE')
    })

    it('accepts null', () => {
      const result = validateCustomFieldValue(null, textField)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.value).toBeNull()
    })
  })

  describe('number field', () => {
    it('accepts a number value', () => {
      const result = validateCustomFieldValue(99, numberField)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.value).toBe(99)
    })

    it('rejects a string value', () => {
      const result = validateCustomFieldValue('99', numberField)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_TYPE')
    })

    it('accepts null', () => {
      const result = validateCustomFieldValue(null, numberField)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.value).toBeNull()
    })
  })

  describe('boolean field', () => {
    it('accepts a boolean value', () => {
      const result = validateCustomFieldValue(true, booleanField)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.value).toBe(true)
    })

    it('rejects a string value', () => {
      const result = validateCustomFieldValue('true', booleanField)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_TYPE')
    })

    it('accepts null', () => {
      const result = validateCustomFieldValue(null, booleanField)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.value).toBeNull()
    })
  })

  describe('single-select field', () => {
    it('accepts a value that is in the options list', () => {
      const result = validateCustomFieldValue('Alpha', selectField)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.value).toBe('Alpha')
    })

    it('rejects a value not in the options list', () => {
      const result = validateCustomFieldValue('Delta', selectField)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_TYPE')
    })

    it('accepts null', () => {
      const result = validateCustomFieldValue(null, selectField)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.value).toBeNull()
    })
  })

  describe('date field', () => {
    it('accepts a valid YYYY-MM-DD date string', () => {
      const result = validateCustomFieldValue('2024-01-15', dateField)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.value).toBe('2024-01-15')
    })

    it('rejects a non-date string', () => {
      const result = validateCustomFieldValue('not-a-date', dateField)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_TYPE')
    })

    it('accepts null', () => {
      const result = validateCustomFieldValue(null, dateField)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.value).toBeNull()
    })
  })
})
