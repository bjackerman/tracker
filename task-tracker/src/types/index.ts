export type { Result } from "./result";

// ─── Primitive aliases ────────────────────────────────────────────────────────

/** UUID v4 string */
export type ID = string;

// ─── Status / Priority / Custom field definitions ────────────────────────────

export interface StatusDef {
  name: string;       // e.g. "To Do", "In Progress"
  isDefault: boolean; // exactly one per project should be true
  isFinal: boolean;   // "Done"-equivalent; used for dependency warnings
}

export interface PriorityDef {
  name: string;   // e.g. "Low", "Medium", "High", "Critical"
  weight: number; // higher = more urgent; used for sort
}

export interface CustomFieldDef {
  id: ID;
  name: string;
  type: "text" | "number" | "date" | "boolean" | "single-select";
  options?: string[];              // only for single-select
  defaultValue?: CustomFieldValue;
}

export interface CustomFieldValue {
  fieldId: ID;
  value: string | number | boolean | null;
}

// ─── Core domain entities ─────────────────────────────────────────────────────

export interface Project {
  id: ID;
  name: string;
  description?: string;
  statuses: StatusDef[];       // ordered list; first is default
  priorities: PriorityDef[];   // ordered list; index maps to sort weight
  customFields: CustomFieldDef[];
  createdAt: string;           // ISO 8601
  updatedAt: string;
}

export interface Task {
  id: ID;
  projectId: ID | null;        // null = inbox / standalone
  title: string;
  description?: string;
  status: string;              // must match a StatusDef.name in the project (or global default)
  priority: string;            // must match a PriorityDef.name in the project (or global default)
  dueDate?: string;            // ISO 8601 date string (YYYY-MM-DD)
  assignee?: string;
  tags: ID[];                  // references Tag.id
  customFieldValues: CustomFieldValue[];
  prerequisiteIds: ID[];       // task IDs this task depends on
  createdAt: string;           // ISO 8601
  updatedAt: string;
}

export interface Tag {
  id: ID;
  label: string; // unique, user-defined string
}

// ─── Views ────────────────────────────────────────────────────────────────────

export type SortField = "title" | "dueDate" | "priority" | "createdAt";
export type SortDirection = "asc" | "desc";
export type GroupByField = "status" | "priority" | "assignee";

export interface SortCriteria {
  field: SortField;
  direction: SortDirection;
}

export interface FilterCriteria {
  projectIds?: ID[];
  statuses?: string[];
  priorities?: string[];
  tagIds?: ID[];
  assignees?: string[];
  dueDateRange?: { from?: string; to?: string };
  dueDateStatus?: "overdue" | "due-soon" | "no-due-date";
  searchQuery?: string;
}

export interface SavedView {
  id: ID;
  name: string;
  filters: FilterCriteria;
  sort: SortCriteria;
  groupBy?: GroupByField;
  isBuiltIn: boolean; // built-in views cannot be deleted
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface ProjectTemplate {
  id: ID;
  name: string;
  statuses: StatusDef[];
  priorities: PriorityDef[];
  customFields: Omit<CustomFieldDef, "id">[];
}

// ─── Top-level state ──────────────────────────────────────────────────────────

export interface TrackerState {
  version: number; // schema version for future migrations
  projects: Project[];
  tasks: Task[];
  tags: Tag[];
  savedViews: SavedView[];
  templates: ProjectTemplate[];
}

// ─── Error types ──────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;   // e.g. "title", "status", "customFields[0].value"
  message: string; // human-readable description
  code: string;    // machine-readable code, e.g. "REQUIRED", "INVALID_TYPE"
}

export interface CycleError {
  message: string;
  path: string; // human-readable cycle path description
}

export interface BottleneckInfo {
  taskId: ID;
  blockedCount: number;
}

// ─── Input types (for create/update operations) ───────────────────────────────

/** All Task fields except id, createdAt, updatedAt — these are generated */
export type TaskInput = Omit<Task, "id" | "createdAt" | "updatedAt">;

/** All Project fields except id, createdAt, updatedAt — these are generated */
export type ProjectInput = Omit<Project, "id" | "createdAt" | "updatedAt">;
