# Implementation Plan: Task Tracker

## Overview

Scaffold a React 18 + TypeScript + Vite application from scratch. Build the domain layer first (types, services, store), then the UI shell, then feature panels, and finally wire everything together. Property-based tests (fast-check) are placed immediately after the code they validate so regressions are caught early.

## Tasks

- [x] 1. Scaffold project and configure tooling
  - Run `npm create vite@latest task-tracker -- --template react-ts` and install all dependencies: `zustand`, `date-fns`, `uuid`, `shadcn/ui` (via CLI), `tailwindcss`, `@radix-ui/*` peer deps, `vitest`, `@vitest/ui`, `fast-check`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`
  - Configure `vite.config.ts` with Vitest settings (`environment: "jsdom"`, `globals: true`, `setupFiles`)
  - Configure `tailwind.config.ts` and `postcss.config.js` per shadcn/ui requirements
  - Run `npx shadcn-ui@latest init` to generate `components.json` and base CSS variables
  - Add `src/test/setup.ts` with `@testing-library/jest-dom` matchers
  - _Requirements: (project foundation — all requirements depend on this)_

- [x] 2. Define core TypeScript types and the Result type
  - Create `src/types/index.ts` with all interfaces and type aliases from the design: `ID`, `TrackerState`, `Project`, `Task`, `Tag`, `StatusDef`, `PriorityDef`, `CustomFieldDef`, `CustomFieldValue`, `SavedView`, `ProjectTemplate`, `FilterCriteria`, `SortCriteria`, `SortField`, `SortDirection`, `GroupByField`, `ValidationError`, `CycleError`, `BottleneckInfo`, `TaskInput`, `ProjectInput`
  - Create `src/types/result.ts` with `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`
  - Export all types from `src/types/index.ts`
  - _Requirements: 1.1, 2.1, 4.1, 8.1_

- [x] 3. Implement ValidationService
  - Create `src/services/ValidationService.ts`
  - Implement `validateTask(input, project)`: require non-blank title; validate status against project's status list (or global defaults); validate priority against project's priority list (or global defaults); validate custom field values by delegating to `validateCustomFieldValue`; return `Result<TaskInput, ValidationError[]>`
  - Implement `validateProject(input)`: require non-blank name; return `Result<ProjectInput, ValidationError[]>`
  - Implement `validateCustomFieldValue(value, field)`: accept value iff it matches declared type; for `single-select`, additionally restrict to `options`; return `Result<CustomFieldValue, ValidationError>`
  - Implement `validateImport(data)`: check top-level shape, version field, arrays; validate each project and task; collect all errors; return `Result<TrackerState, ValidationError[]>`
  - Define global default statuses (`To Do`, `In Progress`, `Blocked`, `In Review`, `Done`) and priorities (`Low`/1, `Medium`/2, `High`/3, `Critical`/4) as exported constants
  - _Requirements: 1.2, 1.3, 1.4, 1.7, 1.8, 2.2, 4.3, 4.6, 9.4, 10.3, 10.4_

- [x] 4. Write tests for ValidationService
  - Create `src/services/__tests__/validation.test.ts`
  - [ ]* 4.1 Write property test for task field preservation (Property 1)
    - **Property 1: Task creation preserves all provided fields**
    - **Validates: Requirements 1.1, 1.5**
    - Use `arbitraryTaskInput()` generator; assert that `validateTask` on valid input returns `ok: true` and all fields match
  - [ ]* 4.2 Write property test for blank-title rejection (Property 2)
    - **Property 2: Tasks with missing or blank titles are rejected**
    - **Validates: Requirements 1.2**
    - Generate inputs with absent/empty/whitespace-only titles; assert `ok: false` with non-empty errors
  - [ ]* 4.3 Write property test for blank-project-name rejection (Property 4)
    - **Property 4: Projects with missing or blank names are rejected**
    - **Validates: Requirements 2.2**
    - Generate inputs with absent/empty/whitespace-only names; assert `ok: false` with non-empty errors
  - [ ]* 4.4 Write property test for custom field type validation (Property 8)
    - **Property 8: Custom field value validation matches declared type**
    - **Validates: Requirements 4.3, 4.6**
    - Generate `(CustomFieldDef, value)` pairs; assert accept iff value conforms to type; for `single-select`, assert reject when value not in options
  - [ ]* 4.5 Write property test for per-project status/priority enforcement (Property 25)
    - **Property 25: Per-project status and priority configuration is enforced**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
    - Generate project with custom status/priority lists; assert values in list are accepted, values outside are rejected
  - [x] 4.6 Write unit tests for default status/priority assignment
    - Assert task created without status gets `"To Do"`; without priority gets `"Medium"`
    - _Requirements: 1.3, 1.4_

- [x] 5. Implement FilterService
  - Create `src/services/FilterService.ts`
  - Implement `applyFilters(tasks, filters)`: apply each active criterion (projectIds, statuses, priorities, tagIds, assignees, dueDateRange, dueDateStatus, searchQuery) as a conjunction; return only tasks satisfying all active criteria
  - Implement `applySearch(tasks, query)`: case-insensitive substring match on `title` and `description`; return matching tasks
  - Implement `applySort(tasks, sort)`: sort by `title` (lexicographic), `dueDate` (ISO string, nulls last), `priority` (by `PriorityDef.weight`), or `createdAt`; respect `direction`
  - Implement `computeDueDateStatus(task, now)`: pure function returning `"overdue" | "due-soon" | "normal"` per design derivation rules; tasks with final status always return `"normal"`
  - _Requirements: 5.1, 5.2, 5.3, 5.5, 7.1, 7.2, 7.3_

- [x] 6. Write tests for FilterService
  - Create `src/services/__tests__/filter.test.ts`
  - [ ]* 6.1 Write property test for filter conjunction (Property 11)
    - **Property 11: Filter returns only tasks satisfying all active criteria**
    - **Validates: Requirements 5.1, 5.2, 7.3**
    - Use `arbitraryFilterCriteria(tasks)` generator; assert result is exactly the tasks satisfying every criterion
  - [ ]* 6.2 Write property test for keyword search (Property 12)
    - **Property 12: Keyword search matches title and description**
    - **Validates: Requirements 5.3**
    - Generate task lists and query strings; assert result is exactly tasks whose title or description contains query (case-insensitive)
  - [ ]* 6.3 Write property test for sort ordering (Property 13)
    - **Property 13: Sort produces a correctly ordered list**
    - **Validates: Requirements 5.5**
    - Generate task lists and sort configs; assert every adjacent pair satisfies the ordering relation
  - [ ]* 6.4 Write property test for due date status derivation (Property 17)
    - **Property 17: Due date status derivation is correct**
    - **Validates: Requirements 7.1, 7.2**
    - Generate tasks with various due dates and statuses; assert `computeDueDateStatus` returns correct bucket; assert final-status tasks never return overdue/due-soon
  - [x] 6.5 Write unit tests for empty-result state and search performance
    - Assert empty array returned when no tasks match; benchmark `applySearch` over 10,000 tasks completes within 500ms
    - _Requirements: 5.4, 5.6_

- [x] 7. Implement DependencyService
  - Create `src/services/DependencyService.ts`
  - Implement `detectCycle(tasks, fromId, toId)`: DFS/BFS from `toId`; return `true` if `fromId` is reachable (adding the edge would create a cycle)
  - Implement `addDependency(tasks, fromId, toId)`: call `detectCycle`; if cycle detected return `Result` error with path description; otherwise add `toId` to `tasks[fromId].prerequisiteIds` and return updated tasks
  - Implement `topologicalSort(tasks)`: Kahn's algorithm over `prerequisiteIds`; return tasks in dependency order (prerequisites before dependents)
  - Implement `getBottlenecks(tasks)`: return `BottleneckInfo[]` for tasks whose status is non-final and that appear in at least one other non-final task's `prerequisiteIds`; include `blockedCount`
  - Implement `getDependents(tasks, taskId)`: return tasks that list `taskId` in their `prerequisiteIds`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8. Write tests for DependencyService
  - Create `src/services/__tests__/dependency.test.ts`
  - [ ]* 8.1 Write property test for successful dependency addition (Property 18)
    - **Property 18: Dependency addition succeeds when no cycle is introduced**
    - **Validates: Requirements 8.1**
    - Generate acyclic graphs and valid new edges; assert `addDependency` returns `ok: true` and edge is present
  - [ ]* 8.2 Write property test for cycle rejection (Property 19)
    - **Property 19: Circular dependency attempts are always rejected**
    - **Validates: Requirements 8.3**
    - Generate graphs and edges that would create cycles; assert `addDependency` returns `ok: false` and graph is unchanged
  - [ ]* 8.3 Write property test for bidirectional consistency (Property 21)
    - **Property 21: Dependency graph bidirectional retrieval is consistent**
    - **Validates: Requirements 8.4**
    - Generate dependency graphs; for every task T assert that `getDependents(T)` and `prerequisiteIds` are mutually consistent
  - [ ]* 8.4 Write property test for bottleneck count (Property 16)
    - **Property 16: Bottleneck count equals number of directly blocked incomplete tasks**
    - **Validates: Requirements 6.7, 8.5**
    - Generate dependency graphs with mixed final/non-final statuses; assert each bottleneck's `blockedCount` equals the manually counted directly-blocked non-final tasks
  - [x] 8.5 Write unit tests for topological sort and incomplete-prerequisite warning
    - Test known graphs produce correct topological order; test that attempting to set a task Done with non-final prerequisites returns a warning result
    - _Requirements: 8.2, 6.6 (Dependency View ordering)_

- [x] 9. Checkpoint — ensure all service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement StorageService
  - Create `src/services/StorageService.ts`
  - Implement `load()`: read `localStorage["task-tracker"]`; parse JSON; call `validateImport`; return `TrackerState | null`; on parse error return `null` and expose a `loadError` flag
  - Implement `save(state)`: `JSON.stringify(state)` and write to `localStorage["task-tracker"]`; catch `QuotaExceededError` and surface via a returned error flag
  - Implement `exportJSON(state)`: serialize state to a formatted JSON string
  - Implement `importJSON(json)`: parse string; call `validateImport`; return `Result<TrackerState, ValidationError[]>`
  - Detect `localStorage` unavailability on module init; expose `isStorageAvailable: boolean`
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 11. Write tests for StorageService
  - Create `src/services/__tests__/storage.test.ts`
  - [ ]* 11.1 Write property test for persistence round-trip (Property 22)
    - **Property 22: Persistence round-trip preserves state**
    - **Validates: Requirements 9.1**
    - Use `arbitraryTrackerState()` generator; call `save` then `load`; assert deep equality
  - [ ]* 11.2 Write property test for JSON export/import round-trip (Property 23)
    - **Property 23: JSON export/import round-trip is lossless**
    - **Validates: Requirements 9.2, 9.3, 9.5**
    - Generate valid states; export → import → export; assert both exports are semantically equal
  - [ ]* 11.3 Write property test for invalid import rejection (Property 24)
    - **Property 24: Invalid import data is always rejected with errors**
    - **Validates: Requirements 9.4**
    - Generate malformed/missing-field/wrong-type JSON strings; assert `importJSON` returns `ok: false` with at least one error
  - [x] 11.4 Write unit tests for localStorage unavailability and corrupt data recovery
    - Mock `localStorage` as unavailable; assert `isStorageAvailable` is false; mock corrupt JSON; assert `load` returns null and exposes error flag
    - _Requirements: 9.1_

- [x] 12. Implement fast-check arbitrary generators
  - Create `src/test/arbitraries.ts` with all generators needed by property tests:
    - `arbitraryTitle()` — `fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)`
    - `arbitraryStatusDef()`, `arbitraryPriorityDef()`, `arbitraryCustomFieldDef()`
    - `arbitraryProject()` — valid project with random statuses, priorities, custom fields
    - `arbitraryTask(projectId?, project?)` — valid task whose status/priority/customFieldValues are consistent with the given project (or global defaults)
    - `arbitraryTag()`
    - `arbitraryTrackerState()` — consistent state: task `projectId`s reference existing projects, tag IDs are valid, dependency graph is acyclic
    - `arbitraryFilterCriteria(tasks)` — criteria drawn from values present in the task list
    - `arbitraryDependencyGraph(tasks)` — acyclic dependency assignment
    - `arbitraryCustomFieldValue(def)` — value conforming to field type
    - `arbitraryTaskInput()`, `arbitraryProjectInput()`
  - _Requirements: (test infrastructure — supports all property tests)_

- [x] 13. Implement Zustand store
  - Create `src/store/trackerStore.ts` with a single Zustand store holding `TrackerState` plus UI state (`selectedProjectId`, `selectedTaskId`, `activeFilters`, `activeSort`, `activeViewId`)
  - Implement task actions: `createTask(input)` — validate, assign defaults, generate UUID, apply custom field defaults, persist; `updateTask(id, patch)` — validate, merge, persist; `deleteTask(id)` — remove task and scrub its ID from all `prerequisiteIds`, persist
  - Implement project actions: `createProject(input)` — validate, generate UUID, persist; `updateProject(id, patch)` — validate, persist; `deleteProject(id, strategy)` — prompt handled by UI; execute delete-tasks or reassign, persist; `renameProject(id, name)` — validate, persist
  - Implement tag actions: `applyTag(taskId, label)` — find or create tag, add to task, persist; `removeTagFromTask(taskId, tagId)` — remove from task only; `deleteTagGlobally(tagId)` — remove from all tasks and tag list, persist
  - Implement custom field actions: `addCustomField(projectId, def)`, `removeCustomField(projectId, fieldId)` — scrub values from all project tasks, persist
  - Implement dependency actions: `addDependency(fromId, toId)` — delegate to `DependencyService`, persist on success; `removeDependency(fromId, toId)` — remove from `prerequisiteIds`, persist
  - Implement view actions: `saveView(config)`, `updateView(id, config)`, `deleteView(id)` — guard against deleting built-in views; initialize store with four built-in views
  - Implement import/export actions: `exportData()`, `importData(json)` — delegate to `StorageService`
  - Hydrate store from `StorageService.load()` on initialization
  - _Requirements: 1.1–1.8, 2.1–2.7, 3.1–3.6, 4.1–4.6, 6.2–6.5, 8.1–8.6, 9.1–9.5, 10.1–10.5_

- [x] 14. Write tests for the Zustand store
  - Create `src/store/__tests__/tracker.test.ts`
  - [ ]* 14.1 Write property test for task deletion reference cleanup (Property 3)
    - **Property 3: Task deletion removes the task from all references**
    - **Validates: Requirements 1.6**
    - Generate states with tasks that have dependencies; delete a task; assert it is absent from task list and from all `prerequisiteIds`
  - [ ]* 14.2 Write property test for tag application round-trip (Property 5)
    - **Property 5: Tag application and auto-creation round-trip**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Generate states and label strings; call `applyTag`; assert tag exists in global list and task's `tags` contains its ID
  - [ ]* 14.3 Write property test for tag filter correctness (Property 6)
    - **Property 6: Tag filter returns exactly the matching tasks**
    - **Validates: Requirements 3.5**
    - Generate states; filter by a tag; assert result is exactly tasks whose `tags` contains that ID
  - [ ]* 14.4 Write property test for global tag deletion (Property 7)
    - **Property 7: Global tag deletion removes the tag from all tasks**
    - **Validates: Requirements 3.6**
    - Generate states; delete a tag globally; assert no task retains the tag ID and tag is absent from global list
  - [ ]* 14.5 Write property test for custom field defaults on new tasks (Property 9)
    - **Property 9: Custom field defaults are applied to new tasks**
    - **Validates: Requirements 4.4**
    - Generate projects with custom fields that have defaults; create tasks; assert each task has the correct default values
  - [ ]* 14.6 Write property test for custom field removal cleanup (Property 10)
    - **Property 10: Removing a custom field clears all its values from tasks**
    - **Validates: Requirements 4.5**
    - Generate projects with tasks having custom field values; remove the field; assert no task retains a value for that fieldId
  - [ ]* 14.7 Write property test for saved view round-trip (Property 14)
    - **Property 14: Saved view configuration round-trip**
    - **Validates: Requirements 6.2, 6.3, 6.4**
    - Generate filter/sort/groupBy configs; save as view; load view; assert deep equality
  - [ ]* 14.8 Write property test for view deletion not affecting tasks (Property 15)
    - **Property 15: Deleting a view does not affect tasks**
    - **Validates: Requirements 6.5**
    - Generate states with saved views; delete a view; assert task list is unchanged and view is gone
  - [ ]* 14.9 Write property test for template application (Property 26)
    - **Property 26: Applying a project template pre-configures the project**
    - **Validates: Requirements 10.5**
    - Generate templates; create project from template; assert statuses, priorities, and custom fields are deeply equal to template
  - [x] 14.10 Write integration tests for full store action flows
    - Test: create project → create task → update task → delete task; import/export via store; built-in view existence and undeletability; project deletion prompt strategies
    - _Requirements: 2.5, 6.6, 6.8, 9.1–9.5_

- [x] 15. Checkpoint — ensure all store and service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Build the application shell and routing
  - Install and configure `react-router-dom` (or use hash-based navigation without a router if preferred)
  - Create `src/App.tsx` with the top-level `AppShell` layout: `Sidebar` (left, fixed width) + `MainPanel` (flex-grow) + `DetailPanel` (slide-in `Sheet`, conditionally rendered)
  - Create `src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `MainPanel.tsx`
  - Add shadcn/ui `Sheet` component via CLI; wire `DetailPanel` open/close to `selectedTaskId` in the store
  - Add a persistent storage-unavailable banner that reads `isStorageAvailable` from `StorageService`
  - _Requirements: 2.6, 9.1_

