import { useState } from "react"
import { Plus } from "lucide-react"
import { useTrackerStore } from "@/store/trackerStore"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import ProjectItem from "./ProjectItem"

// Default statuses and priorities for new projects
const DEFAULT_STATUSES = [
  { name: "To Do", isDefault: true, isFinal: false },
  { name: "In Progress", isDefault: false, isFinal: false },
  { name: "Blocked", isDefault: false, isFinal: false },
  { name: "In Review", isDefault: false, isFinal: false },
  { name: "Done", isDefault: false, isFinal: true },
]

const DEFAULT_PRIORITIES = [
  { name: "Low", weight: 1 },
  { name: "Medium", weight: 2 },
  { name: "High", weight: 3 },
  { name: "Critical", weight: 4 },
]

export default function ProjectList() {
  const projects = useTrackerStore((s) => s.projects)
  const tasks = useTrackerStore((s) => s.tasks)
  const selectedProjectId = useTrackerStore((s) => s.selectedProjectId)
  const setSelectedProject = useTrackerStore((s) => s.setSelectedProject)
  const createProject = useTrackerStore((s) => s.createProject)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [error, setError] = useState<string | null>(null)

  function getTaskCount(projectId: string): number {
    return tasks.filter((t) => t.projectId === projectId).length
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newProjectName.trim()
    if (!trimmed) {
      setError("Project name is required.")
      return
    }

    const result = createProject({
      name: trimmed,
      statuses: DEFAULT_STATUSES,
      priorities: DEFAULT_PRIORITIES,
      customFields: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    if (!result.ok) {
      setError(result.error[0]?.message ?? "Failed to create project.")
      return
    }

    setNewProjectName("")
    setError(null)
    setDialogOpen(false)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setNewProjectName("")
      setError(null)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Projects
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setDialogOpen(true)}
          aria-label="New project"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {projects.map((project) => (
        <ProjectItem
          key={project.id}
          project={project}
          taskCount={getTaskCount(project.id)}
          isSelected={selectedProjectId === project.id}
          onClick={() => setSelectedProject(project.id)}
        />
      ))}

      {projects.length === 0 && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          No projects yet.
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="project-name"
                className="text-sm font-medium leading-none"
              >
                Project name
              </label>
              <input
                id="project-name"
                type="text"
                value={newProjectName}
                onChange={(e) => {
                  setNewProjectName(e.target.value)
                  setError(null)
                }}
                placeholder="e.g. Website Redesign"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                autoFocus
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
