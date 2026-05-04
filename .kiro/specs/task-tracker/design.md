# Design Document: Task Tracker

## Overview

The Task Tracker is a frontend-only, browser-based application for managing tasks and projects. It requires no backend — all data is persisted to the browser's `localStorage`. The application is designed to be dynamic and extensible: projects can define their own statuses, priorities, and custom fields, and users can build saved views to surface the work that matters most.

The core design goals are:

- **Extensibility**: Projects are self-contained configuration units. Each project carries its own status list, priority list, and custom field definitions.
- **Correctness**: JSON export/import must be a lossless round-trip. Dependency graphs must be acyclic. Validation must be strict and informative.
- **Performance**: Filtering and search over up to 10,000 tasks must complete within 500ms, achieved through in-memory indexing.
- **Simplicity**: No server, no auth, no build-time environment variables. The app runs entirely in the browser.

---

## Architecture

The application follows a layered architecture:

```
┌─────────────────────────────────────────────────────┐
│                    UI Layer (React)                  │
│  Views / Panels / Forms / Modals                    │
└────────────────────┬────────────────────────────────┘
                     │ reads/dispatches
┌────────────────────▼────────────────────────────────┐
│              State Layer (Zustand Store)             │
│  trackerStore — single source of truth              │
│  Selectors, derived state, computed views           │
└────────────────────┬────────────────────────────────┘
                     │ reads/writes
┌────────────────────▼────────────────────────────────┐
│           Persistence Layer (localStorage)           │
│  StorageService — serialize / deserialize           │
│  JSON export / import                               │
└─────────────────────────────────────────────────────┘
```

### Technology Choices

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Type safety for complex domain models (custom fields, dependency graphs) |
| UI Framework | React 18 | Component model fits the view/panel structure; wide ecosystem |
| State Management | Zustand | Minimal boilerplate, easy to slice, works well with localStorage sync |
| Component Library | shadcn/ui | Copy-owned components built on Radix UI primitives — fully accessible out of the box, no runtime dependency, consistent design system, and composable with Tailwind CSS |
| Styling | Tailwind CSS | Required by shadcn/ui; utility-first classes handle layout, spacing, and theming alongside component styles |
| Build Tool | Vite | Fast HMR, minimal config, native ESM |
| Testing | Vitest + fast-check | Vitest for unit/integration, fast-check for property-based tests |
| Date Handling | date-fns | Lightweight, tree-shakeable, no global mutation |

### Data Flow

```
User Action
    │
    ▼
React Component
    │  dispatch action
    ▼
Zustand Store Action
    │  validate → mutate state → persist
    ▼
StorageService.save(state)
    │  JSON.stringify
    ▼
localStorage["task-tracker"]
```

On application load, `StorageService.load()` hydrates the Zustand store from `localStorage`. All mutations go through store actions, which call `StorageService.save()` synchronously after each change.

---

## Components and Interfaces

### Application Shell

```
AppShell
├── Sidebar
│   ├── ProjectList
│   │   └── ProjectItem (name, task count)
│   └── TagList
├── MainPanel
│   ├── ViewToolbar (view selector, filter bar, sort controls)
│   ├── TaskList
│   │   └── TaskRow (title, status badge, priority badge, due date indicator)
│   └── EmptyState
└── DetailPanel (slide-in)
    ├── TaskDetail
    │   ├── TaskForm (edit fields)
    │   ├── DependencySection
    │   └── CustomFieldSection
    └── ProjectSettings
        ├── StatusEditor
        ├── PriorityEditor
        ├── CustomFieldEditor
        └── TemplateSelector
```

### Key React Components

**`TaskRow`** — renders a single task in the list. Displays title, status and priority using shadcn/ui `Badge` components (with variant-based colour coding), assignee, due date with overdue/due-soon indicator, and tag chips rendered as `Badge` elements. A shadcn/ui `Tooltip` shows the blocked-task count on bottleneck rows. Clicking opens `TaskDetail`.

**`ViewToolbar`** — contains the view selector (built-in + saved views) rendered as a shadcn/ui `Select`, filter chips using `Badge` with a dismiss button, a `Command`-powered search/filter input (supports keyboard navigation and fuzzy matching), and a sort `Select`. Emits filter/sort state to the store.

**`TaskDetail`** — full task editor rendered inside a shadcn/ui `Sheet` (slide-in panel). Core fields use `Input`, `Textarea`, `Select`, and `Calendar`/`Popover` for the due date picker. Custom fields render the appropriate control (`Input`, `Switch` for boolean, `Select` for single-select) based on field type. Contains the dependency list (prerequisites and dependents) with a `Separator` between sections.

