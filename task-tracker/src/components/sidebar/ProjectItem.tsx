import * as React from "react"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import ProjectSettings from "@/components/projects/ProjectSettings"
import { useTrackerStore } from "@/store/trackerStore"
import type { Project } from "@/types"

interface ProjectItemProps {
  project: Project
  taskCount: number
  isSelected: boolean
  onClick: () => void
}

export default function ProjectItem({
  project,
  taskCount,
  isSelected,
  onClick,
}: ProjectItemProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const deleteProject = useTrackerStore((s) => s.deleteProject)
  const setSelectedProject = useTrackerStore((s) => s.setSelectedProject)
  const selectedProjectId = useTrackerStore((s) => s.selectedProjectId)

  function handleDeleteAllTasks() {
    deleteProject(project.id, "delete-tasks")
    if (selectedProjectId === project.id) {
      setSelectedProject(null)
    }
    setDeleteDialogOpen(false)
  }

  function handleMoveToInbox() {
    deleteProject(project.id, "reassign", undefined)
    if (selectedProjectId === project.id) {
      setSelectedProject(null)
    }
    setDeleteDialogOpen(false)
  }

  return (
    <>
      <div
        className={cn(
          "group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
          isSelected && "bg-accent text-accent-foreground font-medium"
        )}
      >
        <button
          onClick={onClick}
          className="flex flex-1 items-center min-w-0 text-left"
        >
          <span className="truncate">{project.name}</span>
        </button>

        <div className="flex items-center gap-1 ml-2 shrink-0">
          <Badge variant="secondary">{taskCount}</Badge>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            <ProjectSettings projectId={project.id} />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteDialogOpen(true)
              }}
              aria-label={`Delete project ${project.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </span>
        </div>
      </div>

      {/* Delete project confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{project.name}"</DialogTitle>
            <DialogDescription>
              This project has {taskCount} task{taskCount !== 1 ? "s" : ""}. What should happen to them?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              variant="destructive"
              onClick={handleDeleteAllTasks}
              className="w-full"
            >
              Delete all tasks
            </Button>
            <Button
              variant="outline"
              onClick={handleMoveToInbox}
              className="w-full"
            >
              Move tasks to inbox
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
