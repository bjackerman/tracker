import type { Task, ID, CycleError, BottleneckInfo } from "../types/index";
import type { Result } from "../types/result";
import { DEFAULT_STATUSES } from "./ValidationService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build an adjacency map: taskId → set of IDs it depends on (prerequisiteIds).
 */
function buildAdjacencyMap(tasks: Task[]): Map<ID, Set<ID>> {
  const map = new Map<ID, Set<ID>>();
  for (const task of tasks) {
    map.set(task.id, new Set(task.prerequisiteIds));
  }
  return map;
}

// ─── detectCycle ──────────────────────────────────────────────────────────────

/**
 * Returns `true` if adding the edge fromId → toId would create a cycle.
 *
 * A cycle would exist if `fromId` is already reachable from `toId` through
 * the existing dependency graph (i.e., there is already a path toId → … → fromId).
 *
 * Uses BFS from `toId` through prerequisiteIds.
 */
export function detectCycle(tasks: Task[], fromId: ID, toId: ID): boolean {
  // If they are the same task, adding a self-dependency is a cycle.
  if (fromId === toId) return true;

  const adjacency = buildAdjacencyMap(tasks);

  // BFS from toId — if we can reach fromId, adding fromId→toId creates a cycle.
  const visited = new Set<ID>();
  const queue: ID[] = [toId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === fromId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const prereqs = adjacency.get(current);
    if (prereqs) {
      for (const prereqId of prereqs) {
        if (!visited.has(prereqId)) {
          queue.push(prereqId);
        }
      }
    }
  }

  return false;
}

// ─── addDependency ────────────────────────────────────────────────────────────

/**
 * Adds a dependency edge: `fromId` depends on `toId` (toId is a prerequisite of fromId).
 *
 * Returns an error if the edge would create a cycle, or if either task is not found.
 * Returns the updated tasks array on success.
 */
export function addDependency(
  tasks: Task[],
  fromId: ID,
  toId: ID
): Result<Task[], CycleError> {
  const fromTask = tasks.find((t) => t.id === fromId);
  const toTask = tasks.find((t) => t.id === toId);

  if (!fromTask || !toTask) {
    return {
      ok: false,
      error: {
        message: `Task not found: ${!fromTask ? fromId : toId}`,
        path: `${fromId} → ${toId}`,
      },
    };
  }

  // Check if the dependency already exists
  if (fromTask.prerequisiteIds.includes(toId)) {
    return {
      ok: true,
      value: tasks,
    };
  }

  if (detectCycle(tasks, fromId, toId)) {
    // Build a human-readable cycle path description
    const cyclePath = buildCyclePath(tasks, fromId, toId);
    return {
      ok: false,
      error: {
        message: `Adding this dependency would create a cycle: ${cyclePath}`,
        path: cyclePath,
      },
    };
  }

  // Add the dependency
  const updatedTasks = tasks.map((task) => {
    if (task.id === fromId) {
      return {
        ...task,
        prerequisiteIds: [...task.prerequisiteIds, toId],
      };
    }
    return task;
  });

  return { ok: true, value: updatedTasks };
}

/**
 * Builds a human-readable cycle path string for error messages.
 * Traces the path from toId back to fromId through the existing graph,
 * then appends the proposed edge to show the full cycle.
 */
function buildCyclePath(tasks: Task[], fromId: ID, toId: ID): string {
  const taskMap = new Map<ID, Task>(tasks.map((t) => [t.id, t]));

  // BFS to find the path from toId to fromId
  const parent = new Map<ID, ID | null>();
  parent.set(toId, null);
  const queue: ID[] = [toId];
  let found = false;

  while (queue.length > 0 && !found) {
    const current = queue.shift()!;
    if (current === fromId) {
      found = true;
      break;
    }
    const task = taskMap.get(current);
    if (task) {
      for (const prereqId of task.prerequisiteIds) {
        if (!parent.has(prereqId)) {
          parent.set(prereqId, current);
          queue.push(prereqId);
        }
      }
    }
  }

  if (!found) {
    // Fallback: simple description
    return `${fromId} → ${toId} → ${fromId}`;
  }

  // Reconstruct path from toId to fromId
  const path: ID[] = [];
  let current: ID | undefined = fromId;
  while (current !== undefined) {
    const taskTitle = taskMap.get(current)?.title ?? current;
    path.unshift(taskTitle);
    const p = parent.get(current);
    current = p ?? undefined;
  }

  // Append the proposed edge to complete the cycle
  const fromTitle = taskMap.get(fromId)?.title ?? fromId;
  path.push(fromTitle);

  return path.join(" → ");
}