**`DependencyGraph`** (Dependency View) — renders the flat task list sorted topologically. Bottleneck tasks are highlighted; their blocked-task count is surfaced via a shadcn/ui `Tooltip` on a `Badge`.

**`ProjectSettings`** — project configuration rendered in a shadcn/ui `Dialog`. Status and priority editors use `Input` and `Button` for inline add/remove. Custom field editor uses a `Select` for type choice. Template selection uses a `Command` palette.

**`ImportExportPanel`** — handles JSON file download (export) via a shadcn/ui `Button` and file upload + validation (import) via a `Button`-triggered file input, with validation errors displayed in an inline `Alert`.

### Service Interfaces

```typescript
interface StorageService {
  load(): TrackerState | null;
  save(state: TrackerState): void;
  exportJSON(state: TrackerState): string;
  importJSON(json: string): Result<TrackerState, ValidationError[]>;
}

interface DependencyService {
  addDependency(tasks: Task[], fromId: string, toId: string): Result<Task[], CycleError>;
  detectCycle(tasks: Task[], fromId: string, toId: string): boolean;
  topologicalSort(tasks: Task[]): Task[];
  getBottlenecks(tasks: Task[]): BottleneckInfo[];
}

interface FilterService {
  applyFilters(tasks: Task[], filters: FilterCriteria): Task[];
  applySearch(tasks: Task[], query: string): Task[];
  applySort(tasks: Task[], sort: SortCriteria): Task[];
}

interface ValidationService {
  validateTask(input: unknown, project: Project | null): Result<TaskInput, ValidationError[]>;
  validateProject(input: unknown): Result<ProjectInput, ValidationError[]>;
  validateCustomFieldValue(value: unknown, field: CustomFieldDef): Result<CustomFieldValue, ValidationError>;
  validateImport(data: unknown): Result<TrackerState, ValidationError[]>;
}
```

---

## Data Models

All data is stored as a single serialized `TrackerState` object in `localStorage`.

### Core Types

```typescript
type ID = string; // UUID v4

interface TrackerState {
  version: number;           // schema version for future migrations
  projects: Project[];
  tasks: Task[];
  tags: Tag[];
  savedViews: SavedView[];
  templates: ProjectTemplate[];
}

interface Project {
  id: ID;
  name: string;
  description?: string;
  statuses: StatusDef[];     // ordered list; first is default
  priorities: PriorityDef[]; // ordered list; index maps to sort weight
  customFields: CustomFieldDef[];
  createdAt: string;         // ISO 8601
  updatedAt: string;
}

interface Task {
  id: ID;
  projectId: ID | null;      // null = inbox / standalone
  title: string;
  description?: string;
  status: string;            // must match a StatusDef.name in the project (or global default)
  priority: string;          // must match a PriorityDef.name in the project (or global default)
  dueDate?: string;          // ISO 8601 date string (YYYY-MM-DD)
  assignee?: string;
  tags: ID[];                // references Tag.id
  customFieldValues: CustomFieldValue[];
  prerequisiteIds: ID[];     // task IDs this task depends on
  createdAt: string;
  updatedAt: string;
}

interface Tag {
  id: ID;
  label: string;             // unique, user-defined string
}

interface StatusDef {
  name: string;              // e.g. "To Do", "In Progress"
  isDefault: boolean;        // exactly one per project should be true
  isFinal: boolean;          // "Done"-equivalent; used for dependency warnings
}

interface PriorityDef {
  name: string;              // e.g. "Low", "Medium", "High", "Critical"
  weight: number;            // higher = more urgent; used for sort
}

interface CustomFieldDef {
  id: ID;
  name: string;
  type: "text" | "number" | "date" | "boolean" | "single-select";
  options?: string[];        // only for single-select
  defaultValue?: CustomFieldValue;
}

interface CustomFieldValue {
  fieldId: ID;
  value: string | number | boolean | null;
}

interface SavedView {
  id: ID;
  name: string;
  filters: FilterCriteria;
  sort: SortCriteria;
  groupBy?: GroupByField;
  isBuiltIn: boolean;        // built-in views cannot be deleted
}

interface ProjectTemplate {
  id: ID;
  name: string;
  statuses: StatusDef[];
  priorities: PriorityDef[];
  customFields: Omit<CustomFieldDef, "id">[];
}
```

### Filter and Sort Types

