import { useTrackerStore } from "@/store/trackerStore"
import { ViewToolbar } from "@/components/toolbar/ViewToolbar"
import { TaskList } from "@/components/tasks/TaskList"
import { ByDueDateView } from "@/views/ByDueDateView"
import { ByPriorityView } from "@/views/ByPriorityView"
import { WorkflowView } from "@/views/WorkflowView"
import { DependencyView } from "@/views/DependencyView"

// ─── MainPanel ────────────────────────────────────────────────────────────────

export default function MainPanel() {
  const activeViewId = useTrackerStore((s) => s.activeViewId)

  function renderView() {
    switch (activeViewId) {
      case "view-by-due-date":
        return <ByDueDateView />
      case "view-by-priority":
        return <ByPriorityView />
      case "view-workflow":
        return <WorkflowView />
      case "view-dependency":
        return <DependencyView />
      default:
        // Covers null, "view-all-tasks", "view-my-tasks", "view-due-this-week"
        return <TaskList />
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <ViewToolbar />
      {renderView()}
    </div>
  )
}
