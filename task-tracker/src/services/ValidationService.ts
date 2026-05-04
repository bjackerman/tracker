import type {
  Project,
  TaskInput,
  ProjectInput,
  CustomFieldDef,
  CustomFieldValue,
  TrackerState,
  ValidationError,
  StatusDef,
  PriorityDef,
} from "../types/index";
import type { Result } from "../types/result";

// ─── Global Default Constants ─────────────────────────────────────────────────

export const DEFAULT_STATUSES: StatusDef[] = [
  { name: "To Do", isDefault: true, isFinal: false },
  { name: "In Progress", isDefault: false, isFinal: false },
  { name: "Blocked", isDefault: false, isFinal: false },
  { name: "In Review", isDefault: false, isFinal: false },
  { name: "Done", isDefault: false, isFinal: true },
];

export const DEFAULT_PRIORITIES: PriorityDef[] = [
  { name: "Low", weight: 1 },
  { name: "Medium", weight: 2 },
  { name: "High", weight: 3 },
  { name: "Critical", weight: 4 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ─── validateCustomFieldValue ─────────────────────────────────────────────────

/**
 * Validates a raw value against a CustomFieldDef's declared type.
 * Accepts null for any type (represents "no value").
 * For single-select, additionally restricts to the options list.
 */
export function validateCustomFieldValue(
  value: unknown,
  field: CustomFieldDef
): Result<CustomFieldValue, ValidationError> {
  const fieldPath = `customFields[${field.id}]`;

  if (value === null || value === undefined) {
    // null is always acceptable — represents "no value"
    return ok({ fieldId: field.id, value: null });
  }

  switch (field.type) {
    case "text": {
      if (typeof value !== "string") {
        return err({
          field: fieldPath,
          message: `Expected text (string), got ${typeof value}.`,
          code: "INVALID_TYPE",
        });
      }
      return ok({ fieldId: field.id, value });
    }

    case "number": {
      if (typeof value !== "number") {
        return err({
          field: fieldPath,
          message: `Expected number, got ${typeof value}.`,
          code: "INVALID_TYPE",
        });
      }
      return ok({ fieldId: field.id, value });
    }

    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return err({
          field: fieldPath,
          message: `Expected date in YYYY-MM-DD format, got ${JSON.stringify(value)}.`,
          code: "INVALID_TYPE",
        });
      }
      return ok({ fieldId: field.id, value });
    }

    case "boolean": {
      if (typeof value !== "boolean") {
        return err({
          field: fieldPath,
          message: `Expected boolean, got ${typeof value}.`,
          code: "INVALID_TYPE",
        });
      }
      return ok({ fieldId: field.id, value });
    }

    case "single-select": {
      if (typeof value !== "string") {
        return err({
          field: fieldPath,
          message: `Expected single-select value (string), got ${typeof value}.`,
          code: "INVALID_TYPE",
        });
      }
      const options = field.options ?? [];
      if (!options.includes(value)) {
        return err({
          field: fieldPath,
          message: `Value must be one of: ${options.join(", ")}.`,
          code: "INVALID_TYPE",
        });
      }
      return ok({ fieldId: field.id, value });
    }

    default: {
      return err({
        field: fieldPath,
        message: `Unknown field type.`,
        code: "INVALID_TYPE",
      });
    }
  }
}

// ─── validateTask ─────────────────────────────────────────────────────────────

/**
 * Validates raw task input against the project's configuration (or global defaults).
 * Collects all errors rather than stopping at the first.
 */
export function validateTask(
  input: unknown,
  project: Project | null
): Result<TaskInput, ValidationError[]> {
  const errors: ValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return err([
      {
        field: "input",
        message: "Task input must be an object.",
        code: "INVALID_TYPE",
      },
    ]);
  }

  const raw = input as Record<string, unknown>;

  // ── title ──────────────────────────────────────────────────────────────────
  const title = raw["title"];
  if (typeof title !== "string" || title.trim().length === 0) {
    errors.push({
      field: "title",
      message: "Title is required.",
      code: "REQUIRED",
    });
  }

  // ── status ─────────────────────────────────────────────────────────────────
  const statuses = project?.statuses ?? DEFAULT_STATUSES;
  const status = raw["status"];
  if (typeof status !== "string" || !statuses.some((s) => s.name === status)) {
    errors.push({
      field: "status",
      message: `Status '${status}' is not valid for this project.`,
      code: "INVALID_STATUS",
    });
  }

  // ── priority ───────────────────────────────────────────────────────────────
  const priorities = project?.priorities ?? DEFAULT_PRIORITIES;
  const priority = raw["priority"];
  if (
    typeof priority !== "string" ||
    !priorities.some((p) => p.name === priority)
  ) {
    errors.push({
      field: "priority",
      message: `Priority '${priority}' is not valid for this project.`,
      code: "INVALID_PRIORITY",
    });
  }

  // ── customFieldValues ──────────────────────────────────────────────────────
  const customFieldValues = raw["customFieldValues"];
  const validatedCustomFieldValues: CustomFieldValue[] = [];

  if (Array.isArray(customFieldValues) && project !== null) {
    for (const cfv of customFieldValues) {
      if (typeof cfv !== "object" || cfv === null) continue;
      const cfvObj = cfv as Record<string, unknown>;
      const fieldId = cfvObj["fieldId"];
      const fieldDef = project.customFields.find((f) => f.id === fieldId);

      if (!fieldDef) continue; // unknown field — skip silently

      const result = validateCustomFieldValue(cfvObj["value"], fieldDef);
      if (!result.ok) {
        errors.push(result.error);
      } else {
        validatedCustomFieldValues.push(result.value);
      }
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }

  // Build the TaskInput from the raw object
  const taskInput: TaskInput = {
    projectId: typeof raw["projectId"] === "string" ? raw["projectId"] : null,
    title: (title as string).trim(),
    description:
      typeof raw["description"] === "string" ? raw["description"] : undefined,
    status: status as string,
    priority: priority as string,
    dueDate:
      typeof raw["dueDate"] === "string" ? raw["dueDate"] : undefined,
    assignee:
      typeof raw["assignee"] === "string" ? raw["assignee"] : undefined,
    tags: Array.isArray(raw["tags"])
      ? (raw["tags"] as string[]).filter((t) => typeof t === "string")
      : [],
    customFieldValues: validatedCustomFieldValues,
    prerequisiteIds: Array.isArray(raw["prerequisiteIds"])
      ? (raw["prerequisiteIds"] as string[]).filter(
          (id) => typeof id === "string"
        )
      : [],
  };

  return ok(taskInput);
}

