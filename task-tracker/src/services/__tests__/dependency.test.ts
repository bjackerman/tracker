import { describe, it, expect } from 'vitest'
import {
  detectCycle,
  addDependency,
  topologicalSort,
  getDependents,
  getBottlenecks,
} from '../DependencyService'
import type { Task, ID } from '../../types/index'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(id: ID, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId: null,
    title: id, // use id as title for readable error messages
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

// ─── checkIncompletePrerequisites helper (UI-level concern, defined in test) ──

/**
 * Checks whether a task has any prerequisites that are not in a final status.
 * This mirrors the UI-level warning logic described in Requirement 8.2.
 */
function checkIncompletePrerequisites(
  tasks: Task[],
  taskId: ID,
  finalStatuses: string[]
): { hasIncomplete: boolean; count: number } {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return { hasIncomplete: false, count: 0 }

  const incompleteCount = task.prerequisiteIds.filter((prereqId) => {
    const prereq = tasks.find((t) => t.id === prereqId)
    return prereq && !finalStatuses.includes(prereq.status)
  }).length

  return { hasIncomplete: incompleteCount > 0, count: incompleteCount }
}

// ─── topologicalSort (Requirements 8.2, 6.6) ─────────────────────────────────

describe('topologicalSort (Requirements 8.2, 6.6)', () => {
  it('returns empty array for empty input', () => {
    expect(topologicalSort([])).toEqual([])
  })

  it('returns a single task with no dependencies as-is', () => {
    const taskA = makeTask('A')
    const result = topologicalSort([taskA])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('A')
  })

  it('sorts a simple chain A→B→C so prerequisites come first', () => {
    // C depends on B, B depends on A → expected order: A, B, C
    const taskA = makeTask('A')
    const taskB = makeTask('B', { prerequisiteIds: ['A'] })
    const taskC = makeTask('C', { prerequisiteIds: ['B'] })

    const result = topologicalSort([taskC, taskB, taskA])
    const ids = result.map((t) => t.id)

    // A must come before B, B must come before C
    expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('B'))
    expect(ids.indexOf('B')).toBeLessThan(ids.indexOf('C'))
  })

  it('includes tasks with no dependencies in the output', () => {
    const taskA = makeTask('A')
    const taskB = makeTask('B')
    const taskC = makeTask('C', { prerequisiteIds: ['A'] })

    const result = topologicalSort([taskA, taskB, taskC])
    const ids = result.map((t) => t.id)

    expect(ids).toContain('A')
    expect(ids).toContain('B')
    expect(ids).toContain('C')
    expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('C'))
  })

  it('produces a valid topological order for a diamond dependency (D depends on B and C, both depend on A)', () => {
    // A → B → D
    // A → C → D
    const taskA = makeTask('A')
    const taskB = makeTask('B', { prerequisiteIds: ['A'] })
    const taskC = makeTask('C', { prerequisiteIds: ['A'] })
    const taskD = makeTask('D', { prerequisiteIds: ['B', 'C'] })

    const result = topologicalSort([taskD, taskC, taskB, taskA])
    const ids = result.map((t) => t.id)

    // A must come before B and C; B and C must come before D
    expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('B'))
    expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('C'))
    expect(ids.indexOf('B')).toBeLessThan(ids.indexOf('D'))
    expect(ids.indexOf('C')).toBeLessThan(ids.indexOf('D'))
  })

  it('returns all tasks (no task is dropped)', () => {
    const tasks = [
      makeTask('A'),
      makeTask('B', { prerequisiteIds: ['A'] }),
      makeTask('C', { prerequisiteIds: ['A'] }),
      makeTask('D', { prerequisiteIds: ['B', 'C'] }),
    ]
    const result = topologicalSort(tasks)
    expect(result).toHaveLength(4)
  })
})

// ─── checkIncompletePrerequisites (Requirement 8.2) ──────────────────────────