- [x] 17. Build the Sidebar
  - Create `src/components/sidebar/ProjectList.tsx` and `ProjectItem.tsx`
  - Display all projects from the store with task counts (derived selector); clicking a project sets `selectedProjectId`
  - Add "New Project" button that opens a `Dialog` with `ProjectForm`
  - Create `src/components/sidebar/TagList.tsx` listing all tags; clicking a tag applies a tag filter
  - Add "All Tasks" and inbox (no-project) navigation items
  - _Requirements: 2.6, 3.5_

- [x] 18. Build the ViewToolbar
  - Create `src/components/toolbar/ViewToolbar.tsx`
  - Add a shadcn/ui `Select` for view selection (built-in views + saved views)
  - Add a `Command`-powered search input (fuzzy match, keyboard navigation) that dispatches to `activeFilters.searchQuery` in the store
  - Add filter chips as dismissible `Badge` elements for each active filter criterion
  - Add a sort `Select` (field + direction)
  - Add "Save View" and "Update View" buttons that call store view actions
  - _Requirements: 5.1, 5.2, 5.3, 5.5, 6.1, 6.2, 6.3, 6.4_

- [x] 19. Build the TaskList and TaskRow
  - Create `src/components/tasks/TaskList.tsx`: derive the visible task list from the store by composing `FilterService.applyFilters`, `applySearch`, and `applySort` with the active view's config; render `TaskRow` for each task; render `EmptyState` when list is empty
  - Create `src/components/tasks/TaskRow.tsx`: display title, status `Badge`, priority `Badge`, assignee, due date indicator (overdue/due-soon styling via `computeDueDateStatus`), tag chips; bottleneck `Tooltip` showing blocked count; clicking opens `TaskDetail`
  - Create `src/components/tasks/EmptyState.tsx` with a "no results" message
  - _Requirements: 1.1, 5.6, 6.1, 6.7, 7.1, 7.2_

