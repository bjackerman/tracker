/**
 * fast-check arbitrary generators for property-based tests.
 * All generators are exported as named exports.
 */

import fc from "fast-check";
import { v4 as uuidv4 } from "uuid";
import type {
  Project,
  Task,
  Tag,
  TrackerState,
  FilterCriteria,
  CustomFieldDef,
  CustomFieldValue,
  StatusDef,
  PriorityDef,
  TaskInput,
  ProjectInput,
} from "../types/index";
import {
  DEFAULT_STATUSES,
  DEFAULT_PRIORITIES,
} from "../services/ValidationService";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Constrained timestamp range (ms since epoch) for safe date generation */
const DATE_MIN_MS = new Date("2000-01-01T00:00:00.000Z").getTime(); // 946684800000
const DATE_MAX_MS = new Date("2099-12-31T23:59:59.999Z").getTime(); // 4102444799999

/**
 * Generates a valid Date within a safe range.
 * Uses integer timestamps to avoid the invalid-date edge case in fc.date() shrinking.
 */
function safeDate(): fc.Arbitrary<Date> {
  return fc
    .integer({ min: DATE_MIN_MS, max: DATE_MAX_MS })
    .map((ms) => new Date(ms));
}

// ---------------------------------------------------------------------------
// Primitive generators
// ---------------------------------------------------------------------------

/**
 * Non-empty string, max 200 chars, with at least one non-whitespace character.
 */
export function arbitraryTitle(): fc.Arbitrary<string> {
  return fc
    .string({ minLength: 1, maxLength: 200 })
    .filter((s) => s.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Definition generators
// ---------------------------------------------------------------------------

/**
 * Generates a StatusDef with a random name, isDefault: false, isFinal: false.
 */
export function arbitraryStatusDef(): fc.Arbitrary<StatusDef> {
  return fc.record({
    name: fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => s.trim().length > 0),
    isDefault: fc.constant(false),
    isFinal: fc.constant(false),
  });
}

/**
 * Generates a PriorityDef with a random name and weight between 1 and 10.
 */
export function arbitraryPriorityDef(): fc.Arbitrary<PriorityDef> {
  return fc.record({
    name: fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => s.trim().length > 0),
    weight: fc.integer({ min: 1, max: 10 }),
  });
}

/**
 * Generates a CustomFieldDef with a random type and appropriate options/defaultValue.
 */
export function arbitraryCustomFieldDef(): fc.Arbitrary<CustomFieldDef> {
  return fc
    .oneof(
      // text
      fc.record({
        id: fc.uuid(),
        name: fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => s.trim().length > 0),
        type: fc.constant("text" as const),
        options: fc.constant(undefined),
        defaultValue: fc.option(
          fc.string({ minLength: 0, maxLength: 100 }).map((v) => ({
            fieldId: uuidv4(),
            value: v,
          })),
          { nil: undefined }
        ),
      }),
      // number
      fc.record({
        id: fc.uuid(),
        name: fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => s.trim().length > 0),
        type: fc.constant("number" as const),
        options: fc.constant(undefined),
        defaultValue: fc.option(
          fc.integer({ min: -1000, max: 1000 }).map((v) => ({
            fieldId: uuidv4(),
            value: v,
          })),
          { nil: undefined }
        ),
      }),
      // date
      fc.record({
        id: fc.uuid(),
        name: fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => s.trim().length > 0),
        type: fc.constant("date" as const),
        options: fc.constant(undefined),
        defaultValue: fc.option(
          safeDate().map((d) => ({
            fieldId: uuidv4(),
            value: d.toISOString().slice(0, 10),
          })),
          { nil: undefined }
        ),
      }),
      // boolean
      fc.record({
        id: fc.uuid(),
        name: fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => s.trim().length > 0),
        type: fc.constant("boolean" as const),
        options: fc.constant(undefined),
        defaultValue: fc.option(
          fc.boolean().map((v) => ({
            fieldId: uuidv4(),
            value: v,
          })),
          { nil: undefined }
        ),
      }),
      // single-select
      fc
        .array(
          fc
            .string({ minLength: 1, maxLength: 30 })
            .filter((s) => s.trim().length > 0),
          { minLength: 1, maxLength: 5 }
        )
        .chain((options) =>
          fc.record({
            id: fc.uuid(),
            name: fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            type: fc.constant("single-select" as const),
            options: fc.constant(options),
            defaultValue: fc.option(
              fc.constantFrom(...options).map((v) => ({
                fieldId: uuidv4(),
                value: v,
              })),
              { nil: undefined }
            ),
          })
        )
    )
    .map((def) => {
      // Remove undefined keys to keep the object clean
      const result: CustomFieldDef = {
        id: def.id,
        name: def.name,
        type: def.type,
      };
      if (def.options !== undefined) result.options = def.options;
      if (def.defaultValue !== undefined) result.defaultValue = def.defaultValue;
      return result;
    });
}