// ─── topologicalSort ──────────────────────────────────────────────────────────

/**
 * Returns tasks sorted in topological order using Kahn's algorithm.
 * Prerequisites appear before the tasks that depend on them.
 *
 * If a cycle exists (shouldn't happen if addDependency is used correctly),
 * returns tasks in their original order as a fallback.
 */
export function topologicalSort(tasks: Task[]): Task[] {
  if (tasks.length === 0) return [];

  const taskMap = new Map<ID, Task>(tasks.map((t) => [t.id, t]));

  // Build in-degree map and adjacency list (dependents: who depends on this task)
  const inDegree = new Map<ID, number>();
  const dependents = new Map<ID, ID[]>(); // taskId → list of tasks that depend on it

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    dependents.set(task.id, []);
  }

  for (const task of tasks) {
    for (const prereqId of task.prerequisiteIds) {
      // Only count prerequisites that are in our task set
      if (taskMap.has(prereqId)) {
        inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
        dependents.get(prereqId)!.push(task.id);
      }
    }
  }

  // Kahn's algorithm: start with nodes that have no prerequisites
  const queue: ID[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: Task[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const task = taskMap.get(currentId);
    if (task) sorted.push(task);

    for (const dependentId of dependents.get(currentId) ?? []) {
      const newDegree = (inDegree.get(dependentId) ?? 1) - 1;
      inDegree.set(dependentId, newDegree);
      if (newDegree === 0) {
        queue.push(dependentId);
      }
    }
  }

  // If we didn't process all tasks, there's a cycle — return original order as fallback
  if (sorted.length !== tasks.length) {
    return [...tasks];
  }

  return sorted;
}

// ─── getBottlenecks ───────────────────────────────────────────────────────────

/**
 * Returns bottleneck info for tasks that are:
 * 1. Not in a final status
 * 2. Depended upon by at least one other non-final task
 *
 * `finalStatuses` overrides the default final status names if provided.
 */
export function getBottlenecks(
  tasks: Task[],
  finalStatuses?: string[]
): BottleneckInfo[] {
  const finalStatusNames =
    finalStatuses ??
    DEFAULT_STATUSES.filter((s) => s.isFinal).map((s) => s.name);

  const isNonFinal = (task: Task) => !finalStatusNames.includes(task.status);

  // Count how many non-final tasks directly depend on each task
  const blockedCountMap = new Map<ID, number>();

  for (const task of tasks) {
    if (!isNonFinal(task)) continue; // only non-final tasks can be "blocked"

    for (const prereqId of task.prerequisiteIds) {
      blockedCountMap.set(prereqId, (blockedCountMap.get(prereqId) ?? 0) + 1);
    }
  }

  // A task is a bottleneck if it is non-final AND has at least one blocked dependent
  const bottlenecks: BottleneckInfo[] = [];

  for (const task of tasks) {
    if (!isNonFinal(task)) continue; // final tasks are not bottlenecks

    const blockedCount = blockedCountMap.get(task.id) ?? 0;
    if (blockedCount > 0) {
      bottlenecks.push({ taskId: task.id, blockedCount });
    }
  }

  return bottlenecks;
}

// ─── getDependents ────────────────────────────────────────────────────────────

/**
 * Returns all tasks that list `taskId` in their `prerequisiteIds`.
 */
export function getDependents(tasks: Task[], taskId: ID): Task[] {
  return tasks.filter((task) => task.prerequisiteIds.includes(taskId));
}
