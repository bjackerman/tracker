import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTrackerStore } from "@/store/trackerStore"

export function ImportExportPanel() {
  const exportData = useTrackerStore((s) => s.exportData)
  const importData = useTrackerStore((s) => s.importData)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  function handleExport() {
    const json = exportData()
    const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const filename = `task-tracker-export-${date}.json`
    const encoded = encodeURIComponent(json)
    const a = document.createElement("a")
    a.href = `data:application/json;charset=utf-8,${encoded}`
    a.download = filename
    a.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset state
    setImportError(null)
    setImportSuccess(false)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text !== "string") {
        setImportError("Failed to read file.")
        return
      }

      const result = importData(text)
      if (!result.ok) {
        const messages = result.error.map((e) => e.message).join(" ")
        setImportError(messages)
      } else {
        setImportSuccess(true)
        setTimeout(() => setImportSuccess(false), 3000)
      }
    }
    reader.onerror = () => {
      setImportError("Failed to read file.")
    }
    reader.readAsText(file)

    // Reset the input so the same file can be re-imported if needed
    e.target.value = ""
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleExport}>
          Export JSON
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          Import JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {importError && (
        <Alert variant="destructive">
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}
      {importSuccess && (
        <Alert>
          <AlertDescription>Import successful!</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