describe('checkIncompletePrerequisites (Requirement 8.2)', () => {
  const FINAL_STATUSES = ['Done']

  it('returns { hasIncomplete: false, count: 0 } when task has no prerequisites', () => {
    const taskA = makeTask('A')
    const result = checkIncompletePrerequisites([taskA], 'A', FINAL_STATUSES)
    expect(result).toEqual({ hasIncomplete: false, count: 0 })
  })

  it('returns { hasIncomplete: false, count: 0 } when all prerequisites are Done', () => {
    const prereq1 = makeTask('P1', { status: 'Done' })
    const prereq2 = makeTask('P2', { status: 'Done' })
    const taskA = makeTask('A', { prerequisiteIds: ['P1', 'P2'] })

    const result = checkIncompletePrerequisites([prereq1, prereq2, taskA], 'A', FINAL_STATUSES)
    expect(result).toEqual({ hasIncomplete: false, count: 0 })
  })

  it('returns { hasIncomplete: true, count: 1 } when one prerequisite is not Done', () => {
    const prereq1 = makeTask('P1', { status: 'Done' })
    const prereq2 = makeTask('P2', { status: 'In Progress' }) // not done
    const taskA = makeTask('A', { prerequisiteIds: ['P1', 'P2'] })

    const result = checkIncompletePrerequisites([prereq1, prereq2, taskA], 'A', FINAL_STATUSES)
    expect(result).toEqual({ hasIncomplete: true, count: 1 })
  })

  it('returns { hasIncomplete: true, count: 2 } when two prerequisites are not Done', () => {
    const prereq1 = makeTask('P1', { status: 'To Do' })
    const prereq2 = makeTask('P2', { status: 'In Progress' })
    const taskA = makeTask('A', { prerequisiteIds: ['P1', 'P2'] })

    const result = checkIncompletePrerequisites([prereq1, prereq2, taskA], 'A', FINAL_STATUSES)
    expect(result).toEqual({ hasIncomplete: true, count: 2 })
  })

  it('returns { hasIncomplete: false, count: 0 } for an unknown taskId', () => {
    const taskA = makeTask('A')
    const result = checkIncompletePrerequisites([taskA], 'nonexistent', FINAL_STATUSES)
    expect(result).toEqual({ hasIncomplete: false, count: 0 })
  })
})

// ─── detectCycle (Requirement 8.3) ───────────────────────────────────────────

describe('detectCycle (Requirement 8.3)', () => {
  it('returns false for two unrelated tasks with no dependencies', () => {
    const taskA = makeTask('A')
    const taskB = makeTask('B')
    expect(detectCycle([taskA, taskB], 'A', 'B')).toBe(false)
  })

  it('returns true for a self-dependency (A depends on A)', () => {
    const taskA = makeTask('A')
    expect(detectCycle([taskA], 'A', 'A')).toBe(true)
  })

  it('returns true for a direct cycle (A depends on B, trying to add B depends on A)', () => {
    const taskA = makeTask('A', { prerequisiteIds: ['B'] })
    const taskB = makeTask('B')
    // Adding B → A would create A → B → A
    expect(detectCycle([taskA, taskB], 'B', 'A')).toBe(true)
  })

  it('returns true for a transitive cycle (B depends on A, C depends on B, trying to add A depends on C)', () => {
    const taskA = makeTask('A')
    const taskB = makeTask('B', { prerequisiteIds: ['A'] })
    const taskC = makeTask('C', { prerequisiteIds: ['B'] })
    // Adding A → C (A depends on C) would create the cycle: C → B → A → C
    // detectCycle(tasks, fromId='A', toId='C'): BFS from C through prerequisites reaches B then A → cycle!
    expect(detectCycle([taskA, taskB, taskC], 'A', 'C')).toBe(true)
  })

  it('returns false when adding a dependency that does not create a cycle', () => {
    const taskA = makeTask('A')
    const taskB = makeTask('B', { prerequisiteIds: ['A'] })
    const taskC = makeTask('C')
    // Adding C → B is fine: B → A, C → B (no cycle)
    expect(detectCycle([taskA, taskB, taskC], 'C', 'B')).toBe(false)
  })
})

// ─── addDependency (Requirements 8.1, 8.3) ───────────────────────────────────

describe('addDependency (Requirements 8.1, 8.3)', () => {
  it('succeeds and adds the dependency when no cycle would be created', () => {
    const taskA = makeTask('A')
    const taskB = makeTask('B')

    const result = addDependency([taskA, taskB], 'B', 'A')

    expect(result.ok).toBe(true)
    if (result.ok) {
      const updatedB = result.value.find((t) => t.id === 'B')
      expect(updatedB?.prerequisiteIds).toContain('A')
    }
  })

  it('fails with an error when adding the dependency would create a cycle', () => {
    const taskA = makeTask('A', { prerequisiteIds: ['B'] })
    const taskB = makeTask('B')

    // Adding B → A would create A → B → A
    const result = addDependency([taskA, taskB], 'B', 'A')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toMatch(/cycle/i)
    }
  })

  it('is idempotent: adding the same dependency twice does not duplicate it', () => {
    const taskA = makeTask('A')
    const taskB = makeTask('B', { prerequisiteIds: ['A'] })

    // B already depends on A — adding again should be a no-op
    const result = addDependency([taskA, taskB], 'B', 'A')

    expect(result.ok).toBe(true)
    if (result.ok) {
      const updatedB = result.value.find((t) => t.id === 'B')
      const aCount = updatedB?.prerequisiteIds.filter((id) => id === 'A').length
      expect(aCount).toBe(1)
    }
  })

  it('returns an error when fromId task does not exist', () => {
    const taskA = makeTask('A')
    const result = addDependency([taskA], 'nonexistent', 'A')
    expect(result.ok).toBe(false)
  })

  it('returns an error when toId task does not exist', () => {
    const taskA = makeTask('A')
    const result = addDependency([taskA], 'A', 'nonexistent')
    expect(result.ok).toBe(false)
  })

  it('does not mutate the original tasks array on success', () => {
    const taskA = makeTask('A')
    const taskB = makeTask('B')
    const original = [taskA, taskB]

    addDependency(original, 'B', 'A')

    // Original B should still have no prerequisites
    expect(original[1].prerequisiteIds).toHaveLength(0)
  })
})

