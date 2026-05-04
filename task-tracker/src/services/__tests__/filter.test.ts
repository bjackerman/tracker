import { describe, it, expect } from 'vitest'
import {
  applyFilters,
  applySearch,
  applySort,
  computeDueDateStatus,
} from '../FilterService'
import type { Task, FilterCriteria, SortCriteria } from '../../types/index'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    projectId: null,
    title: 'Test Task',
    status: 'To Do',
    priority: 'Medium',
    tags: [],
    customFieldValues: [],
    prerequisiteIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ─── applyFilters — empty result state (Requirement 5.6) ─────────────────────

describe('applyFilters — empty result state (Requirement 5.6)', () => {
  it('returns empty array when no tasks match the status filter', () => {
    const tasks = [
      makeTask({ status: 'To Do' }),
      makeTask({ status: 'In Progress' }),
    ]
    const filters: FilterCriteria = { statuses: ['Done'] }
    expect(applyFilters(tasks, filters)).toEqual([])
  })

  it('returns empty array when no tasks match the priority filter', () => {
    const tasks = [
      makeTask({ priority: 'Low' }),
      makeTask({ priority: 'Medium' }),
    ]
    const filters: FilterCriteria = { priorities: ['Critical'] }
    expect(applyFilters(tasks, filters)).toEqual([])
  })

  it('returns all tasks when no filters are active (empty FilterCriteria)', () => {
    const tasks = [
      makeTask({ title: 'Alpha' }),
      makeTask({ title: 'Beta' }),
      makeTask({ title: 'Gamma' }),
    ]
    expect(applyFilters(tasks, {})).toHaveLength(3)
  })
})

// ─── applySearch — empty result state (Requirement 5.6) ──────────────────────

describe('applySearch — empty result state (Requirement 5.6)', () => {
  it('returns empty array when no tasks match the search query', () => {
    const tasks = [
      makeTask({ title: 'Fix login bug' }),
      makeTask({ title: 'Update README' }),
    ]
    expect(applySearch(tasks, 'zzznomatch')).toEqual([])
  })
})

// ─── applySearch — correctness ────────────────────────────────────────────────

describe('applySearch — correctness', () => {
  it('is case-insensitive: query "HELLO" matches title "hello world"', () => {
    const task = makeTask({ title: 'hello world' })
    const result = applySearch([task], 'HELLO')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(task.id)
  })

  it('matches on description as well as title', () => {
    const task = makeTask({ title: 'Unrelated', description: 'contains the keyword here' })
    const result = applySearch([task], 'keyword')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(task.id)
  })

  it('does not match a task whose title and description both lack the query', () => {
    const task = makeTask({ title: 'Unrelated', description: 'nothing here' })
    expect(applySearch([task], 'keyword')).toEqual([])
  })

  it('returns all tasks when query is empty string', () => {
    const tasks = [makeTask(), makeTask(), makeTask()]
    expect(applySearch(tasks, '')).toHaveLength(3)
  })

  it('returns all tasks when query is whitespace only', () => {
    const tasks = [makeTask(), makeTask()]
    expect(applySearch(tasks, '   ')).toHaveLength(2)
  })
})

// ─── applySort — correctness ──────────────────────────────────────────────────

