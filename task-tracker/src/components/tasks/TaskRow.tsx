import * as React from "react"
import { format, parseISO } from "date-fns"
import type { Task, BottleneckInfo } from "@/types/index"
import { useTrackerStore } from "@/store/trackerStore"
import { computeDueDateStatus } from "@/services/FilterService"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ─── Variant helpers ──────────────────────────────────────────────────────────

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "Done":
      return "secondary"
    case "Blocked":
      return "destructive"
    default:
      return "outline"
  }
}

function priorityVariant(priority: string): BadgeVariant {
  switch (priority) {
    case "Critical":
      return "destructive"
    case "High":
      return "default"
    default:
      return "secondary"
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TaskRowProps {
  task: Task
  bottleneckInfo?: BottleneckInfo
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────

export function TaskRow({ task, bottleneckInfo }: TaskRowProps) {
  const tags = useTrackerStore((s) => s.tags)
  const setSelectedTask = useTrackerStore((s) => s.setSelectedTask)

  const dueDateStatus = computeDueDateStatus(task, new Date())

  // Resolve tag labels from store
  const taskTags = task.tags
    .map((tagId) => tags.find((t) => t.id === tagId))
    .filter((t): t is NonNullable<typeof t> => t !== undefined)

  // Format due date for display
  function renderDueDate() {
    if (!task.dueDate) return null

    if (dueDateStatus === "overdue") {
      return (
        <span className="text-xs font-medium text-red-500">
          Overdue
        </span>
      )
    }

    if (dueDateStatus === "due-soon") {
      return (
        <span className="text-xs font-medium text-amber-500">
          Due Soon
        </span>
      )
    }

    // normal with a due date
    const formatted = format(parseISO(task.dueDate), "MMM d, yyyy")
    return (
      <span className="text-xs text-muted-foreground">
        {formatted}
      </span>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b hover:bg-muted/40 transition-colors">
        {/* Title */}
        <button
          type="button"
          className="flex-1 text-left text-sm font-medium hover:underline focus:outline-none focus:underline truncate"
          onClick={() => setSelectedTask(task.id)}
        >
          {task.title}
        </button>

        {/* Status badge */}
        <Badge variant={statusVariant(task.status)} className="shrink-0 text-xs">
          {task.status}
        </Badge>

        {/* Priority badge */}
        <Badge variant={priorityVariant(task.priority)} className="shrink-0 text-xs">
          {task.priority}
        </Badge>

        {/* Assignee */}
        {task.assignee && (
          <span className="text-xs text-muted-foreground shrink-0">
            {task.assignee}
          </span>
        )}

        {/* Due date indicator */}
        {renderDueDate()}

        {/* Tag chips */}
        {taskTags.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {taskTags.map((tag) => (
              <Badge key={tag.id} variant="outline" className="text-xs px-1.5 py-0">
                {tag.label}
              </Badge>
            ))}
          </div>
        )}

        {/* Bottleneck indicator */}
        {bottleneckInfo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="destructive"
                className="shrink-0 text-xs cursor-default"
                aria-label={`Bottleneck: blocking ${bottleneckInfo.blockedCount} task${bottleneckInfo.blockedCount !== 1 ? "s" : ""}`}
              >
                ⚠ {bottleneckInfo.blockedCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              Blocking {bottleneckInfo.blockedCount} task{bottleneckInfo.blockedCount !== 1 ? "s" : ""}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