```typescript
interface FilterCriteria {
  projectIds?: ID[];
  statuses?: string[];
  priorities?: string[];
  tagIds?: ID[];
  assignees?: string[];
  dueDateRange?: { from?: string; to?: string };
  dueDateStatus?: "overdue" | "due-soon" | "no-due-date";
  searchQuery?: string;
}

type SortField = "title" | "dueDate" | "priority" | "createdAt";
type SortDirection = "asc" | "desc";

interface SortCriteria {
  field: SortField;
  direction: SortDirection;
}

type GroupByField = "status" | "priority" | "assignee";
```

### Result Type

All fallible operations return a `Result` type to avoid thrown exceptions in business logic:

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

### Default Global Values

When a task has no project, or a project does not override these, the following defaults apply:

- **Statuses**: `To Do` (default), `In Progress`, `Blocked`, `In Review`, `Done` (final)
- **Priorities**: `Low` (weight 1), `Medium` (weight 2, default), `High` (weight 3), `Critical` (weight 4)

### Dependency Graph Invariant

`Task.prerequisiteIds` forms a directed acyclic graph (DAG). The `DependencyService` enforces this invariant on every mutation. A task is a **bottleneck** when:

1. Its status is not a `isFinal` status, AND
2. At least one other non-final task has this task's ID in its `prerequisiteIds`.

### Due Date Status Derivation

Due date status is computed at render time (not stored):