// ---------------------------------------------------------------------------
// Entity generators
// ---------------------------------------------------------------------------

/**
 * Generates a valid Project using DEFAULT_STATUSES and DEFAULT_PRIORITIES,
 * with 0-3 random custom fields.
 */
export function arbitraryProject(): fc.Arbitrary<Project> {
  return fc
    .array(arbitraryCustomFieldDef(), { minLength: 0, maxLength: 3 })
    .chain((customFields) =>
      fc.record({
        id: fc.uuid(),
        name: fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => s.trim().length > 0),
        description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), {
          nil: undefined,
        }),
        statuses: fc.constant(DEFAULT_STATUSES),
        priorities: fc.constant(DEFAULT_PRIORITIES),
        customFields: fc.constant(customFields),
        createdAt: safeDate().map((d) => d.toISOString()),
        updatedAt: safeDate().map((d) => d.toISOString()),
      })
    )
    .map((p) => {
      const result: Project = {
        id: p.id,
        name: p.name,
        statuses: p.statuses,
        priorities: p.priorities,
        customFields: p.customFields,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
      if (p.description !== undefined) result.description = p.description;
      return result;
    });
}

/**
 * Generates a valid Task. If a projectId and project are provided, the task's
 * status and priority are drawn from the project's lists; otherwise the defaults are used.
 */
export function arbitraryTask(
  projectId?: string,
  project?: Project
): fc.Arbitrary<Task> {
  const statuses = project?.statuses ?? DEFAULT_STATUSES;
  const priorities = project?.priorities ?? DEFAULT_PRIORITIES;

  const statusNames = statuses.map((s) => s.name);
  const priorityNames = priorities.map((p) => p.name);

  return fc
    .record({
      id: fc.uuid(),
      projectId: fc.constant(projectId ?? null),
      title: arbitraryTitle(),
      description: fc.option(fc.string({ minLength: 0, maxLength: 500 }), {
        nil: undefined,
      }),
      status: fc.constantFrom(...statusNames),
      priority: fc.constantFrom(...priorityNames),
      dueDate: fc.option(
        safeDate().map((d) => d.toISOString().slice(0, 10)),
        { nil: undefined }
      ),
      assignee: fc.option(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => s.trim().length > 0),
        { nil: undefined }
      ),
      tags: fc.constant([] as string[]),
      customFieldValues: fc.constant([] as CustomFieldValue[]),
      prerequisiteIds: fc.constant([] as string[]),
      createdAt: safeDate().map((d) => d.toISOString()),
      updatedAt: safeDate().map((d) => d.toISOString()),
    })
    .map((t) => {
      const result: Task = {
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        status: t.status,
        priority: t.priority,
        tags: t.tags,
        customFieldValues: t.customFieldValues,
        prerequisiteIds: t.prerequisiteIds,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
      if (t.description !== undefined) result.description = t.description;
      if (t.dueDate !== undefined) result.dueDate = t.dueDate;
      if (t.assignee !== undefined) result.assignee = t.assignee;
      return result;
    });
}

/**
 * Generates a Tag with a random id and label.
 */
export function arbitraryTag(): fc.Arbitrary<Tag> {
  return fc.record({
    id: fc.uuid(),
    label: fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => s.trim().length > 0),
  });
}

// ---------------------------------------------------------------------------
// State generator
// ---------------------------------------------------------------------------

