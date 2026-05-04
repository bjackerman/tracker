import * as React from "react"
import { AlertTriangle, X, Plus } from "lucide-react"
import { useTrackerStore } from "@/store/trackerStore"
import { validateCustomFieldValue } from "@/services/ValidationService"
import { DEFAULT_STATUSES, DEFAULT_PRIORITIES } from "@/services/ValidationService"
import type { CustomFieldDef, CustomFieldValue, ID } from "@/types/index"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Custom Field Control ─────────────────────────────────────────────────────

interface CustomFieldControlProps {
  fieldDef: CustomFieldDef
  value: CustomFieldValue | undefined
  onChange: (fieldId: ID, value: string | number | boolean | null) => void
  error?: string
}

function CustomFieldControl({ fieldDef, value, onChange, error }: CustomFieldControlProps) {
  const currentValue = value?.value ?? null

  switch (fieldDef.type) {
    case "text":
      return (
        <div className="space-y-1">
          <Label htmlFor={`cf-${fieldDef.id}`}>{fieldDef.name}</Label>
          <Input
            id={`cf-${fieldDef.id}`}
            value={typeof currentValue === "string" ? currentValue : ""}
            onChange={(e) => onChange(fieldDef.id, e.target.value || null)}
            placeholder={`Enter ${fieldDef.name.toLowerCase()}`}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )

    case "number":
      return (
        <div className="space-y-1">
          <Label htmlFor={`cf-${fieldDef.id}`}>{fieldDef.name}</Label>
          <Input
            id={`cf-${fieldDef.id}`}
            type="number"
            value={typeof currentValue === "number" ? String(currentValue) : ""}
            onChange={(e) => {
              const v = e.target.value
              onChange(fieldDef.id, v === "" ? null : Number(v))
            }}
            placeholder={`Enter ${fieldDef.name.toLowerCase()}`}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )

    case "date":
      return (
        <div className="space-y-1">
          <Label htmlFor={`cf-${fieldDef.id}`}>{fieldDef.name}</Label>
          <Input
            id={`cf-${fieldDef.id}`}
            type="date"
            value={typeof currentValue === "string" ? currentValue : ""}
            onChange={(e) => onChange(fieldDef.id, e.target.value || null)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )

    case "boolean":
      return (
        <div className="flex items-center justify-between">
          <Label htmlFor={`cf-${fieldDef.id}`}>{fieldDef.name}</Label>
          <Switch
            id={`cf-${fieldDef.id}`}
            checked={currentValue === true}
            onCheckedChange={(checked) => onChange(fieldDef.id, checked)}
          />
        </div>
      )

    case "single-select": {
      const options = fieldDef.options ?? []
      return (
        <div className="space-y-1">
          <Label htmlFor={`cf-${fieldDef.id}`}>{fieldDef.name}</Label>
          <Select
            value={typeof currentValue === "string" ? currentValue : ""}
            onValueChange={(v) => onChange(fieldDef.id, v || null)}
          >
            <SelectTrigger id={`cf-${fieldDef.id}`}>
              <SelectValue placeholder={`Select ${fieldDef.name.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )
    }

    default:
      return null
  }
}

// ─── TaskDetail ───────────────────────────────────────────────────────────────

export function TaskDetail() {
  const selectedTaskId = useTrackerStore((s) => s.selectedTaskId)
  const tasks = useTrackerStore((s) => s.tasks)
  const projects = useTrackerStore((s) => s.projects)
  const tags = useTrackerStore((s) => s.tags)
  const updateTask = useTrackerStore((s) => s.updateTask)
  const deleteTask = useTrackerStore((s) => s.deleteTask)
  const setSelectedTask = useTrackerStore((s) => s.setSelectedTask)
  const applyTag = useTrackerStore((s) => s.applyTag)
  const removeTagFromTask = useTrackerStore((s) => s.removeTagFromTask)
  const addDependency = useTrackerStore((s) => s.addDependency)
  const removeDependency = useTrackerStore((s) => s.removeDependency)

  const task = tasks.find((t) => t.id === selectedTaskId)
  const project = task?.projectId
    ? projects.find((p) => p.id === task.projectId) ?? null
    : null

  const statuses = project?.statuses ?? DEFAULT_STATUSES
  const priorities = project?.priorities ?? DEFAULT_PRIORITIES
  const customFieldDefs = project?.customFields ?? []

  // ── Local form state ────────────────────────────────────────────────────────
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [priority, setPriority] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [assignee, setAssignee] = React.useState("")
  const [customFieldValues, setCustomFieldValues] = React.useState<CustomFieldValue[]>([])
  const [customFieldErrors, setCustomFieldErrors] = React.useState<Record<ID, string>>({})
  const [saveErrors, setSaveErrors] = React.useState<string[]>([])
  const [tagInput, setTagInput] = React.useState("")
  const [depSearchInput, setDepSearchInput] = React.useState("")
  const [depError, setDepError] = React.useState("")

  // Sync local state when task changes
  React.useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description ?? "")
    setStatus(task.status)
    setPriority(task.priority)
    setDueDate(task.dueDate ?? "")
    setAssignee(task.assignee ?? "")
    setCustomFieldValues(task.customFieldValues)
    setCustomFieldErrors({})
    setSaveErrors([])
    setTagInput("")
    setDepSearchInput("")
    setDepError("")
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null

  // ── Derived values ──────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0]
  const isDueDatePast = dueDate !== "" && dueDate < today

  const isFinalStatus = statuses.find((s) => s.name === status)?.isFinal ?? false
  const incompletePrereqs = task.prerequisiteIds.filter((pid) => {
    const prereq = tasks.find((t) => t.id === pid)
    if (!prereq) return false
    const prereqProject = prereq.projectId
      ? projects.find((p) => p.id === prereq.projectId) ?? null
      : null
    const prereqStatuses = prereqProject?.statuses ?? DEFAULT_STATUSES
    return !prereqStatuses.find((s) => s.name === prereq.status)?.isFinal
  })
  const showIncompletePrereqWarning = isFinalStatus && incompletePrereqs.length > 0

  const prerequisiteTasks = task.prerequisiteIds
    .map((pid) => tasks.find((t) => t.id === pid))
    .filter(Boolean) as typeof tasks

  const dependentTasks = tasks.filter((t) => t.prerequisiteIds.includes(task.id))

  const taskTags = task.tags
    .map((tid) => tags.find((tag) => tag.id === tid))
    .filter(Boolean) as typeof tags

  // Tasks available to add as dependencies (not already a prereq, not self, not would create cycle)
  const availableDepTasks = tasks.filter(
    (t) =>
      t.id !== task.id &&
      !task.prerequisiteIds.includes(t.id) &&
      depSearchInput.trim() !== "" &&
      t.title.toLowerCase().includes(depSearchInput.toLowerCase())
  )

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSave() {
    const result = updateTask(task.id, {
      title,
      description: description || undefined,
      status,
      priority,
      dueDate: dueDate || undefined,
      assignee: assignee || undefined,
      customFieldValues,
    })
    if (!result.ok) {
      setSaveErrors(result.error.map((e) => e.message))
    } else {
      setSaveErrors([])
    }
  }

  function handleDelete() {
    deleteTask(task.id)
    setSelectedTask(null)
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.currentTarget.blur()
    }
  }

  function handleCustomFieldChange(fieldId: ID, value: string | number | boolean | null) {
    const fieldDef = customFieldDefs.find((f) => f.id === fieldId)
    if (!fieldDef) return

    const result = validateCustomFieldValue(value, fieldDef)
    if (!result.ok) {
      setCustomFieldErrors((prev) => ({ ...prev, [fieldId]: result.error.message }))
    } else {
      setCustomFieldErrors((prev) => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
      setCustomFieldValues((prev) => {
        const filtered = prev.filter((cfv) => cfv.fieldId !== fieldId)
        if (value === null) return filtered
        return [...filtered, { fieldId, value }]
      })
    }
  }

  function handleAddTag() {
    const label = tagInput.trim()
    if (!label) return
    applyTag(task.id, label)
    setTagInput("")
  }

  function handleTagInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddTag()
    }
  }

  function handleAddDependency(depId: ID) {
    const result = addDependency(task.id, depId)
    if (!result.ok) {
      setDepError(result.error.message)
    } else {
      setDepError("")
      setDepSearchInput("")
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1 pb-4">

        {/* Title */}
        <div className="space-y-1 pt-2">
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleTitleKeyDown}
            placeholder="Task title"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            placeholder="Add a description…"
            rows={3}
          />
        </div>

        {/* Status & Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="task-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v)
              }}
            >
              <SelectTrigger id="task-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={(v) => {
                setPriority(v)
              }}
            >
              <SelectTrigger id="task-priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Incomplete prereq warning when marking final */}
        {showIncompletePrereqWarning && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {incompletePrereqs.length} prerequisite(s) are not yet complete.
            </AlertDescription>
          </Alert>
        )}

        {/* Due Date */}
        <div className="space-y-1">
          <Label htmlFor="task-due-date">Due Date</Label>
          <Input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            onBlur={handleSave}
          />
          {isDueDatePast && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>This due date is in the past.</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Assignee */}
        <div className="space-y-1">
          <Label htmlFor="task-assignee">Assignee</Label>
          <Input
            id="task-assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            onBlur={handleSave}
            placeholder="Assign to…"
          />
        </div>

        {/* Custom Fields */}
        {customFieldDefs.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-medium">Custom Fields</p>
              {customFieldDefs.map((fieldDef) => (
                <CustomFieldControl
                  key={fieldDef.id}
                  fieldDef={fieldDef}
                  value={customFieldValues.find((cfv) => cfv.fieldId === fieldDef.id)}
                  onChange={handleCustomFieldChange}
                  error={customFieldErrors[fieldDef.id]}
                />
              ))}
            </div>
          </>
        )}

        {/* Tags */}
        <Separator />
        <div className="space-y-2">
          <p className="text-sm font-medium">Tags</p>
          {taskTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {taskTags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
                  {tag.label}
                  <button
                    type="button"
                    onClick={() => removeTagFromTask(task.id, tag.id)}
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    aria-label={`Remove tag ${tag.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="Add tag…"
              className="h-8 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Dependencies */}
        <Separator />
        <div className="space-y-3">
          <p className="text-sm font-medium">Dependencies</p>

          {/* Prerequisites */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Prerequisites
            </p>
            {prerequisiteTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-1">
                {prerequisiteTasks.map((prereq) => {
                  const prereqProject = prereq.projectId
                    ? projects.find((p) => p.id === prereq.projectId) ?? null
                    : null
                  const prereqStatuses = prereqProject?.statuses ?? DEFAULT_STATUSES
                  const isComplete = prereqStatuses.find((s) => s.name === prereq.status)?.isFinal ?? false
                  return (
                    <li
                      key={prereq.id}
                      className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm"
                    >
                      <span className={isComplete ? "line-through text-muted-foreground" : ""}>
                        {prereq.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDependency(task.id, prereq.id)}
                        className="ml-2 rounded hover:bg-muted p-0.5"
                        aria-label={`Remove prerequisite ${prereq.title}`}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Add dependency search */}
          <div className="space-y-1">
            <Input
              value={depSearchInput}
              onChange={(e) => {
                setDepSearchInput(e.target.value)
                setDepError("")
              }}
              placeholder="Search tasks to add as prerequisite…"
              className="h-8 text-sm"
            />
            {depError && (
              <p className="text-xs text-destructive">{depError}</p>
            )}
            {availableDepTasks.length > 0 && (
              <ul className="rounded-md border divide-y max-h-40 overflow-y-auto">
                {availableDepTasks.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                      onClick={() => handleAddDependency(t.id)}
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Dependents */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Blocked by this task
            </p>
            {dependentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-1">
                {dependentTasks.map((dep) => (
                  <li
                    key={dep.id}
                    className="rounded-md border px-2 py-1.5 text-sm text-muted-foreground"
                  >
                    {dep.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Save errors */}
        {saveErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-0.5">
                {saveErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t pt-4 flex gap-2">
        <Button className="flex-1" onClick={handleSave}>
          Save
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}
