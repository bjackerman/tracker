import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type {
  ID,
  TrackerState,
  Task,
  Project,
  Tag,
  SavedView,
  TaskInput,
  ProjectInput,
  FilterCriteria,
  SortCriteria,
  CustomFieldDef,
  ValidationError,
  CycleError,
} from "../types/index";
import type { Result } from "../types/result";
import * as StorageService from "../services/StorageService";
import * as ValidationService from "../services/ValidationService";
import * as DependencyService from "../services/DependencyService";

// ─── Built-in Views ───────────────────────────────────────────────────────────

const BUILT_IN_VIEWS: SavedView[] = [
  {
    id: "view-by-due-date",
    name: "By Due Date",
    filters: {},
    sort: { field: "dueDate", direction: "asc" },
    isBuiltIn: true,
  },
  {
    id: "view-by-priority",
    name: "By Priority",
    filters: {},
    sort: { field: "priority", direction: "desc" },
    isBuiltIn: true,
  },
  {
    id: "view-workflow",
    name: "Workflow View",
    filters: {},
    sort: { field: "createdAt", direction: "asc" },
    groupBy: "status",
    isBuiltIn: true,
  },
  {
    id: "view-dependency",
    name: "Dependency View",
    filters: {},
    sort: { field: "createdAt", direction: "asc" },
    isBuiltIn: true,
  },
  {
    id: "view-all-tasks",
    name: "All Tasks",
    filters: {},
    sort: { field: "createdAt", direction: "asc" },
    isBuiltIn: true,
  },
  {
    id: "view-my-tasks",
    name: "My Tasks",
    filters: {},
    sort: { field: "createdAt", direction: "asc" },
    isBuiltIn: true,
  },
  {
    id: "view-due-this-week",
    name: "Due This Week",
    filters: {},
    sort: { field: "dueDate", direction: "asc" },
    isBuiltIn: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

/**
 * Merge built-in views with saved views from storage.
 * Built-in views always take precedence (by id) and are always present.
 */
function mergeWithBuiltInViews(savedViews: SavedView[]): SavedView[] {
  const builtInIds = new Set(BUILT_IN_VIEWS.map((v) => v.id));
  const userViews = savedViews.filter((v) => !builtInIds.has(v.id));
  return [...BUILT_IN_VIEWS, ...userViews];
}

// ─── Empty initial state ──────────────────────────────────────────────────────

const EMPTY_TRACKER_STATE: TrackerState = {
  version: 1,
  projects: [],
  tasks: [],
  tags: [],
  savedViews: BUILT_IN_VIEWS,
  templates: [],
};

// ─── Store interface ──────────────────────────────────────────────────────────

export interface TrackerStore extends TrackerState {
  // UI state
  selectedProjectId: ID | null;
  selectedTaskId: ID | null;
  activeFilters: FilterCriteria;
  activeSort: SortCriteria;
  activeViewId: ID | null;

  // ── Task actions ────────────────────────────────────────────────────────────

  createTask(input: TaskInput): Result<Task, ValidationError[]>;
  updateTask(id: ID, patch: Partial<TaskInput>): Result<Task, ValidationError[]>;
  deleteTask(id: ID): void;

  // ── Project actions ─────────────────────────────────────────────────────────

  createProject(input: ProjectInput): Result<Project, ValidationError[]>;
  updateProject(id: ID, patch: Partial<ProjectInput>): Result<Project, ValidationError[]>;
  deleteProject(id: ID, strategy: "delete-tasks" | "reassign", reassignToId?: ID): void;
  renameProject(id: ID, name: string): Result<Project, ValidationError[]>;

  // ── Tag actions ─────────────────────────────────────────────────────────────

  applyTag(taskId: ID, label: string): void;
  removeTagFromTask(taskId: ID, tagId: ID): void;
  deleteTagGlobally(tagId: ID): void;

  // ── Custom field actions ────────────────────────────────────────────────────

  addCustomField(projectId: ID, def: Omit<CustomFieldDef, "id">): void;
  removeCustomField(projectId: ID, fieldId: ID): void;

  // ── Dependency actions ──────────────────────────────────────────────────────

  addDependency(fromId: ID, toId: ID): Result<void, CycleError>;
  removeDependency(fromId: ID, toId: ID): void;

  // ── View actions ────────────────────────────────────────────────────────────

  saveView(config: Omit<SavedView, "id" | "isBuiltIn">): SavedView;
  updateView(id: ID, config: Partial<Omit<SavedView, "id" | "isBuiltIn">>): void;
  deleteView(id: ID): void;
  setActiveView(id: ID | null): void;

  // ── Import/export actions ───────────────────────────────────────────────────

  exportData(): string;
  importData(json: string): Result<void, ValidationError[]>;

  // ── UI actions ──────────────────────────────────────────────────────────────

  setSelectedProject(id: ID | null): void;
  setSelectedTask(id: ID | null): void;
  setActiveFilters(filters: FilterCriteria): void;
  setActiveSort(sort: SortCriteria): void;
}

// ─── Persist helper ───────────────────────────────────────────────────────────

/**
 * Extracts the TrackerState slice from the full store state and persists it.
 */
function persist(state: TrackerStore): void {
  const trackerState: TrackerState = {
    version: state.version,
    projects: state.projects,
    tasks: state.tasks,
    tags: state.tags,
    savedViews: state.savedViews,
    templates: state.templates,
  };
  StorageService.save(trackerState);
}

// ─── Hydrate initial state ────────────────────────────────────────────────────

function buildInitialState(): TrackerState {
  const loaded = StorageService.load();
  if (loaded === null) {
    return EMPTY_TRACKER_STATE;
  }
  // Merge built-in views with any saved views from storage
  return {
    ...loaded,
    savedViews: mergeWithBuiltInViews(loaded.savedViews),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTrackerStore = create<TrackerStore>()((set, get) => {
  const initial = buildInitialState();

  return {
    // ── Initial state ─────────────────────────────────────────────────────────
    ...initial,

    // UI state
    selectedProjectId: null,
    selectedTaskId: null,
    activeFilters: {},
    activeSort: { field: "createdAt", direction: "asc" },
    activeViewId: null,

    // ── Task actions ──────────────────────────────────────────────────────────

    createTask(input: TaskInput): Result<Task, ValidationError[]> {
      const state = get();

      // Apply defaults before validation
      const inputWithDefaults: TaskInput = {
        ...input,
        status: input.status || (() => {
          const project = input.projectId
            ? state.projects.find((p) => p.id === input.projectId) ?? null
            : null;
          const statuses = project?.statuses ?? ValidationService.DEFAULT_STATUSES;
          return statuses.find((s) => s.isDefault)?.name ?? statuses[0]?.name ?? "To Do";
        })(),
        priority: input.priority || (() => {
          const project = input.projectId
            ? state.projects.find((p) => p.id === input.projectId) ?? null
            : null;
          const priorities = project?.priorities ?? ValidationService.DEFAULT_PRIORITIES;
          // Default priority is "Medium" (weight 2) or the second one
          return (
            priorities.find((p) => p.name === "Medium")?.name ??
            priorities[1]?.name ??
            priorities[0]?.name ??
            "Medium"
          );
        })(),
      };

      const project = inputWithDefaults.projectId
        ? state.projects.find((p) => p.id === inputWithDefaults.projectId) ?? null
        : null;

      const validation = ValidationService.validateTask(inputWithDefaults, project);
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      const validated = validation.value;

      // Apply custom field defaults from project
      const customFieldValues = [...validated.customFieldValues];
      if (project) {
        for (const fieldDef of project.customFields) {
          if (
            fieldDef.defaultValue !== undefined &&
            !customFieldValues.some((cfv) => cfv.fieldId === fieldDef.id)
          ) {
            customFieldValues.push({
              fieldId: fieldDef.id,
              value: fieldDef.defaultValue.value,
            });
          }
        }
      }

      const timestamp = now();
      const task: Task = {
        ...validated,
        id: uuidv4(),
        customFieldValues,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      set((s) => {
        const next = { ...s, tasks: [...s.tasks, task] };
        persist(next);
        return next;
      });

      return { ok: true, value: task };
    },

    updateTask(id: ID, patch: Partial<TaskInput>): Result<Task, ValidationError[]> {
      const state = get();
      const existing = state.tasks.find((t) => t.id === id);
      if (!existing) {
        return {
          ok: false,
          error: [{ field: "id", message: `Task '${id}' not found.`, code: "NOT_FOUND" }],
        };
      }

      const merged: TaskInput = {
        projectId: patch.projectId !== undefined ? patch.projectId : existing.projectId,
        title: patch.title !== undefined ? patch.title : existing.title,
        description: patch.description !== undefined ? patch.description : existing.description,
        status: patch.status !== undefined ? patch.status : existing.status,
        priority: patch.priority !== undefined ? patch.priority : existing.priority,
        dueDate: patch.dueDate !== undefined ? patch.dueDate : existing.dueDate,
        assignee: patch.assignee !== undefined ? patch.assignee : existing.assignee,
        tags: patch.tags !== undefined ? patch.tags : existing.tags,
        customFieldValues:
          patch.customFieldValues !== undefined
            ? patch.customFieldValues
            : existing.customFieldValues,
        prerequisiteIds:
          patch.prerequisiteIds !== undefined
            ? patch.prerequisiteIds
            : existing.prerequisiteIds,
      };

      const project = merged.projectId
        ? state.projects.find((p) => p.id === merged.projectId) ?? null
        : null;

      const validation = ValidationService.validateTask(merged, project);
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      const updated: Task = {
        ...existing,
        ...validation.value,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now(),
      };

      set((s) => {
        const next = {
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
        };
        persist(next);
        return next;
      });

      return { ok: true, value: updated };
    },

    deleteTask(id: ID): void {
      set((s) => {
        const next = {
          ...s,
          tasks: s.tasks
            .filter((t) => t.id !== id)
            .map((t) =>
              t.prerequisiteIds.includes(id)
                ? { ...t, prerequisiteIds: t.prerequisiteIds.filter((pid) => pid !== id) }
                : t
            ),
        };
        persist(next);
        return next;
      });
    },

    // ── Project actions ───────────────────────────────────────────────────────

    createProject(input: ProjectInput): Result<Project, ValidationError[]> {
      const validation = ValidationService.validateProject(input);
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      const timestamp = now();
      const project: Project = {
        ...validation.value,
        id: uuidv4(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      set((s) => {
        const next = { ...s, projects: [...s.projects, project] };
        persist(next);
        return next;
      });

      return { ok: true, value: project };
    },

    updateProject(id: ID, patch: Partial<ProjectInput>): Result<Project, ValidationError[]> {
      const state = get();
      const existing = state.projects.find((p) => p.id === id);
      if (!existing) {
        return {
          ok: false,
          error: [{ field: "id", message: `Project '${id}' not found.`, code: "NOT_FOUND" }],
        };
      }

      const merged: ProjectInput = {
        name: patch.name !== undefined ? patch.name : existing.name,
        description: patch.description !== undefined ? patch.description : existing.description,
        statuses: patch.statuses !== undefined ? patch.statuses : existing.statuses,
        priorities: patch.priorities !== undefined ? patch.priorities : existing.priorities,
        customFields: patch.customFields !== undefined ? patch.customFields : existing.customFields,
        createdAt: existing.createdAt,
        updatedAt: now(),
      };

      const validation = ValidationService.validateProject(merged);
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      const updated: Project = {
        ...validation.value,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now(),
      };

      set((s) => {
        const next = {
          ...s,
          projects: s.projects.map((p) => (p.id === id ? updated : p)),
        };
        persist(next);
        return next;
      });

      return { ok: true, value: updated };
    },

    deleteProject(id: ID, strategy: "delete-tasks" | "reassign", reassignToId?: ID): void {
      set((s) => {
        let updatedTasks: Task[];

        if (strategy === "delete-tasks") {
          // Remove all tasks belonging to this project
          const deletedTaskIds = new Set(
            s.tasks.filter((t) => t.projectId === id).map((t) => t.id)
          );
          updatedTasks = s.tasks
            .filter((t) => t.projectId !== id)
            .map((t) => ({
              ...t,
              prerequisiteIds: t.prerequisiteIds.filter((pid) => !deletedTaskIds.has(pid)),
            }));
        } else {
          // Reassign tasks to another project (or null if no reassignToId)
          const targetId = reassignToId ?? null;
          updatedTasks = s.tasks.map((t) =>
            t.projectId === id ? { ...t, projectId: targetId, updatedAt: now() } : t
          );
        }

        const next = {
          ...s,
          projects: s.projects.filter((p) => p.id !== id),
          tasks: updatedTasks,
        };
        persist(next);
        return next;
      });
    },

    renameProject(id: ID, name: string): Result<Project, ValidationError[]> {
      return get().updateProject(id, { name });
    },

    // ── Tag actions ───────────────────────────────────────────────────────────

    applyTag(taskId: ID, label: string): void {
      set((s) => {
        // Find or create tag by label
        let tag = s.tags.find((t) => t.label === label);
        let updatedTags = s.tags;

        if (!tag) {
          tag = { id: uuidv4(), label };
          updatedTags = [...s.tags, tag];
        }

        const tagId = tag.id;
        const updatedTasks = s.tasks.map((t) => {
          if (t.id === taskId && !t.tags.includes(tagId)) {
            return { ...t, tags: [...t.tags, tagId], updatedAt: now() };
          }
          return t;
        });

        const next = { ...s, tags: updatedTags, tasks: updatedTasks };
        persist(next);
        return next;
      });
    },

    removeTagFromTask(taskId: ID, tagId: ID): void {
      set((s) => {
        const next = {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, tags: t.tags.filter((tid) => tid !== tagId), updatedAt: now() }
              : t
          ),
        };
        persist(next);
        return next;
      });
    },

    deleteTagGlobally(tagId: ID): void {
      set((s) => {
        const next = {
          ...s,
          tags: s.tags.filter((t) => t.id !== tagId),
          tasks: s.tasks.map((t) =>
            t.tags.includes(tagId)
              ? { ...t, tags: t.tags.filter((tid) => tid !== tagId), updatedAt: now() }
              : t
          ),
        };
        persist(next);
        return next;
      });
    },

    // ── Custom field actions ──────────────────────────────────────────────────

    addCustomField(projectId: ID, def: Omit<CustomFieldDef, "id">): void {
      const fieldId = uuidv4();
      const newField: CustomFieldDef = { ...def, id: fieldId };

      set((s) => {
        const next = {
          ...s,
          projects: s.projects.map((p) =>
            p.id === projectId
              ? { ...p, customFields: [...p.customFields, newField], updatedAt: now() }
              : p
          ),
        };
        persist(next);
        return next;
      });
    },

    removeCustomField(projectId: ID, fieldId: ID): void {
      set((s) => {
        const next = {
          ...s,
          projects: s.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  customFields: p.customFields.filter((f) => f.id !== fieldId),
                  updatedAt: now(),
                }
              : p
          ),
          // Scrub custom field values from all tasks in this project
          tasks: s.tasks.map((t) => {
            if (t.projectId !== projectId) return t;
            const filtered = t.customFieldValues.filter((cfv) => cfv.fieldId !== fieldId);
            if (filtered.length === t.customFieldValues.length) return t;
            return { ...t, customFieldValues: filtered, updatedAt: now() };
          }),
        };
        persist(next);
        return next;
      });
    },

    // ── Dependency actions ────────────────────────────────────────────────────

    addDependency(fromId: ID, toId: ID): Result<void, CycleError> {
      const state = get();
      const result = DependencyService.addDependency(state.tasks, fromId, toId);

      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      set((s) => {
        const next = { ...s, tasks: result.value };
        persist(next);
        return next;
      });

      return { ok: true, value: undefined };
    },

    removeDependency(fromId: ID, toId: ID): void {
      set((s) => {
        const next = {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === fromId
              ? {
                  ...t,
                  prerequisiteIds: t.prerequisiteIds.filter((pid) => pid !== toId),
                  updatedAt: now(),
                }
              : t
          ),
        };
        persist(next);
        return next;
      });
    },

    // ── View actions ──────────────────────────────────────────────────────────

    saveView(config: Omit<SavedView, "id" | "isBuiltIn">): SavedView {
      const view: SavedView = {
        ...config,
        id: uuidv4(),
        isBuiltIn: false,
      };

      set((s) => {
        const next = { ...s, savedViews: [...s.savedViews, view] };
        persist(next);
        return next;
      });

      return view;
    },

    updateView(id: ID, config: Partial<Omit<SavedView, "id" | "isBuiltIn">>): void {
      set((s) => {
        const next = {
          ...s,
          savedViews: s.savedViews.map((v) => {
            if (v.id !== id || v.isBuiltIn) return v;
            return { ...v, ...config };
          }),
        };
        persist(next);
        return next;
      });
    },

    deleteView(id: ID): void {
      set((s) => {
        const view = s.savedViews.find((v) => v.id === id);
        // Guard: no-op if view is built-in or not found
        if (!view || view.isBuiltIn) return s;

        const next = {
          ...s,
          savedViews: s.savedViews.filter((v) => v.id !== id),
          // Clear activeViewId if the deleted view was active
          activeViewId: s.activeViewId === id ? null : s.activeViewId,
        };
        persist(next);
        return next;
      });
    },

    setActiveView(id: ID | null): void {
      set({ activeViewId: id });
    },

    // ── Import/export actions ─────────────────────────────────────────────────

    exportData(): string {
      const state = get();
      const trackerState: TrackerState = {
        version: state.version,
        projects: state.projects,
        tasks: state.tasks,
        tags: state.tags,
        savedViews: state.savedViews,
        templates: state.templates,
      };
      return StorageService.exportJSON(trackerState);
    },

    importData(json: string): Result<void, ValidationError[]> {
      const result = StorageService.importJSON(json);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      const imported = result.value;
      const newState: TrackerState = {
        ...imported,
        savedViews: mergeWithBuiltInViews(imported.savedViews),
      };

      set((s) => {
        const next = {
          ...s,
          ...newState,
          // Reset UI state on import
          selectedProjectId: null,
          selectedTaskId: null,
          activeFilters: {},
          activeViewId: null,
        };
        persist(next);
        return next;
      });

      return { ok: true, value: undefined };
    },

    // ── UI actions ────────────────────────────────────────────────────────────

    setSelectedProject(id: ID | null): void {
      set({ selectedProjectId: id });
    },

    setSelectedTask(id: ID | null): void {
      set({ selectedTaskId: id });
    },

    setActiveFilters(filters: FilterCriteria): void {
      set({ activeFilters: filters });
    },

    setActiveSort(sort: SortCriteria): void {
      set({ activeSort: sort });
    },
  };
});
