import * as React from "react"
import { useTrackerStore } from "@/store/trackerStore"
import * as FilterService from "@/services/FilterService"
import { TaskRow } from "@/components/tasks/TaskRow"
import { EmptyState } from "@/components/tasks/EmptyState"

// ─── ByPriorityView ───────────────────────────────────────────────────────────

/**
 * Displays all visible tasks sorted descending by priority weight (highest first).
 * Validates: Requirements 6.6
 */
export function ByPriorityView() {
  const allTasks          = useTrackerStore((s) => s.tasks)
  const selectedProjectId = useTrackerStore((s) => s.selectedProjectId)
  const activeFilters     = useTrackerStore((s) => s.activeFilters)

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

  // 4. Sort descending by priority weight (highest priority first)
  const visibleTasks = FilterService.applySort(searchedTasks, {
    field: "priority",
    direction: "desc",
  })

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Header row */}
      <div className="flex items-center px-4 py-2 border-b bg-background">
        <span className="text-xs text-muted-foreground">
          {visibleTasks.length} task{visibleTasks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {visibleTasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col">
          {visibleTasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