/**
 * Generates a consistent TrackerState:
 * - 0-5 projects
 * - 0-10 tasks (each with a valid projectId from the projects array, or null)
 * - 0-5 tags
 * - empty savedViews and templates
 * - version: 1
 * - prerequisiteIds are empty (acyclic by construction)
 */
export function arbitraryTrackerState(): fc.Arbitrary<TrackerState> {
  return fc
    .array(arbitraryProject(), { minLength: 0, maxLength: 5 })
    .chain((projects) => {
      // Build a pool of valid projectIds (plus null for inbox tasks)
      const projectIdPool: (string | null)[] =
        projects.length > 0
          ? [...projects.map((p) => p.id), null]
          : [null];

      // For each task, pick a projectId and the matching project (or undefined for null)
      const taskArbitrary = fc
        .constantFrom(...projectIdPool)
        .chain((pid) => {
          const proj =
            pid !== null ? projects.find((p) => p.id === pid) : undefined;
          return arbitraryTask(pid ?? undefined, proj);
        });

      return fc
        .tuple(
          fc.array(taskArbitrary, { minLength: 0, maxLength: 10 }),
          fc.array(arbitraryTag(), { minLength: 0, maxLength: 5 })
        )
        .map(([tasks, tags]) => ({
          version: 1,
          projects,
          tasks,
          tags,
          savedViews: [],
          templates: [],
        }));
    });
}

// ---------------------------------------------------------------------------
// Filter criteria generator
// ---------------------------------------------------------------------------

/**
 * Generates FilterCriteria drawn from values present in the provided task list.
 * Optionally filters by statuses, priorities, and projectIds present in tasks.
 */
export function arbitraryFilterCriteria(
  tasks: Task[]
): fc.Arbitrary<FilterCriteria> {
  // Collect unique values from the task list
  const allStatuses = [...new Set(tasks.map((t) => t.status))];
  const allPriorities = [...new Set(tasks.map((t) => t.priority))];
  const allProjectIds = [
    ...new Set(
      tasks
        .map((t) => t.projectId)
        .filter((id): id is string => id !== null)
    ),
  ];

  const statusesArb =
    allStatuses.length > 0
      ? fc.option(
          fc
            .subarray(allStatuses, { minLength: 1 })
            .filter((arr) => arr.length > 0),
          { nil: undefined }
        )
      : fc.constant(undefined);

  const prioritiesArb =
    allPriorities.length > 0
      ? fc.option(
          fc
            .subarray(allPriorities, { minLength: 1 })
            .filter((arr) => arr.length > 0),
          { nil: undefined }
        )
      : fc.constant(undefined);

  const projectIdsArb =
    allProjectIds.length > 0
      ? fc.option(
          fc
            .subarray(allProjectIds, { minLength: 1 })
            .filter((arr) => arr.length > 0),
          { nil: undefined }
        )
      : fc.constant(undefined);

  return fc
    .tuple(statusesArb, prioritiesArb, projectIdsArb)
    .map(([statuses, priorities, projectIds]) => {
      const criteria: FilterCriteria = {};
      if (statuses !== undefined) criteria.statuses = statuses;
      if (priorities !== undefined) criteria.priorities = priorities;
      if (projectIds !== undefined) criteria.projectIds = projectIds;
      return criteria;
    });
}

// ---------------------------------------------------------------------------
// Dependency graph generator
// ---------------------------------------------------------------------------

/**
 * Generates an acyclic dependency assignment over a task list.
 * For each task at index i, randomly assigns 0-2 prerequisites from tasks
 * at indices 0..i-1 (guarantees acyclicity by construction).
 * Returns the updated tasks array.
 */
export function arbitraryDependencyGraph(
  tasks: Task[]
): fc.Arbitrary<Task[]> {
  if (tasks.length === 0) {
    return fc.constant([]);
  }

  // Build up the tasks one by one, assigning prerequisites from earlier tasks
  let arb: fc.Arbitrary<Task[]> = fc.constant([]);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const predecessors = tasks.slice(0, i);

    arb = arb.chain((builtTasks) => {
      if (predecessors.length === 0) {
        return fc.constant([...builtTasks, { ...task, prerequisiteIds: [] }]);
      }

      const maxPrereqs = Math.min(2, predecessors.length);
      return fc
        .subarray(predecessors.map((p) => p.id), {
          minLength: 0,
          maxLength: maxPrereqs,
        })
        .map((prereqIds) => [
          ...builtTasks,
          { ...task, prerequisiteIds: prereqIds },
        ]);
    });
  }

  return arb;
}