```
dueDate < today                          → "overdue"
today ≤ dueDate ≤ today + 48h           → "due-soon"
dueDate > today + 48h OR no dueDate     → normal
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property-based testing is appropriate here because the task tracker has rich pure-function logic: validation, filtering, sorting, dependency graph operations, and JSON serialization. These all have universal properties that hold across a wide input space and benefit from randomized input generation. The chosen library is **fast-check** (TypeScript/JavaScript).

---

### Property 1: Task creation preserves all provided fields

*For any* valid task input (title, optional description, status, priority, optional due date, optional assignee), creating a task from that input SHALL produce a task whose stored fields exactly match the provided values.

**Validates: Requirements 1.1, 1.5**

---

### Property 2: Tasks with missing or blank titles are rejected

*For any* task input where the title is absent, empty, or composed entirely of whitespace, the validation function SHALL reject the input and return a non-empty list of validation errors.

**Validates: Requirements 1.2**

---

### Property 3: Task deletion removes the task from all references

*For any* task list containing a task T, after deleting T, the resulting task list SHALL contain no task with T's ID, and no remaining task SHALL list T's ID in its `prerequisiteIds`.

**Validates: Requirements 1.6**

---

### Property 4: Projects with missing or blank names are rejected

*For any* project input where the name is absent, empty, or composed entirely of whitespace, the validation function SHALL reject the input and return a non-empty list of validation errors.

**Validates: Requirements 2.2**

---

### Property 5: Tag application and auto-creation round-trip

*For any* task and any label string (whether or not it already exists as a tag), applying that label to the task SHALL result in: (a) a tag with that label existing in the global tag list, and (b) the task's tag list containing that tag's ID.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 6: Tag filter returns exactly the matching tasks

*For any* task list and any tag T, filtering the task list by T SHALL return exactly the set of tasks whose `tags` array contains T's ID — no more, no fewer.

**Validates: Requirements 3.5**

---

### Property 7: Global tag deletion removes the tag from all tasks

*For any* task list and any tag T, after deleting T globally, no task in the resulting list SHALL contain T's ID in its `tags` array, and T SHALL no longer exist in the global tag list.

**Validates: Requirements 3.6**

---

### Property 8: Custom field value validation matches declared type

*For any* custom field definition with a declared type and *for any* value, the validation function SHALL accept the value if and only if it conforms to the declared type. For `single-select` fields, the value SHALL additionally be restricted to the predefined options list.

**Validates: Requirements 4.3, 4.6**

---

### Property 9: Custom field defaults are applied to new tasks

*For any* project with one or more custom field definitions that have default values, every new task created in that project SHALL have a `customFieldValues` entry for each such field whose value equals the field's declared default.

**Validates: Requirements 4.4**

---

### Property 10: Removing a custom field clears all its values from tasks

*For any* project with tasks that have values for a custom field F, after removing F from the project's custom field definitions, no task in that project SHALL have a `customFieldValues` entry with `fieldId` equal to F's ID.

**Validates: Requirements 4.5**

---

### Property 11: Filter returns only tasks satisfying all active criteria

*For any* task list and *for any* combination of filter criteria (status, priority, tag, assignee, due date range, due date status, project), the filter function SHALL return exactly the tasks that satisfy every active criterion simultaneously — no task that fails any criterion SHALL appear, and no task that satisfies all criteria SHALL be absent.

**Validates: Requirements 5.1, 5.2, 7.3**

---

### Property 12: Keyword search matches title and description

*For any* task list and *for any* non-empty search query string, the search function SHALL return exactly the tasks whose title or description contains the query string (case-insensitive) — no non-matching task SHALL appear, and no matching task SHALL be absent.

**Validates: Requirements 5.3**

---

### Property 13: Sort produces a correctly ordered list

*For any* task list and *for any* sort configuration (field ∈ {title, dueDate, priority, createdAt}, direction ∈ {asc, desc}), the sort function SHALL return a list where every adjacent pair of tasks satisfies the ordering relation defined by the sort field and direction.

**Validates: Requirements 5.5**

---

### Property 14: Saved view configuration round-trip

*For any* filter/sort/groupBy configuration, saving it as a named view and then loading that view SHALL produce a configuration that is deeply equal to the original.

**Validates: Requirements 6.2, 6.3, 6.4**

---

### Property 15: Deleting a view does not affect tasks

*For any* tracker state containing a saved view V and a set of tasks, after deleting V, the task list SHALL be identical to the task list before deletion, and V SHALL no longer appear in the saved views list.

**Validates: Requirements 6.5**

---

### Property 16: Bottleneck count equals number of directly blocked incomplete tasks

*For any* dependency graph, for each task T classified as a bottleneck, the reported blocked-task count SHALL equal the number of tasks whose `prerequisiteIds` contains T's ID and whose status is not a final status.

**Validates: Requirements 6.7, 8.5**

---

### Property 17: Due date status derivation is correct

*For any* task with a due date and a non-final status, the computed due date status SHALL be:
- `"overdue"` if the due date is strictly before the current date,
- `"due-soon"` if the due date is within the next 48 hours (inclusive of now),
- `"normal"` otherwise.

Tasks with a final status SHALL never be classified as overdue or due-soon regardless of their due date.

**Validates: Requirements 7.1, 7.2**

---

### Property 18: Dependency addition succeeds when no cycle is introduced

*For any* pair of tasks (A, B) where adding "A depends on B" would not create a cycle in the dependency graph, the `addDependency` function SHALL succeed and B's ID SHALL appear in A's `prerequisiteIds`.

**Validates: Requirements 8.1**

---

### Property 19: Circular dependency attempts are always rejected

*For any* dependency graph and *for any* proposed edge (A → B) that would introduce a cycle (i.e., there already exists a path from B to A), the `addDependency` function SHALL return an error and the graph SHALL remain unchanged.

**Validates: Requirements 8.3**

---

### Property 20: Incomplete-prerequisite warning fires for any such task

*For any* task T whose `prerequisiteIds` contains at least one task with a non-final status, attempting to set T's status to a final status SHALL produce a warning result (the operation is not silently blocked, but a warning is returned to the caller).

**Validates: Requirements 8.2**

---

### Property 21: Dependency graph bidirectional retrieval is consistent

*For any* dependency graph, for every task T, the set of tasks returned as "T's dependents" (tasks that list T in their `prerequisiteIds`) SHALL be exactly the complement of the set returned as "T's prerequisites" — i.e., if A depends on B, then B's dependents include A and A's prerequisites include B.

**Validates: Requirements 8.4**

---

### Property 22: Persistence round-trip preserves state

*For any* valid `TrackerState`, serializing it to the storage format and then deserializing it SHALL produce a state that is deeply equal to the original.

**Validates: Requirements 9.1**

---

### Property 23: JSON export/import round-trip is lossless

*For any* valid `TrackerState`, exporting it to JSON, importing the JSON back, and then exporting again SHALL produce a JSON string that is semantically equivalent to the first export (same data, same structure, same field values).

**Validates: Requirements 9.2, 9.3, 9.5**

---

### Property 24: Invalid import data is always rejected with errors

*For any* JSON string that is malformed, missing required fields, or contains type-invalid values, the import function SHALL return a failure result containing at least one descriptive validation error, and the existing tracker state SHALL remain unchanged.

**Validates: Requirements 9.4**

---

### Property 25: Per-project status and priority configuration is enforced

*For any* project P with a custom status list S (or priority list L), attempting to set a task's status (or priority) to a value not in S (or L) SHALL be rejected by validation. Conversely, any value that is in S (or L) SHALL be accepted.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

---

### Property 26: Applying a project template pre-configures the project

*For any* project template T, creating a new project by applying T SHALL result in a project whose statuses, priorities, and custom field definitions are deeply equal to those defined in T.

**Validates: Requirements 10.5**

---

## Error Handling

### Validation Errors

All user-facing mutations go through `ValidationService`, which returns `Result<T, ValidationError[]>`. The UI renders each error message inline near the relevant field. Errors are never thrown as exceptions from business logic — only from truly unexpected conditions (e.g., corrupted localStorage).

```typescript
interface ValidationError {
  field: string;       // e.g. "title", "status", "customFields[0].value"
  message: string;     // human-readable description
  code: string;        // machine-readable code, e.g. "REQUIRED", "INVALID_TYPE"
}
```

### Specific Error Cases

| Scenario | Behavior |
|---|---|
| Task submitted without title | Reject; error on `title` field: "Title is required." |
| Project submitted without name | Reject; error on `name` field: "Project name is required." |
| Custom field value wrong type | Reject; error on `customFields[fieldId]`: "Expected {type}, got {actual}." |
| Single-select value not in options | Reject; error: "Value must be one of: {options}." |
| Task status not in project's list | Reject; error: "Status '{value}' is not valid for this project." |
| Circular dependency attempt | Reject; error: "Adding this dependency would create a cycle: {path}." |
| Import with invalid schema | Reject; list all invalid entries with field paths and messages. |
| Due date set in the past | Warn (not reject); warning: "This due date is in the past." |
| Mark Done with incomplete prerequisites | Warn (not reject); warning: "{N} prerequisite(s) are not yet complete." |

### Storage Errors

If `localStorage` is unavailable (e.g., private browsing with storage disabled), the app displays a persistent banner: "Storage is unavailable. Changes will not be saved." The app remains functional in-memory for the session.

If the stored JSON is unparseable on load, the app displays a recovery prompt offering to reset to an empty state or download the raw corrupted data for manual recovery.

---

## Testing Strategy

### Overview

The testing strategy uses a dual approach:
- **Unit/example tests** (Vitest): specific behaviors, edge cases, integration between components
- **Property-based tests** (Vitest + fast-check): universal properties across randomized inputs

Property tests are configured to run a minimum of **100 iterations** per property. Each property test is tagged with a comment referencing the design property it validates:

```typescript
// Feature: task-tracker, Property 23: JSON export/import round-trip is lossless
```

### Test Organization

```
src/
├── services/
│   ├── __tests__/
│   │   ├── validation.test.ts       # unit + property tests for ValidationService
│   │   ├── filter.test.ts           # unit + property tests for FilterService
│   │   ├── dependency.test.ts       # unit + property tests for DependencyService
│   │   └── storage.test.ts          # unit + property tests for StorageService
│   └── ...
└── store/
    └── __tests__/
        └── tracker.test.ts          # integration tests for Zustand store actions