- [x] 20. Build the TaskDetail panel
  - Create `src/components/tasks/TaskDetail.tsx` rendered inside the `Sheet`
  - Core fields: `Input` for title, `Textarea` for description, `Select` for status and priority (options from project or global defaults), `Popover`+`Calendar` for due date (warn if past date via `Alert`), `Input` for assignee
  - Custom fields section: render `Input`, `Switch`, or `Select` based on `CustomFieldDef.type`; validate on change via `ValidationService.validateCustomFieldValue`
  - Dependency section: list prerequisites and dependents; add-dependency `Command` input; remove dependency button; warn when marking Done with incomplete prerequisites
  - Tag section: tag chips with remove button; add-tag input that calls `applyTag`
  - Save/delete buttons that call store actions; display validation errors inline
  - _Requirements: 1.1, 1.5, 1.6, 3.1, 3.4, 4.3, 7.4, 8.2, 8.4_

- [x] 21. Build the built-in views
  - Create `src/views/ByDueDateView.tsx`: sort ascending by `dueDate`, nulls last; use `TaskList`
  - Create `src/views/ByPriorityView.tsx`: sort descending by `priority` weight; use `TaskList`
  - Create `src/views/WorkflowView.tsx`: group tasks by status in project-configured status order; render a section header per status group; use `TaskRow` within each group
  - Create `src/views/DependencyView.tsx`: call `DependencyService.topologicalSort`; call `getBottlenecks`; render `TaskList` with bottleneck tasks highlighted and blocked-count `Tooltip` on their `Badge`
  - Wire view selection in `ViewToolbar` to render the correct view component
  - _Requirements: 6.6, 6.7, 6.8, 8.5, 8.6_

