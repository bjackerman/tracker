import { useState, useEffect } from "react"
import { Settings, Trash2, Plus } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { useTrackerStore } from "@/store/trackerStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { StatusDef, PriorityDef, CustomFieldDef, ProjectTemplate } from "@/types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectSettingsProps {
  projectId: string
}

type TabId = "statuses" | "priorities" | "custom-fields" | "templates"

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: "statuses", label: "Statuses" },
  { id: "priorities", label: "Priorities" },
  { id: "custom-fields", label: "Custom Fields" },
  { id: "templates", label: "Templates" },
]

// ─── Status Editor ────────────────────────────────────────────────────────────

interface StatusEditorProps {
  statuses: StatusDef[]
  onChange: (statuses: StatusDef[]) => void
  onSave: () => void
}

function StatusEditor({ statuses, onChange, onSave }: StatusEditorProps) {
  function updateName(index: number, name: string) {
    const updated = statuses.map((s, i) => (i === index ? { ...s, name } : s))
    onChange(updated)
  }

  function toggleDefault(index: number) {
    // Only one can be default — selecting one deselects others
    const updated = statuses.map((s, i) => ({ ...s, isDefault: i === index }))
    onChange(updated)
  }

  function toggleFinal(index: number) {
    const updated = statuses.map((s, i) =>
      i === index ? { ...s, isFinal: !s.isFinal } : s
    )
    onChange(updated)
  }

  function removeStatus(index: number) {
    if (statuses.length <= 1) return
    const updated = statuses.filter((_, i) => i !== index)
    // Ensure at least one default
    if (!updated.some((s) => s.isDefault) && updated.length > 0) {
      updated[0] = { ...updated[0], isDefault: true }
    }
    onChange(updated)
  }

  function addStatus() {
    onChange([...statuses, { name: "", isDefault: false, isFinal: false }])
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
        <span>Name</span>
        <span className="text-center w-16">Default</span>
        <span className="text-center w-12">Final</span>
        <span className="w-8" />
      </div>

      {statuses.map((status, index) => (
        <div key={index} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
          <Input
            value={status.name}
            onChange={(e) => updateName(index, e.target.value)}
            placeholder="Status name"
            className="h-8 text-sm"
          />
          <div className="flex justify-center w-16">
            <input
              type="checkbox"
              checked={status.isDefault}
              onChange={() => toggleDefault(index)}
              className="h-4 w-4 cursor-pointer accent-primary"
              aria-label={`Set ${status.name || "status"} as default`}
            />
          </div>
          <div className="flex justify-center w-12">
            <input
              type="checkbox"
              checked={status.isFinal}
              onChange={() => toggleFinal(index)}
              className="h-4 w-4 cursor-pointer accent-primary"
              aria-label={`Mark ${status.name || "status"} as final`}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => removeStatus(index)}
            disabled={statuses.length <= 1}
            aria-label="Remove status"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={addStatus}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Status
        </Button>
        <Button size="sm" onClick={onSave}>
          Save Statuses
        </Button>
      </div>
    </div>
  )
}

// ─── Priority Editor ──────────────────────────────────────────────────────────

interface PriorityEditorProps {
  priorities: PriorityDef[]
  onChange: (priorities: PriorityDef[]) => void
  onSave: () => void
}

function PriorityEditor({ priorities, onChange, onSave }: PriorityEditorProps) {
  function updateName(index: number, name: string) {
    const updated = priorities.map((p, i) => (i === index ? { ...p, name } : p))
    onChange(updated)
  }

  function updateWeight(index: number, weight: number) {
    const updated = priorities.map((p, i) => (i === index ? { ...p, weight } : p))
    onChange(updated)
  }

  function removePriority(index: number) {
    if (priorities.length <= 1) return
    onChange(priorities.filter((_, i) => i !== index))
  }

  function addPriority() {
    onChange([...priorities, { name: "", weight: 0 }])
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
        <span>Name</span>
        <span className="w-24">Weight</span>
        <span className="w-8" />
      </div>

      {priorities.map((priority, index) => (
        <div key={index} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
          <Input
            value={priority.name}
            onChange={(e) => updateName(index, e.target.value)}
            placeholder="Priority name"
            className="h-8 text-sm"
          />
          <Input
            type="number"
            value={priority.weight}
            onChange={(e) => updateWeight(index, Number(e.target.value))}
            className="h-8 text-sm w-24"
            aria-label="Weight"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => removePriority(index)}
            disabled={priorities.length <= 1}
            aria-label="Remove priority"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={addPriority}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Priority
        </Button>
        <Button size="sm" onClick={onSave}>
          Save Priorities
        </Button>
      </div>
    </div>
  )
}

// ─── Custom Field Editor ──────────────────────────────────────────────────────

type FieldType = CustomFieldDef["type"]

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
  { value: "single-select", label: "Single Select" },
]

interface CustomFieldEditorProps {
  projectId: string
  fields: CustomFieldDef[]
  onAdd: () => void
  onRemove: (fieldId: string) => void
  onUpdateField: (fieldId: string, patch: Partial<Omit<CustomFieldDef, "id">>) => void
}

function CustomFieldEditor({
  projectId: _projectId,
  fields,
  onAdd,
  onRemove,
  onUpdateField,
}: CustomFieldEditorProps) {
  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">
          No custom fields yet. Add one below.
        </p>
      )}

      {fields.map((field) => (
        <div key={field.id} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Input
              value={field.name}
              onChange={(e) => onUpdateField(field.id, { name: e.target.value })}
              placeholder="Field name"
              className="h-8 text-sm flex-1"
            />
            <Select
              value={field.type}
              onValueChange={(value) =>
                onUpdateField(field.id, { type: value as FieldType, options: undefined })
              }
            >
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft.value} value={ft.value}>
                    {ft.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => onRemove(field.id)}
              aria-label="Remove custom field"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {field.type === "single-select" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Options (comma-separated)
              </label>
              <Textarea
                value={(field.options ?? []).join(", ")}
                onChange={(e) => {
                  const options = e.target.value
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean)
                  onUpdateField(field.id, { options })
                }}
                placeholder="Option A, Option B, Option C"
                className="min-h-[60px] text-sm"
              />
            </div>
          )}
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Custom Field
      </Button>
    </div>
  )
}