// ---------------------------------------------------------------------------
// Custom field value generator
// ---------------------------------------------------------------------------

/**
 * Generates a CustomFieldValue conforming to the given field's type.
 * May produce null (representing "no value").
 */
export function arbitraryCustomFieldValue(
  def: CustomFieldDef
): fc.Arbitrary<CustomFieldValue> {
  let valueArb: fc.Arbitrary<string | number | boolean | null>;

  switch (def.type) {
    case "text":
      valueArb = fc.option(fc.string({ minLength: 0, maxLength: 200 }), {
        nil: null,
      });
      break;

    case "number":
      valueArb = fc.option(fc.integer({ min: -1_000_000, max: 1_000_000 }), {
        nil: null,
      });
      break;

    case "date":
      valueArb = fc.option(
        safeDate().map((d) => d.toISOString().slice(0, 10)),
        { nil: null }
      );
      break;

    case "boolean":
      valueArb = fc.option(fc.boolean(), { nil: null });
      break;

    case "single-select": {
      const options = def.options ?? [];
      if (options.length === 0) {
        valueArb = fc.constant(null);
      } else {
        valueArb = fc.option(fc.constantFrom(...options), { nil: null });
      }
      break;
    }

    default:
      valueArb = fc.constant(null);
  }

  return valueArb.map((value) => ({ fieldId: def.id, value }));
}

// ---------------------------------------------------------------------------
// Input type generators
// ---------------------------------------------------------------------------

/**
 * Generates a valid TaskInput (Task without id, createdAt, updatedAt).
 */
export function arbitraryTaskInput(): fc.Arbitrary<TaskInput> {
  const statusNames = DEFAULT_STATUSES.map((s) => s.name);
  const priorityNames = DEFAULT_PRIORITIES.map((p) => p.name);

  return fc
    .record({
      projectId: fc.option(fc.uuid(), { nil: null }),
      title: arbitraryTitle(),
      description: fc.option(fc.string({ minLength: 0, maxLength: 500 }), {
        nil: undefined,
      }),
      status: fc.constantFrom(...statusNames),
      priority: fc.constantFrom(...priorityNames),
      dueDate: fc.option(
        safeDate().map((d) => d.toISOString().slice(0, 10)),
        { nil: undefined }
      ),
      assignee: fc.option(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => s.trim().length > 0),
        { nil: undefined }
      ),
      tags: fc.constant([] as string[]),
      customFieldValues: fc.constant([] as CustomFieldValue[]),
      prerequisiteIds: fc.constant([] as string[]),
    })
    .map((t) => {
      const result: TaskInput = {
        projectId: t.projectId,
        title: t.title,
        status: t.status,
        priority: t.priority,
        tags: t.tags,
        customFieldValues: t.customFieldValues,
        prerequisiteIds: t.prerequisiteIds,
      };
      if (t.description !== undefined) result.description = t.description;
      if (t.dueDate !== undefined) result.dueDate = t.dueDate;
      if (t.assignee !== undefined) result.assignee = t.assignee;
      return result;
    });
}

/**
 * Generates a valid ProjectInput (Project without id, createdAt, updatedAt).
 */
export function arbitraryProjectInput(): fc.Arbitrary<ProjectInput> {
  return fc
    .array(arbitraryCustomFieldDef(), { minLength: 0, maxLength: 3 })
    .chain((customFields) =>
      fc.record({
        name: fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => s.trim().length > 0),
        description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), {
          nil: undefined,
        }),
        statuses: fc.constant(DEFAULT_STATUSES),
        priorities: fc.constant(DEFAULT_PRIORITIES),
        customFields: fc.constant(customFields),
        createdAt: safeDate().map((d) => d.toISOString()),
        updatedAt: safeDate().map((d) => d.toISOString()),
      })
    )
    .map((p) => {
      const result: ProjectInput = {
        name: p.name,
        statuses: p.statuses,
        priorities: p.priorities,
        customFields: p.customFields,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
      if (p.description !== undefined) result.description = p.description;
      return result;
    });
}
