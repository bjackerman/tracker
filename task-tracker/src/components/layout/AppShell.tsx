import * as React from "react"
import { isStorageAvailable, loadError } from "@/services/StorageService"
import { useTrackerStore } from "@/store/trackerStore"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TaskDetail } from "@/components/tasks/TaskDetail"
import Sidebar from "./Sidebar"
import MainPanel from "./MainPanel"

export function AppShell() {
  const selectedTaskId = useTrackerStore((s) => s.selectedTaskId)
  const setSelectedTask = useTrackerStore((s) => s.setSelectedTask)

  const [showRecoveryDialog, setShowRecoveryDialog] = React.useState(loadError)

  function handleResetToEmpty() {
    localStorage.removeItem("task-tracker")
    window.location.reload()
  }

  function handleDownloadCorruptData() {
    const raw = localStorage.getItem("task-tracker")
    if (!raw) return

    const blob = new Blob([raw], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `task-tracker-corrupt-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen flex-col">
      {!isStorageAvailable && (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 text-sm">
          Storage is unavailable. Changes will not be saved.
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainPanel />
        <Sheet
          open={selectedTaskId !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedTask(null)
          }}
        >
          <SheetContent>
            <TaskDetail />
          </SheetContent>
        </Sheet>
      </div>

      {/* Corrupt data recovery dialog */}
      <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Data Recovery</DialogTitle>
            <DialogDescription>
              The stored data could not be loaded. It may be corrupted or invalid.
              You can reset to an empty state or download the raw data for manual recovery.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              variant="destructive"
              onClick={handleResetToEmpty}
              className="w-full"
            >
              Reset to empty state
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadCorruptData}
              className="w-full"
            >
              Download corrupt data
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowRecoveryDialog(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
