import { parseISO, isBefore, addHours, startOfDay } from "date-fns";
import type { Task, FilterCriteria, SortCriteria, PriorityDef } from "../types/index";
import { DEFAULT_STATUSES, DEFAULT_PRIORITIES } from "./ValidationService";

// ─── computeDueDateStatus ─────────────────────────────────────────────────────

/**
 * Pure function that computes the due date status of a task relative to `now`.
 *
 * Rules:
 * - If the task has a final status, always return "normal".
 * - If the task has no dueDate, return "normal".
 * - If dueDate < today (date-only comparison), return "overdue".
 * - If today <= dueDate <= today + 48 hours, return "due-soon".
 * - Otherwise return "normal".
 */
export function computeDueDateStatus(
  task: Task,
  now: Date
): "overdue" | "due-soon" | "normal" {
  // Tasks with a final status are never overdue or due-soon
  const isFinal = DEFAULT_STATUSES.some(
    (s) => s.name === task.status && s.isFinal
  );
  if (isFinal) return "normal";

  if (!task.dueDate) return "normal";

  const dueDate = parseISO(task.dueDate);
  const todayStart = startOfDay(now);
  const dueSoonCutoff = addHours(now, 48);

  // overdue: dueDate is strictly before the start of today
  if (isBefore(dueDate, todayStart)) {
    return "overdue";
  }

  // due-soon: today <= dueDate <= now + 48h
  if (!isBefore(dueSoonCutoff, dueDate)) {
    return "due-soon";
  }

  return "normal";
}

// ─── applySearch ──────────────────────────────────────────────────────────────

/**
 * Case-insensitive substring match on `title` and `description`.
 * An empty query returns all tasks unchanged.
 */
export function applySearch(tasks: Task[], query: string): Task[] {
  if (!query || query.trim().length === 0) return tasks;

  const lower = query.toLowerCase();
  return tasks.filter((task) => {
    const titleMatch = task.title.toLowerCase().includes(lower);
    const descMatch =
      task.description !== undefined &&
      task.description.toLowerCase().includes(lower);
    return titleMatch || descMatch;
  });
}

// ─── applyFilters ─────────────────────────────────────────────────────────────

/**
 * Apply each active criterion as a conjunction (AND logic).
 * A criterion is "active" when its array is non-empty (or the field is set).
 * Returns only tasks satisfying ALL active criteria.
 */
export function applyFilters(tasks: Task[], filters: FilterCriteria): Task[] {
  const now = new Date();

  return tasks.filter((task) => {
    // projectIds: task.projectId must be in the array
    if (filters.projectIds && filters.projectIds.length > 0) {
      if (task.projectId === null || !filters.projectIds.includes(task.projectId)) {
        return false;
      }
    }

    // statuses: task.status must be in the array
    if (filters.statuses && filters.statuses.length > 0) {
      if (!filters.statuses.includes(task.status)) {
        return false;
      }
    }

    // priorities: task.priority must be in the array
    if (filters.priorities && filters.priorities.length > 0) {
      if (!filters.priorities.includes(task.priority)) {
        return false;
      }
    }

    // tagIds: task.tags must contain at least one of the tagIds
    if (filters.tagIds && filters.tagIds.length > 0) {
      const hasTag = filters.tagIds.some((tagId) => task.tags.includes(tagId));
      if (!hasTag) return false;
    }

    // assignees: task.assignee must be in the array
    if (filters.assignees && filters.assignees.length > 0) {
      if (
        task.assignee === undefined ||
        !filters.assignees.includes(task.assignee)
      ) {
        return false;
      }
    }

    // dueDateRange: task.dueDate must be within the range (inclusive ISO date strings)
    if (filters.dueDateRange) {
      const { from, to } = filters.dueDateRange;
      if (from || to) {
        if (!task.dueDate) return false;
        if (from && task.dueDate < from) return false;
        if (to && task.dueDate > to) return false;
      }
    }

    // dueDateStatus: filter by computed due date status
    if (filters.dueDateStatus) {
      if (filters.dueDateStatus === "no-due-date") {
        if (task.dueDate !== undefined) return false;
      } else {
        const status = computeDueDateStatus(task, now);
        if (status !== filters.dueDateStatus) return false;
      }
    }

    // searchQuery: delegate to applySearch logic inline
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const lower = filters.searchQuery.toLowerCase();
      const titleMatch = task.title.toLowerCase().includes(lower);
      const descMatch =
        task.description !== undefined &&
        task.description.toLowerCase().includes(lower);
      if (!titleMatch && !descMatch) return false;
    }

    return true;
  });
}

// ─── applySort ────────────────────────────────────────────────────────────────

/**
 * Sort tasks by the given SortCriteria.
 * Returns a new sorted array — does not mutate the input.
 *
 * Sort fields:
 * - "title": lexicographic (localeCompare)
 * - "dueDate": ISO string comparison, nulls/undefined last
 * - "priority": by PriorityDef.weight (higher weight = higher priority)
 * - "createdAt": ISO string comparison
 */
export function applySort(
  tasks: Task[],
  sort: SortCriteria,
  priorities?: PriorityDef[]
): Task[] {
  const priorityList = priorities ?? DEFAULT_PRIORITIES;

  // Build a weight lookup map for O(1) access
  const weightMap = new Map<string, number>(
    priorityList.map((p) => [p.name, p.weight])
  );

  const sorted = [...tasks];

  sorted.sort((a, b) => {
    let cmp = 0;

    switch (sort.field) {
      case "title": {
        cmp = a.title.localeCompare(b.title);
        break;
      }

      case "dueDate": {
        const aDate = a.dueDate;
        const bDate = b.dueDate;
        if (aDate === undefined && bDate === undefined) {
          cmp = 0;
        } else if (aDate === undefined) {
          // nulls/undefined always last regardless of direction
          return 1;
        } else if (bDate === undefined) {
          return -1;
        } else {
          cmp = aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
        }
        break;
      }

      case "priority": {
        const aWeight = weightMap.get(a.priority) ?? 0;
        const bWeight = weightMap.get(b.priority) ?? 0;
        // Higher weight = higher priority; for "asc" we want lower weight first
        cmp = aWeight - bWeight;
        break;
      }

      case "createdAt": {
        cmp =
          a.createdAt < b.createdAt
            ? -1
            : a.createdAt > b.createdAt
            ? 1
            : 0;
        break;
      }
    }

    return sort.direction === "desc" ? -cmp : cmp;
  });

  return sorted;
}
