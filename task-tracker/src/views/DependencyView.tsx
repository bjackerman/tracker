import * as React from "react"
import { useTrackerStore } from "@/store/trackerStore"
import * as FilterService from "@/services/FilterService"
import * as DependencyService from "@/services/DependencyService"
import type { BottleneckInfo } from "@/types/index"
import { TaskRow } from "@/components/tasks/TaskRow"
import { EmptyState } from "@/components/tasks/EmptyState"

// ─── DependencyView ───────────────────────────────────────────────────────────

/**
 * Displays tasks sorted topologically (prerequisites before dependents).
 * Bottleneck tasks are highlighted with their blocked-task count.
 * Validates: Requirements 6.7, 8.5
 */
export function DependencyView() {
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

  // 4. Sort topologically so prerequisites appear before dependents
  const sortedTasks = DependencyService.topologicalSort(searchedTasks)

  // 5. Compute bottlenecks from all tasks (not just visible ones) for accuracy
  const bottlenecks = DependencyService.getBottlenecks(allTasks)
  const bottleneckMap = new Map<string, BottleneckInfo>(
    bottlenecks.map((b) => [b.taskId, b])
  )

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Header row */}
      <div className="flex items-center px-4 py-2 border-b bg-background">
        <span className="text-xs text-muted-foreground">
          {sortedTasks.length} task{sortedTasks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {sortedTasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col">
          {sortedTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              bottleneckInfo={bottleneckMap.get(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