// ─── Template Selector ────────────────────────────────────────────────────────

interface TemplateSelectorProps {
  templates: ProjectTemplate[]
  onApply: (template: ProjectTemplate) => void
}

function TemplateSelector({ templates, onApply }: TemplateSelectorProps) {
  if (templates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No templates available.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Applying a template will replace the project's statuses, priorities, and custom fields.
      </p>
      {templates.map((template) => (
        <div
          key={template.id}
          className="flex items-center justify-between rounded-md border p-3"
        >
          <div>
            <p className="text-sm font-medium">{template.name}</p>
            <p className="text-xs text-muted-foreground">
              {template.statuses.length} statuses · {template.priorities.length} priorities ·{" "}
              {template.customFields.length} custom fields
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onApply(template)}>
            Apply
          </Button>
        </div>
      ))}
    </div>
  )
}

// ─── ProjectSettings (main component) ────────────────────────────────────────

export default function ProjectSettings({ projectId }: ProjectSettingsProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("statuses")

  const project = useTrackerStore((s) => s.projects.find((p) => p.id === projectId))
  const templates = useTrackerStore((s) => s.templates)
  const updateProject = useTrackerStore((s) => s.updateProject)
  const addCustomField = useTrackerStore((s) => s.addCustomField)
  const removeCustomField = useTrackerStore((s) => s.removeCustomField)

  // Local draft state for statuses and priorities (saved explicitly)
  const [draftStatuses, setDraftStatuses] = useState<StatusDef[]>([])
  const [draftPriorities, setDraftPriorities] = useState<PriorityDef[]>([])

  // Sync drafts when project changes or dialog opens
  useEffect(() => {
    if (project && open) {
      setDraftStatuses(project.statuses)
      setDraftPriorities(project.priorities)
    }
  }, [project, open])

  if (!project) return null

  function handleSaveStatuses() {
    updateProject(projectId, { statuses: draftStatuses })
  }

  function handleSavePriorities() {
    updateProject(projectId, { priorities: draftPriorities })
  }

  function handleAddCustomField() {
    addCustomField(projectId, { name: "", type: "text" })
  }

  function handleRemoveCustomField(fieldId: string) {
    removeCustomField(projectId, fieldId)
  }

  function handleUpdateCustomField(
    fieldId: string,
    patch: Partial<Omit<CustomFieldDef, "id">>
  ) {
    const updatedFields = project.customFields.map((f) =>
      f.id === fieldId ? { ...f, ...patch } : f
    )
    updateProject(projectId, { customFields: updatedFields })
  }

  function handleApplyTemplate(template: ProjectTemplate) {
    const customFields: CustomFieldDef[] = template.customFields.map((cf) => ({
      ...cf,
      id: uuidv4(),
    }))
    updateProject(projectId, {
      statuses: template.statuses,
      priorities: template.priorities,
      customFields,
    })
    // Sync drafts
    setDraftStatuses(template.statuses)
    setDraftPriorities(template.priorities)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={`Settings for ${project.name}`}
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project Settings — {project.name}</DialogTitle>
          </DialogHeader>

          {/* Tab bar */}
          <div className="flex gap-1 border-b pb-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="pt-2">
            {activeTab === "statuses" && (
              <StatusEditor
                statuses={draftStatuses}
                onChange={setDraftStatuses}
                onSave={handleSaveStatuses}
              />
            )}

            {activeTab === "priorities" && (
              <PriorityEditor
                priorities={draftPriorities}
                onChange={setDraftPriorities}
                onSave={handleSavePriorities}
              />
            )}

            {activeTab === "custom-fields" && (
              <CustomFieldEditor
                projectId={projectId}
                fields={project.customFields}
                onAdd={handleAddCustomField}
                onRemove={handleRemoveCustomField}
                onUpdateField={handleUpdateCustomField}
              />
            )}

            {activeTab === "templates" && (
              <TemplateSelector
                templates={templates}
                onApply={handleApplyTemplate}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