```

### Property-Based Test Configuration

```typescript
import fc from "fast-check";
import { it } from "vitest";

// Minimum 100 runs per property
const PBT_RUNS = 100;

it("Property 23: JSON export/import round-trip is lossless", () => {
  // Feature: task-tracker, Property 23: JSON export/import round-trip is lossless
  fc.assert(
    fc.property(arbitraryTrackerState(), (state) => {
      const exported1 = StorageService.exportJSON(state);
      const imported = StorageService.importJSON(exported1);
      expect(imported.ok).toBe(true);
      const exported2 = StorageService.exportJSON(imported.value);
      expect(JSON.parse(exported2)).toEqual(JSON.parse(exported1));
    }),
    { numRuns: PBT_RUNS }
  );
});
```

### Arbitrary Generators

The following fast-check arbitraries will be defined to support property tests:

- `arbitraryTitle()` — non-empty string, max 200 chars
- `arbitraryTask(projectId?)` — valid Task with random fields
- `arbitraryProject()` — valid Project with random statuses, priorities, custom fields
- `arbitraryTrackerState()` — valid TrackerState with consistent cross-references (task projectIds reference existing projects, tag IDs are valid, dependency graph is acyclic)
- `arbitraryFilterCriteria(tasks)` — filter criteria drawn from values present in the task list
- `arbitraryDependencyGraph(tasks)` — acyclic dependency assignment over a task list
- `arbitraryCustomFieldDef()` — random type with appropriate options/default
- `arbitraryCustomFieldValue(def)` — value conforming to the field's type

### Unit Test Focus Areas

- Default status/priority assignment (Requirements 1.3, 1.4)
- Project deletion prompt behavior (Requirement 2.5)
- Tag removal from task without global deletion (Requirement 3.4)
- Due-date-in-past warning (Requirement 7.4)
- Built-in view existence and undeletability (Requirements 6.6, 6.8)
- Search performance benchmark over 10,000 tasks (Requirement 5.4)
- Empty filter/search result state (Requirement 5.6)

### Integration Test Focus Areas

- Full store action flows: create project → create task → update task → delete task
- Import/export via the store (end-to-end through StorageService)
- Dependency view topological sort with known graphs
- localStorage hydration on app load
