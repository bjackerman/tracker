import * as React from "react"
import { useTrackerStore } from "@/store/trackerStore"
import * as FilterService from "@/services/FilterService"
import { DEFAULT_STATUSES } from "@/services/ValidationService"
import { TaskRow } from "@/components/tasks/TaskRow"
import { EmptyState } from "@/components/tasks/EmptyState"

// ─── WorkflowView ─────────────────────────────────────────────────────────────

/**
 * Groups tasks by status in the project's configured status order (or DEFAULT_STATUSES).
 * Each group shows a section header with the status name and task count.
 * Validates: Requirements 6.6, 8.6
 */
export function WorkflowView() {
  const allTasks          = useTrackerStore((s) => s.tasks)
  const selectedProjectId = useTrackerStore((s) => s.selectedProjectId)
  const projects          = useTrackerStore((s) => s.projects)
  const activeFilters     = useTrackerStore((s) => s.activeFilters)

  // Determine the status order from the selected project or fall back to defaults
  const selectedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId) ?? null
    : null
  const statusOrder = selectedProject?.statuses ?? DEFAULT_STATUSES

  // 1. Filter by selected project
  const projectTasks = selectedProjectId
    ? allTasks.filter((t) => t.projectId === selectedProjectId)
    : allTasks

  // 2. Apply active filters
  const filteredTasks = FilterService.applyFilters(projectTasks, activeFilters)

  // 3. Apply search query
  const searchedTasks = FilterService.applySearch(
    filteredTasks,
    activeFilters.searchQuery ?? ""
  )

  if (searchedTasks.length === 0) {
    return (
      <div className="flex flex-col flex-1 overflow-auto">
        <EmptyState />
      </div>
    )
  }

  // 4. Group tasks by status in the configured order
  const tasksByStatus = new Map<string, typeof searchedTasks>()
  for (const statusDef of statusOrder) {
    tasksByStatus.set(statusDef.name, [])
  }

  // Also capture tasks with statuses not in the configured order
  for (const task of searchedTasks) {
    if (tasksByStatus.has(task.status)) {
      tasksByStatus.get(task.status)!.push(task)
    } else {
      // Unknown status — add a group for it
      if (!tasksByStatus.has(task.status)) {
        tasksByStatus.set(task.status, [])
      }
      tasksByStatus.get(task.status)!.push(task)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {Array.from(tasksByStatus.entries()).map(([statusName, tasks]) => {
        // Skip empty groups
        if (tasks.length === 0) return null

        return (
          <div key={statusName}>
            {/* Status group header */}
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b sticky top-0 z-10">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                {statusName}
              </span>
              <span className="text-xs text-muted-foreground">
                ({tasks.length})
              </span>
            </div>

            {/* Tasks in this group */}
            <div className="flex flex-col">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