- [x] 22. Build ProjectSettings panel
  - Create `src/components/projects/ProjectSettings.tsx` rendered in a `Dialog`
  - Status editor: list current `StatusDef` items with inline `Input` for name, checkboxes for `isDefault`/`isFinal`, add/remove buttons; call `updateProject` on save
  - Priority editor: list current `PriorityDef` items with `Input` for name and weight; add/remove buttons
  - Custom field editor: list fields with `Input` for name, `Select` for type, options input for `single-select`, default value input; add/remove buttons; removing calls `removeCustomField` store action
  - Template selector: `Command` palette listing available `ProjectTemplate` items; applying a template calls `createProject` with template config
  - _Requirements: 4.1, 4.2, 4.5, 10.1, 10.2, 10.5_

- [x] 23. Build the ImportExportPanel
  - Create `src/components/io/ImportExportPanel.tsx`
  - Export button: call `exportData()` from store; trigger browser file download of the JSON string with filename `task-tracker-export-{date}.json`
  - Import button: trigger hidden `<input type="file" accept=".json">`; on file select, read as text, call `importData(json)` from store; display validation errors in an inline `Alert` if import fails; show success confirmation on success
  - _Requirements: 9.2, 9.3, 9.4_

- [x] 24. Wire together and integrate all components
  - Connect `ViewToolbar` filter/sort state changes to re-derive the task list in `TaskList`
  - Ensure `selectedProjectId` scopes the task list and `TaskDetail` to the correct project's statuses, priorities, and custom fields
  - Ensure project deletion flow shows a `Dialog` prompting delete-all vs. reassign before calling the store action
  - Ensure tag sidebar navigation applies a tag filter to the global task list
  - Ensure "My Tasks" built-in view filters by the current assignee value (stored in a user-preference key in `localStorage`)
  - Ensure "Due This Week" built-in view applies a `dueDateRange` filter for the current ISO week
  - Ensure the corrupt-data recovery prompt is shown when `StorageService.load()` returns null with an error flag
  - _Requirements: 2.5, 2.7, 3.5, 6.8, 9.1_

- [x] 25. Final checkpoint — ensure all tests pass and the app builds
  - Run `vitest --run` and confirm all unit, integration, and property-based tests pass
  - Run `vite build` and confirm no TypeScript or build errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use a minimum of 100 iterations (`numRuns: 100`) per the design's testing strategy
- Each property test file includes a comment `// Feature: task-tracker, Property N: <title>` for traceability
- Checkpoints at tasks 9, 15, and 25 ensure incremental validation before moving to the next layer
- The arbitrary generators in task 12 are shared across all property test files — build them before running the full property test suite