describe('applySort — correctness', () => {
  it('sorts by title ascending', () => {
    const tasks = [
      makeTask({ title: 'Zebra' }),
      makeTask({ title: 'Apple' }),
      makeTask({ title: 'Mango' }),
    ]
    const sort: SortCriteria = { field: 'title', direction: 'asc' }
    const result = applySort(tasks, sort)
    expect(result.map((t) => t.title)).toEqual(['Apple', 'Mango', 'Zebra'])
  })

  it('sorts by title descending', () => {
    const tasks = [
      makeTask({ title: 'Zebra' }),
      makeTask({ title: 'Apple' }),
      makeTask({ title: 'Mango' }),
    ]
    const sort: SortCriteria = { field: 'title', direction: 'desc' }
    const result = applySort(tasks, sort)
    expect(result.map((t) => t.title)).toEqual(['Zebra', 'Mango', 'Apple'])
  })

  it('sorts by dueDate ascending with nulls last', () => {
    const taskA = makeTask({ title: 'A', dueDate: '2024-03-01' })
    const taskB = makeTask({ title: 'B', dueDate: '2024-01-15' })
    const taskC = makeTask({ title: 'C' }) // no dueDate
    const sort: SortCriteria = { field: 'dueDate', direction: 'asc' }
    const result = applySort([taskA, taskB, taskC], sort)
    expect(result[0].title).toBe('B')
    expect(result[1].title).toBe('A')
    expect(result[2].title).toBe('C') // null last
  })

  it('sorts by dueDate descending with nulls still last', () => {
    const taskA = makeTask({ title: 'A', dueDate: '2024-03-01' })
    const taskB = makeTask({ title: 'B', dueDate: '2024-01-15' })
    const taskC = makeTask({ title: 'C' }) // no dueDate
    const sort: SortCriteria = { field: 'dueDate', direction: 'desc' }
    const result = applySort([taskA, taskB, taskC], sort)
    expect(result[0].title).toBe('A')
    expect(result[1].title).toBe('B')
    expect(result[2].title).toBe('C') // null last regardless of direction
  })

  it('sorts by priority ascending (lower weight first)', () => {
    const taskLow = makeTask({ title: 'Low', priority: 'Low' })
    const taskHigh = makeTask({ title: 'High', priority: 'High' })
    const taskMed = makeTask({ title: 'Medium', priority: 'Medium' })
    const sort: SortCriteria = { field: 'priority', direction: 'asc' }
    const result = applySort([taskHigh, taskLow, taskMed], sort)
    expect(result.map((t) => t.priority)).toEqual(['Low', 'Medium', 'High'])
  })

  it('sorts by priority descending (higher weight first)', () => {
    const taskLow = makeTask({ title: 'Low', priority: 'Low' })
    const taskCritical = makeTask({ title: 'Critical', priority: 'Critical' })
    const taskMed = makeTask({ title: 'Medium', priority: 'Medium' })
    const sort: SortCriteria = { field: 'priority', direction: 'desc' }
    const result = applySort([taskLow, taskMed, taskCritical], sort)
    expect(result.map((t) => t.priority)).toEqual(['Critical', 'Medium', 'Low'])
  })

  it('does not mutate the original array', () => {
    const tasks = [makeTask({ title: 'B' }), makeTask({ title: 'A' })]
    const original = [...tasks]
    applySort(tasks, { field: 'title', direction: 'asc' })
    expect(tasks[0].title).toBe(original[0].title)
    expect(tasks[1].title).toBe(original[1].title)
  })
})

// ─── computeDueDateStatus — correctness ──────────────────────────────────────

describe('computeDueDateStatus — correctness', () => {
  it('returns "overdue" for a past due date with a non-final status', () => {
    const task = makeTask({ status: 'To Do', dueDate: '2020-01-01' })
    const now = new Date('2024-06-15T12:00:00Z')
    expect(computeDueDateStatus(task, now)).toBe('overdue')
  })

  it('returns "due-soon" for a due date within 48 hours', () => {
    // dueDate is today — within 48h window
    const now = new Date('2024-06-15T12:00:00Z')
    const task = makeTask({ status: 'To Do', dueDate: '2024-06-15' })
    expect(computeDueDateStatus(task, now)).toBe('due-soon')
  })

  it('returns "due-soon" for a due date exactly 47 hours from now', () => {
    const now = new Date('2024-06-15T00:00:00Z')
    // 47 hours later = 2024-06-16T23:00:00Z → date string 2024-06-16
    const task = makeTask({ status: 'In Progress', dueDate: '2024-06-16' })
    expect(computeDueDateStatus(task, now)).toBe('due-soon')
  })

  it('returns "normal" for a due date well in the future', () => {
    const task = makeTask({ status: 'To Do', dueDate: '2099-12-31' })
    const now = new Date('2024-06-15T12:00:00Z')
    expect(computeDueDateStatus(task, now)).toBe('normal')
  })

  it('returns "normal" for a task with a final status regardless of due date', () => {
    // "Done" is the final status in DEFAULT_STATUSES
    const task = makeTask({ status: 'Done', dueDate: '2020-01-01' })
    const now = new Date('2024-06-15T12:00:00Z')
    expect(computeDueDateStatus(task, now)).toBe('normal')
  })

  it('returns "normal" for a task with no due date', () => {
    const task = makeTask({ status: 'To Do' }) // no dueDate
    const now = new Date('2024-06-15T12:00:00Z')
    expect(computeDueDateStatus(task, now)).toBe('normal')
  })
})

// ─── Search performance benchmark (Requirement 5.4) ──────────────────────────

describe('Search performance benchmark (Requirement 5.4)', () => {
  it('applySearch over 10,000 tasks completes within 500ms', () => {
    const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta']
    const tasks: Task[] = Array.from({ length: 10_000 }, (_, i) => {
      const titleWord = words[i % words.length]
      const descWord = words[(i + 3) % words.length]
      return makeTask({
        title: `Task ${i} ${titleWord}`,
        description: `Description for task ${i} with ${descWord}`,
      })
    })

    const start = performance.now()
    const result = applySearch(tasks, 'alpha')
    const elapsed = performance.now() - start

    // Sanity check: some tasks should match
    expect(result.length).toBeGreaterThan(0)
    // Performance assertion: must complete within 500ms
    expect(elapsed).toBeLessThan(500)
  })
})