// ─── getDependents (Requirement 8.4) ─────────────────────────────────────────

describe('getDependents (Requirement 8.4)', () => {
  it('returns tasks that depend on a given task', () => {
    const taskA = makeTask('A')
    const taskB = makeTask('B', { prerequisiteIds: ['A'] })
    const taskC = makeTask('C', { prerequisiteIds: ['A'] })
    const taskD = makeTask('D') // does not depend on A

    const dependents = getDependents([taskA, taskB, taskC, taskD], 'A')
    const ids = dependents.map((t) => t.id)

    expect(ids).toContain('B')
    expect(ids).toContain('C')
    expect(ids).not.toContain('D')
    expect(ids).not.toContain('A')
  })

  it('returns empty array when no tasks depend on the given task', () => {
    const taskA = makeTask('A')
    const taskB = makeTask('B')

    const dependents = getDependents([taskA, taskB], 'A')
    expect(dependents).toEqual([])
  })

  it('returns empty array for an unknown taskId', () => {
    const taskA = makeTask('A')
    const dependents = getDependents([taskA], 'nonexistent')
    expect(dependents).toEqual([])
  })
})

// ─── getBottlenecks (Requirements 6.7, 8.5) ──────────────────────────────────

describe('getBottlenecks (Requirements 6.7, 8.5)', () => {
  it('identifies a task that blocks other non-final tasks as a bottleneck', () => {
    const taskA = makeTask('A', { status: 'In Progress' }) // blocks B
    const taskB = makeTask('B', { status: 'To Do', prerequisiteIds: ['A'] })

    const bottlenecks = getBottlenecks([taskA, taskB])
    const ids = bottlenecks.map((b) => b.taskId)

    expect(ids).toContain('A')
  })

  it('does not include final-status tasks as bottlenecks', () => {
    const taskA = makeTask('A', { status: 'Done' }) // final — should NOT be a bottleneck
    const taskB = makeTask('B', { status: 'To Do', prerequisiteIds: ['A'] })

    const bottlenecks = getBottlenecks([taskA, taskB])
    const ids = bottlenecks.map((b) => b.taskId)

    expect(ids).not.toContain('A')
  })

  it('does not include a task as a bottleneck when all its dependents are final', () => {
    const taskA = makeTask('A', { status: 'In Progress' })
    const taskB = makeTask('B', { status: 'Done', prerequisiteIds: ['A'] }) // dependent is final

    const bottlenecks = getBottlenecks([taskA, taskB])
    const ids = bottlenecks.map((b) => b.taskId)

    // A blocks only a Done task, so it is not a bottleneck
    expect(ids).not.toContain('A')
  })

  it('returns correct blockedCount for a task blocking multiple non-final tasks', () => {
    const taskA = makeTask('A', { status: 'To Do' })
    const taskB = makeTask('B', { status: 'To Do', prerequisiteIds: ['A'] })
    const taskC = makeTask('C', { status: 'In Progress', prerequisiteIds: ['A'] })
    const taskD = makeTask('D', { status: 'Done', prerequisiteIds: ['A'] }) // final — not counted

    const bottlenecks = getBottlenecks([taskA, taskB, taskC, taskD])
    const aBottleneck = bottlenecks.find((b) => b.taskId === 'A')

    expect(aBottleneck).toBeDefined()
    expect(aBottleneck?.blockedCount).toBe(2) // B and C, not D
  })

  it('returns empty array when no task is blocking any non-final task', () => {
    const taskA = makeTask('A', { status: 'To Do' })
    const taskB = makeTask('B', { status: 'To Do' }) // no dependency on A

    const bottlenecks = getBottlenecks([taskA, taskB])
    expect(bottlenecks).toEqual([])
  })

  it('respects custom finalStatuses parameter', () => {
    const taskA = makeTask('A', { status: 'Archived' }) // custom final status
    const taskB = makeTask('B', { status: 'To Do', prerequisiteIds: ['A'] })

    // With 'Archived' as final, A should NOT be a bottleneck
    const bottlenecks = getBottlenecks([taskA, taskB], ['Archived'])
    const ids = bottlenecks.map((b) => b.taskId)

    expect(ids).not.toContain('A')
  })
})
