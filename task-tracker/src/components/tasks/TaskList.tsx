import * as React from "react"
import { Plus } from "lucide-react"
import { useTrackerStore } from "@/store/trackerStore"
import * as FilterService from "@/services/FilterService"
import { getBottlenecks } from "@/services/DependencyService"
import type { BottleneckInfo } from "@/types/index"
import { Button } from "@/components/ui/button"
import { TaskRow } from "./TaskRow"
import { EmptyState } from "./EmptyState"

// ─── TaskList ─────────────────────────────────────────────────────────────────

export function TaskList() {
  const allTasks          = useTrackerStore((s) => s.tasks)
  const selectedProjectId = useTrackerStore((s) => s.selectedProjectId)
  const activeFilters     = useTrackerStore((s) => s.activeFilters)
  const activeSort        = useTrackerStore((s) => s.activeSort)
  const createTask        = useTrackerStore((s) => s.createTask)

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

  // 4. Apply sort
  const visibleTasks = FilterService.applySort(searchedTasks, activeSort)

  // 5. Compute bottlenecks from all tasks (not just visible ones)
  const bottlenecks = getBottlenecks(allTasks)
  const bottleneckMap = new Map<string, BottleneckInfo>(
    bottlenecks.map((b) => [b.taskId, b])
  )

  // ── New task handler ───────────────────────────────────────────────────────

  function handleNewTask() {
    createTask({
      projectId: selectedProjectId ?? null,
      title: "New Task",
      status: "",
      priority: "",
      tags: [],
      customFieldValues: [],
      prerequisiteIds: [],
    })
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Toolbar row */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <span className="text-xs text-muted-foreground">
          {visibleTasks.length} task{visibleTasks.length !== 1 ? "s" : ""}
        </span>
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs gap-1"
          onClick={handleNewTask}
        >
          <Plus className="h-3.5 w-3.5" />
          New Task
        </Button>
      </div>

      {/* Task rows or empty state */}
      {visibleTasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col">
          {visibleTasks.map((task) => (
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
