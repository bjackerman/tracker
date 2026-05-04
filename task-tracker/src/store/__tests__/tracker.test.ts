import { beforeEach, describe, it, expect } from 'vitest'
import { useTrackerStore } from '../../store/trackerStore'
import type { TaskInput, ProjectInput } from '../../types/index'
import { DEFAULT_STATUSES, DEFAULT_PRIORITIES } from '../../services/ValidationService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStore() {
  return useTrackerStore.getState()
}

/**
 * Reset the store to an empty state by importing an empty TrackerState JSON.
 * This is the recommended approach for Zustand singleton stores in tests.
 */
function resetStore() {
  const emptyState = JSON.stringify({
    version: 1,
    projects: [],
    tasks: [],
    tags: [],
    savedViews: [],
    templates: [],
  })
  useTrackerStore.getState().importData(emptyState)
}

function makeProjectInput(overrides: Partial<ProjectInput> = {}): ProjectInput {
  return {
    name: 'Test Project',
    statuses: DEFAULT_STATUSES,
    priorities: DEFAULT_PRIORITIES,
    customFields: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeTaskInput(projectId: string | null, overrides: Partial<TaskInput> = {}): TaskInput {
  return {
    projectId,
    title: 'Test Task',
    status: 'To Do',
    priority: 'Medium',
    tags: [],
    customFieldValues: [],
    prerequisiteIds: [],
    ...overrides,
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

// ─── 1. Full store action flow: create → update → delete (Requirement 2.5) ───

describe('Full store action flow: create project → create task → update task → delete task (Requirement 2.5)', () => {
  it('creates a project, creates a task in it, updates the task title, then deletes the task', () => {
    const store = getStore()

    // Create project
    const projectResult = store.createProject(makeProjectInput({ name: 'My Project' }))
    expect(projectResult.ok).toBe(true)
    if (!projectResult.ok) return
    const project = projectResult.value

    // Create task in project
    const taskResult = store.createTask(makeTaskInput(project.id, { title: 'Original Title' }))
    expect(taskResult.ok).toBe(true)
    if (!taskResult.ok) return
    const task = taskResult.value

    expect(getStore().tasks).toHaveLength(1)
    expect(getStore().tasks[0].title).toBe('Original Title')

    // Update task title
    const updateResult = store.updateTask(task.id, { title: 'Updated Title' })
    expect(updateResult.ok).toBe(true)
    expect(getStore().tasks[0].title).toBe('Updated Title')

    // Delete task
    store.deleteTask(task.id)

    // Assert task is gone
    const remaining = getStore().tasks
    expect(remaining).toHaveLength(0)
    expect(remaining.find((t) => t.id === task.id)).toBeUndefined()
  })

  it('deleting a task removes its ID from all prerequisiteIds of other tasks', () => {
    const store = getStore()

    const taskAResult = store.createTask(makeTaskInput(null, { title: 'Task A' }))
    const taskBResult = store.createTask(makeTaskInput(null, { title: 'Task B' }))
    expect(taskAResult.ok).toBe(true)
    expect(taskBResult.ok).toBe(true)
    if (!taskAResult.ok || !taskBResult.ok) return

    const taskA = taskAResult.value
    const taskB = taskBResult.value

    // B depends on A
    const depResult = store.addDependency(taskB.id, taskA.id)
    expect(depResult.ok).toBe(true)
    expect(getStore().tasks.find((t) => t.id === taskB.id)?.prerequisiteIds).toContain(taskA.id)

    // Delete A
    store.deleteTask(taskA.id)

    // A is gone and B no longer references it
    const state = getStore()
    expect(state.tasks.find((t) => t.id === taskA.id)).toBeUndefined()
    expect(state.tasks.find((t) => t.id === taskB.id)?.prerequisiteIds).not.toContain(taskA.id)
  })
})

// ─── 2. Import/export via store (Requirements 9.1–9.5) ───────────────────────

describe('Import/export via store (Requirements 9.1–9.5)', () => {
  it('exports state, resets store, imports back, and state matches original', () => {
    const store = getStore()

    // Create some data
    const projResult = store.createProject(makeProjectInput({ name: 'Export Project' }))
    expect(projResult.ok).toBe(true)
    if (!projResult.ok) return
    const project = projResult.value

    const taskResult = store.createTask(makeTaskInput(project.id, { title: 'Exported Task' }))
    expect(taskResult.ok).toBe(true)
    if (!taskResult.ok) return

    // Export
    const json = store.exportData()
    expect(() => JSON.parse(json)).not.toThrow()

    const exportedParsed = JSON.parse(json)
    expect(exportedParsed.projects).toHaveLength(1)
    expect(exportedParsed.tasks).toHaveLength(1)

    // Reset store
    resetStore()
    expect(getStore().projects).toHaveLength(0)
    expect(getStore().tasks).toHaveLength(0)

    // Import
    const importResult = getStore().importData(json)
    expect(importResult.ok).toBe(true)

    // Assert state matches original
    const state = getStore()
    expect(state.projects).toHaveLength(1)
    expect(state.projects[0].name).toBe('Export Project')
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0].title).toBe('Exported Task')
  })

  it('re-exporting after import produces semantically equivalent JSON (round-trip, Requirement 9.5)', () => {
    const store = getStore()

    const projResult = store.createProject(makeProjectInput({ name: 'Round-trip Project' }))
    expect(projResult.ok).toBe(true)
    if (!projResult.ok) return

    store.createTask(makeTaskInput(projResult.value.id, { title: 'Round-trip Task' }))

    const export1 = store.exportData()

    resetStore()
    getStore().importData(export1)

    const export2 = getStore().exportData()

    // Both exports should have the same data (compare parsed objects, ignoring built-in views)
    const parsed1 = JSON.parse(export1)
    const parsed2 = JSON.parse(export2)

    expect(parsed1.projects).toEqual(parsed2.projects)
    expect(parsed1.tasks).toEqual(parsed2.tasks)
    expect(parsed1.tags).toEqual(parsed2.tags)
    expect(parsed1.templates).toEqual(parsed2.templates)
    expect(parsed1.version).toEqual(parsed2.version)
  })

  it('rejects import of malformed JSON with errors (Requirement 9.4)', () => {
    const result = getStore().importData('not valid json {{{')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  it('rejects import of schema-invalid data with errors (Requirement 9.4)', () => {
    const result = getStore().importData('{"version": "wrong"}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })
})

// ─── 3. Built-in view existence and undeletability (Requirements 6.6, 6.8) ───

describe('Built-in view existence and undeletability (Requirements 6.6, 6.8)', () => {
  const BUILT_IN_VIEW_NAMES = [
    'By Due Date',
    'By Priority',
    'Workflow View',
    'Dependency View',
    'All Tasks',
    'My Tasks',
    'Due This Week',
  ]

  it('all 7 built-in views exist after store initialization', () => {
    const { savedViews } = getStore()
    for (const name of BUILT_IN_VIEW_NAMES) {
      const view = savedViews.find((v) => v.name === name)
      expect(view, `Expected built-in view "${name}" to exist`).toBeDefined()
      expect(view?.isBuiltIn).toBe(true)
    }
  })

  it('attempting to delete a built-in view leaves it intact', () => {
    const store = getStore()
    const builtInView = store.savedViews.find((v) => v.isBuiltIn)
    expect(builtInView).toBeDefined()
    if (!builtInView) return

    store.deleteView(builtInView.id)

    const viewAfter = getStore().savedViews.find((v) => v.id === builtInView.id)
    expect(viewAfter).toBeDefined()
    expect(viewAfter?.isBuiltIn).toBe(true)
  })

  it('all 7 built-in views are still present after a delete attempt on each', () => {
    const store = getStore()
    const builtInViews = store.savedViews.filter((v) => v.isBuiltIn)

    for (const view of builtInViews) {
      store.deleteView(view.id)
    }

    const remaining = getStore().savedViews.filter((v) => v.isBuiltIn)
    expect(remaining).toHaveLength(7)

    for (const name of BUILT_IN_VIEW_NAMES) {
      expect(remaining.find((v) => v.name === name)).toBeDefined()
    }
  })
})

// ─── 4. Project deletion prompt strategies (Requirement 2.5) ─────────────────

describe('Project deletion prompt strategies (Requirement 2.5)', () => {
  it('delete-tasks strategy removes the project and all its tasks', () => {
    const store = getStore()

    const projResult = store.createProject(makeProjectInput({ name: 'Doomed Project' }))
    expect(projResult.ok).toBe(true)
    if (!projResult.ok) return
    const project = projResult.value

    store.createTask(makeTaskInput(project.id, { title: 'Task 1' }))
    store.createTask(makeTaskInput(project.id, { title: 'Task 2' }))
    expect(getStore().tasks).toHaveLength(2)

    store.deleteProject(project.id, 'delete-tasks')

    const state = getStore()
    expect(state.projects.find((p) => p.id === project.id)).toBeUndefined()
    expect(state.tasks.filter((t) => t.projectId === project.id)).toHaveLength(0)
    expect(state.tasks).toHaveLength(0)
  })

  it('reassign strategy removes the project but keeps tasks with projectId = null', () => {
    const store = getStore()

    const projResult = store.createProject(makeProjectInput({ name: 'Reassign Project' }))
    expect(projResult.ok).toBe(true)
    if (!projResult.ok) return
    const project = projResult.value

    store.createTask(makeTaskInput(project.id, { title: 'Task A' }))
    store.createTask(makeTaskInput(project.id, { title: 'Task B' }))
    expect(getStore().tasks).toHaveLength(2)

    // Reassign to null (inbox)
    store.deleteProject(project.id, 'reassign')

    const state = getStore()
    expect(state.projects.find((p) => p.id === project.id)).toBeUndefined()
    // Tasks still exist but with projectId = null
    expect(state.tasks).toHaveLength(2)
    for (const task of state.tasks) {
      expect(task.projectId).toBeNull()
    }
  })

  it('delete-tasks strategy also removes deleted task IDs from prerequisiteIds of surviving tasks', () => {
    const store = getStore()

    const projResult = store.createProject(makeProjectInput({ name: 'Project With Deps' }))
    expect(projResult.ok).toBe(true)
    if (!projResult.ok) return
    const project = projResult.value

    // Create a task in the project and a standalone task that depends on it
    const inProjResult = store.createTask(makeTaskInput(project.id, { title: 'In Project' }))
    const standaloneResult = store.createTask(makeTaskInput(null, { title: 'Standalone' }))
    expect(inProjResult.ok).toBe(true)
    expect(standaloneResult.ok).toBe(true)
    if (!inProjResult.ok || !standaloneResult.ok) return

    const inProjTask = inProjResult.value
    const standaloneTask = standaloneResult.value

    // Standalone depends on the in-project task
    store.addDependency(standaloneTask.id, inProjTask.id)
    expect(
      getStore().tasks.find((t) => t.id === standaloneTask.id)?.prerequisiteIds
    ).toContain(inProjTask.id)

    // Delete project with delete-tasks strategy
    store.deleteProject(project.id, 'delete-tasks')

    const state = getStore()
    // Standalone task still exists
    const surviving = state.tasks.find((t) => t.id === standaloneTask.id)
    expect(surviving).toBeDefined()
    // But no longer references the deleted task
    expect(surviving?.prerequisiteIds).not.toContain(inProjTask.id)
  })
})

// ─── 5. Tag operations (Requirements 3.1–3.6) ────────────────────────────────

describe('Tag operations (Requirements 3.1–3.6)', () => {
  it('applying a tag creates it globally and adds it to the task (Requirements 3.1, 3.2, 3.3)', () => {
    const store = getStore()

    const taskResult = store.createTask(makeTaskInput(null, { title: 'Tagged Task' }))
    expect(taskResult.ok).toBe(true)
    if (!taskResult.ok) return
    const task = taskResult.value

    store.applyTag(task.id, 'urgent')

    const state = getStore()
    const tag = state.tags.find((t) => t.label === 'urgent')
    expect(tag).toBeDefined()
    expect(state.tasks.find((t) => t.id === task.id)?.tags).toContain(tag!.id)
  })

  it('removing a tag from a task does not delete it globally (Requirement 3.4)', () => {
    const store = getStore()

    const taskResult = store.createTask(makeTaskInput(null, { title: 'Task' }))
    expect(taskResult.ok).toBe(true)
    if (!taskResult.ok) return
    const task = taskResult.value

    store.applyTag(task.id, 'urgent')
    const tag = getStore().tags.find((t) => t.label === 'urgent')!
    expect(tag).toBeDefined()

    // Remove from task only
    store.removeTagFromTask(task.id, tag.id)

    const state = getStore()
    // Tag still exists globally
    expect(state.tags.find((t) => t.id === tag.id)).toBeDefined()
    // But task no longer has it
    expect(state.tasks.find((t) => t.id === task.id)?.tags).not.toContain(tag.id)
  })

  it('deleting a tag globally removes it from the global list and from all tasks (Requirement 3.6)', () => {
    const store = getStore()

    const task1Result = store.createTask(makeTaskInput(null, { title: 'Task 1' }))
    const task2Result = store.createTask(makeTaskInput(null, { title: 'Task 2' }))
    expect(task1Result.ok).toBe(true)
    expect(task2Result.ok).toBe(true)
    if (!task1Result.ok || !task2Result.ok) return

    store.applyTag(task1Result.value.id, 'urgent')
    store.applyTag(task2Result.value.id, 'urgent')

    const tag = getStore().tags.find((t) => t.label === 'urgent')!
    expect(tag).toBeDefined()

    store.deleteTagGlobally(tag.id)

    const state = getStore()
    // Tag is gone from global list
    expect(state.tags.find((t) => t.id === tag.id)).toBeUndefined()
    // Tag is gone from all tasks
    for (const task of state.tasks) {
      expect(task.tags).not.toContain(tag.id)
    }
  })

  it('applying the same tag label twice is idempotent (no duplicate tag created)', () => {
    const store = getStore()

    const taskResult = store.createTask(makeTaskInput(null, { title: 'Task' }))
    expect(taskResult.ok).toBe(true)
    if (!taskResult.ok) return
    const task = taskResult.value

    store.applyTag(task.id, 'urgent')
    store.applyTag(task.id, 'urgent')

    const state = getStore()
    const urgentTags = state.tags.filter((t) => t.label === 'urgent')
    expect(urgentTags).toHaveLength(1)

    const taskTags = state.tasks.find((t) => t.id === task.id)?.tags ?? []
    const urgentCount = taskTags.filter((id) => id === urgentTags[0].id).length
    expect(urgentCount).toBe(1)
  })
})

// ─── 6. Custom field operations (Requirements 4.1–4.5) ───────────────────────

describe('Custom field operations (Requirements 4.1–4.5)', () => {
  it('adds a custom field to a project and new tasks get the default value (Requirements 4.1, 4.2, 4.4)', () => {
    const store = getStore()

    const projResult = store.createProject(makeProjectInput({ name: 'CF Project' }))
    expect(projResult.ok).toBe(true)
    if (!projResult.ok) return
    const project = projResult.value

    // Add a custom field with a default value
    store.addCustomField(project.id, {
      name: 'Story Points',
      type: 'number',
      defaultValue: { fieldId: '', value: 5 },
    })

    const updatedProject = getStore().projects.find((p) => p.id === project.id)!
    expect(updatedProject.customFields).toHaveLength(1)
    const fieldDef = updatedProject.customFields[0]
    expect(fieldDef.name).toBe('Story Points')
    expect(fieldDef.type).toBe('number')

    // Create a task — it should get the default value
    const taskResult = store.createTask(makeTaskInput(project.id, { title: 'Story Task' }))
    expect(taskResult.ok).toBe(true)
    if (!taskResult.ok) return
    const task = taskResult.value

    const cfv = task.customFieldValues.find((v) => v.fieldId === fieldDef.id)
    expect(cfv).toBeDefined()
    expect(cfv?.value).toBe(5)
  })

  it('removing a custom field from a project clears its values from all tasks (Requirement 4.5)', () => {
    const store = getStore()

    const projResult = store.createProject(makeProjectInput({ name: 'CF Remove Project' }))
    expect(projResult.ok).toBe(true)
    if (!projResult.ok) return
    const project = projResult.value

    store.addCustomField(project.id, {
      name: 'Notes',
      type: 'text',
      defaultValue: { fieldId: '', value: 'default note' },
    })

    const fieldDef = getStore().projects.find((p) => p.id === project.id)!.customFields[0]

    // Create tasks that will have the custom field value
    store.createTask(makeTaskInput(project.id, { title: 'Task 1' }))
    store.createTask(makeTaskInput(project.id, { title: 'Task 2' }))

    // Verify tasks have the field value
    const tasksWithField = getStore().tasks.filter((t) =>
      t.customFieldValues.some((v) => v.fieldId === fieldDef.id)
    )
    expect(tasksWithField).toHaveLength(2)

    // Remove the custom field
    store.removeCustomField(project.id, fieldDef.id)

    // Field is gone from project
    const updatedProject = getStore().projects.find((p) => p.id === project.id)!
    expect(updatedProject.customFields.find((f) => f.id === fieldDef.id)).toBeUndefined()

    // No task in the project has that field's value
    const tasksWithFieldAfter = getStore().tasks.filter((t) =>
      t.customFieldValues.some((v) => v.fieldId === fieldDef.id)
    )
    expect(tasksWithFieldAfter).toHaveLength(0)
  })
})

// ─── 7. Dependency operations (Requirements 8.1–8.3) ─────────────────────────

describe('Dependency operations (Requirements 8.1–8.3)', () => {
  it('adds a dependency: B depends on A — B.prerequisiteIds contains A.id (Requirement 8.1)', () => {
    const store = getStore()

    const aResult = store.createTask(makeTaskInput(null, { title: 'Task A' }))
    const bResult = store.createTask(makeTaskInput(null, { title: 'Task B' }))
    expect(aResult.ok).toBe(true)
    expect(bResult.ok).toBe(true)
    if (!aResult.ok || !bResult.ok) return

    const taskA = aResult.value
    const taskB = bResult.value

    const depResult = store.addDependency(taskB.id, taskA.id)
    expect(depResult.ok).toBe(true)

    const updatedB = getStore().tasks.find((t) => t.id === taskB.id)
    expect(updatedB?.prerequisiteIds).toContain(taskA.id)
  })

  it('adding a circular dependency is rejected with an error (Requirement 8.3)', () => {
    const store = getStore()

    const aResult = store.createTask(makeTaskInput(null, { title: 'Task A' }))
    const bResult = store.createTask(makeTaskInput(null, { title: 'Task B' }))
    expect(aResult.ok).toBe(true)
    expect(bResult.ok).toBe(true)
    if (!aResult.ok || !bResult.ok) return

    const taskA = aResult.value
    const taskB = bResult.value

    // B depends on A
    store.addDependency(taskB.id, taskA.id)

    // Now try to make A depend on B — would create a cycle
    const cycleResult = store.addDependency(taskA.id, taskB.id)
    expect(cycleResult.ok).toBe(false)
    if (!cycleResult.ok) {
      expect(cycleResult.error.message).toMatch(/cycle/i)
    }

    // Graph is unchanged — A still has no prerequisites
    const updatedA = getStore().tasks.find((t) => t.id === taskA.id)
    expect(updatedA?.prerequisiteIds).not.toContain(taskB.id)
  })

  it('removes a dependency: B.prerequisiteIds no longer contains A.id', () => {
    const store = getStore()

    const aResult = store.createTask(makeTaskInput(null, { title: 'Task A' }))
    const bResult = store.createTask(makeTaskInput(null, { title: 'Task B' }))
    expect(aResult.ok).toBe(true)
    expect(bResult.ok).toBe(true)
    if (!aResult.ok || !bResult.ok) return

    const taskA = aResult.value
    const taskB = bResult.value

    store.addDependency(taskB.id, taskA.id)
    expect(getStore().tasks.find((t) => t.id === taskB.id)?.prerequisiteIds).toContain(taskA.id)

    store.removeDependency(taskB.id, taskA.id)

    const updatedB = getStore().tasks.find((t) => t.id === taskB.id)
    expect(updatedB?.prerequisiteIds).not.toContain(taskA.id)
  })

  it('self-dependency is rejected (A depends on A)', () => {
    const store = getStore()

    const aResult = store.createTask(makeTaskInput(null, { title: 'Task A' }))
    expect(aResult.ok).toBe(true)
    if (!aResult.ok) return
    const taskA = aResult.value

    const result = store.addDependency(taskA.id, taskA.id)
    expect(result.ok).toBe(false)
  })
})
