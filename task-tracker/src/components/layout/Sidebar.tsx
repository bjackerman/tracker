import * as React from "react"
import { LayoutList, User } from "lucide-react"
import { useTrackerStore } from "@/store/trackerStore"
import { cn } from "@/lib/utils"
import ProjectList from "@/components/sidebar/ProjectList"
import TagList from "@/components/sidebar/TagList"
import { ImportExportPanel } from "@/components/io/ImportExportPanel"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const ASSIGNEE_KEY = "task-tracker-assignee"

export default function Sidebar() {
  const selectedProjectId = useTrackerStore((s) => s.selectedProjectId)
  const setSelectedProject = useTrackerStore((s) => s.setSelectedProject)
  const setActiveFilters = useTrackerStore((s) => s.setActiveFilters)

  const [myName, setMyName] = React.useState<string>(
    () => localStorage.getItem(ASSIGNEE_KEY) ?? ""
  )

  function handleAllTasks() {
    setSelectedProject(null)
    setActiveFilters({})
  }

  function handleMyNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setMyName(value)
    if (value.trim()) {
      localStorage.setItem(ASSIGNEE_KEY, value.trim())
    } else {
      localStorage.removeItem(ASSIGNEE_KEY)
    }
  }

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r bg-background">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {/* All Tasks nav item */}
        <div className="px-2">
          <button
            onClick={handleAllTasks}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              selectedProjectId === null && "bg-accent text-accent-foreground font-medium"
            )}
          >
            <LayoutList className="h-4 w-4 shrink-0" />
            All Tasks
          </button>
        </div>

        {/* Projects */}
        <div className="px-2">
          <ProjectList />
        </div>

        {/* Tags */}
        <div className="px-2">
          <TagList />
        </div>
      </div>

      {/* My Name setting */}
      <div className="shrink-0 border-t px-4 py-3 space-y-1.5">
        <Label htmlFor="my-name" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          My Name (for "My Tasks" view)
        </Label>
        <Input
          id="my-name"
          value={myName}
          onChange={handleMyNameChange}
          placeholder="Enter your name…"
          className="h-7 text-xs"
        />
      </div>

      {/* Import / Export */}
      <div className="shrink-0 border-t px-4 py-3">
        <ImportExportPanel />
      </div>
    </div>
  )
}