// ─── validateProject ──────────────────────────────────────────────────────────

/**
 * Validates raw project input.
 * Requires a non-blank name.
 */
export function validateProject(
  input: unknown
): Result<ProjectInput, ValidationError[]> {
  const errors: ValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return err([
      {
        field: "input",
        message: "Project input must be an object.",
        code: "INVALID_TYPE",
      },
    ]);
  }

  const raw = input as Record<string, unknown>;

  // ── name ───────────────────────────────────────────────────────────────────
  const name = raw["name"];
  if (typeof name !== "string" || name.trim().length === 0) {
    errors.push({
      field: "name",
      message: "Project name is required.",
      code: "REQUIRED",
    });
  }

  if (errors.length > 0) {
    return err(errors);
  }

  const projectInput: ProjectInput = {
    name: (name as string).trim(),
    description:
      typeof raw["description"] === "string" ? raw["description"] : undefined,
    statuses: Array.isArray(raw["statuses"])
      ? (raw["statuses"] as StatusDef[])
      : DEFAULT_STATUSES,
    priorities: Array.isArray(raw["priorities"])
      ? (raw["priorities"] as PriorityDef[])
      : DEFAULT_PRIORITIES,
    customFields: Array.isArray(raw["customFields"])
      ? (raw["customFields"] as CustomFieldDef[])
      : [],
    createdAt:
      typeof raw["createdAt"] === "string" ? raw["createdAt"] : new Date().toISOString(),
    updatedAt:
      typeof raw["updatedAt"] === "string" ? raw["updatedAt"] : new Date().toISOString(),
  };

  return ok(projectInput);
}

// ─── validateImport ───────────────────────────────────────────────────────────

/**
 * Validates a full TrackerState import payload.
 * Checks top-level shape, then validates each project and task.
 * Collects ALL errors rather than stopping at the first.
 */
export function validateImport(
  data: unknown
): Result<TrackerState, ValidationError[]> {
  const errors: ValidationError[] = [];

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return err([
      {
        field: "root",
        message: "Import data must be a JSON object.",
        code: "INVALID_TYPE",
      },
    ]);
  }

  const raw = data as Record<string, unknown>;

  // ── version ────────────────────────────────────────────────────────────────
  if (typeof raw["version"] !== "number") {
    errors.push({
      field: "version",
      message: "Field 'version' must be a number.",
      code: "INVALID_TYPE",
    });
  }

  // ── top-level arrays ───────────────────────────────────────────────────────
  const requiredArrays = [
    "projects",
    "tasks",
    "tags",
    "savedViews",
    "templates",
  ] as const;

  for (const key of requiredArrays) {
    if (!Array.isArray(raw[key])) {
      errors.push({
        field: key,
        message: `Field '${key}' must be an array.`,
        code: "INVALID_TYPE",
      });
    }
  }

  // If top-level shape is broken, bail early — can't validate children
  if (errors.length > 0) {
    return err(errors);
  }

  const rawProjects = raw["projects"] as unknown[];
  const rawTasks = raw["tasks"] as unknown[];

  // ── validate each project ──────────────────────────────────────────────────
  const validatedProjects: ProjectInput[] = [];

  for (let i = 0; i < rawProjects.length; i++) {
    const result = validateProject(rawProjects[i]);
    if (!result.ok) {
      for (const e of result.error) {
        errors.push({ ...e, field: `projects[${i}].${e.field}` });
      }
    } else {
      validatedProjects.push(result.value);
    }
  }

  // Build a lookup map from project name → project (for task validation)
  // We use the raw projects array to look up by id since validated projects
  // may not have ids yet (they're inputs). Use the raw id field.
  const projectsById = new Map<string, Project>();
  for (const rp of rawProjects) {
    if (typeof rp === "object" && rp !== null) {
      const p = rp as Record<string, unknown>;
      if (typeof p["id"] === "string") {
        projectsById.set(p["id"] as string, rp as unknown as Project);
      }
    }
  }

  // ── validate each task ─────────────────────────────────────────────────────
  for (let i = 0; i < rawTasks.length; i++) {
    const rawTask = rawTasks[i];
    let project: Project | null = null;

    if (typeof rawTask === "object" && rawTask !== null) {
      const t = rawTask as Record<string, unknown>;
      if (typeof t["projectId"] === "string") {
        project = projectsById.get(t["projectId"] as string) ?? null;
      }
    }

    const result = validateTask(rawTask, project);
    if (!result.ok) {
      for (const e of result.error) {
        errors.push({ ...e, field: `tasks[${i}].${e.field}` });
      }
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }

  // Return the full TrackerState as-is (cast) since all validations passed
  return ok(data as TrackerState);
}
