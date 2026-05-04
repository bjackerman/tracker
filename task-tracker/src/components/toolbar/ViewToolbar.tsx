import * as React from "react"
import { Search, X, Save, RefreshCw } from "lucide-react"
import {
  startOfISOWeek,
  endOfISOWeek,
  format,
} from "date-fns"
import { useTrackerStore } from "@/store/trackerStore"
import type { FilterCriteria, SortCriteria, SortField, SortDirection } from "@/types/index"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ASSIGNEE_KEY = "task-tracker-assignee"

function getCurrentWeekRange(): { from: string; to: string } {
  const now = new Date()
  return {
    from: format(startOfISOWeek(now), "yyyy-MM-dd"),
    to: format(endOfISOWeek(now), "yyyy-MM-dd"),
  }
}

// ─── Sort option definitions ──────────────────────────────────────────────────

interface SortOption {
  value: string
  label: string
  field: SortField
  direction: SortDirection
}

const SORT_OPTIONS: SortOption[] = [
  { value: "title-asc",      label: "Title (A-Z)",           field: "title",     direction: "asc"  },
  { value: "title-desc",     label: "Title (Z-A)",           field: "title",     direction: "desc" },
  { value: "dueDate-asc",    label: "Due Date (Earliest)",   field: "dueDate",   direction: "asc"  },
  { value: "dueDate-desc",   label: "Due Date (Latest)",     field: "dueDate",   direction: "desc" },
  { value: "priority-desc",  label: "Priority (High-Low)",   field: "priority",  direction: "desc" },
  { value: "priority-asc",   label: "Priority (Low-High)",   field: "priority",  direction: "asc"  },
  { value: "createdAt-desc", label: "Created (Newest)",      field: "createdAt", direction: "desc" },
  { value: "createdAt-asc",  label: "Created (Oldest)",      field: "createdAt", direction: "asc"  },
]

function sortKey(sort: SortCriteria): string {
  return `${sort.field}-${sort.direction}`
}

// ─── Filter chip helpers ──────────────────────────────────────────────────────

interface FilterChip {
  key: string
  label: string
  onRemove: () => void
}

function useFilterChips(
  filters: FilterCriteria,
  tags: { id: string; label: string }[],
  setActiveFilters: (f: FilterCriteria) => void
): FilterChip[] {
  const chips: FilterChip[] = []

  // statuses
  if (filters.statuses && filters.statuses.length > 0) {
    for (const status of filters.statuses) {
      chips.push({
        key: `status-${status}`,
        label: `Status: ${status}`,
        onRemove: () =>
          setActiveFilters({
            ...filters,
            statuses: filters.statuses!.filter((s) => s !== status),
          }),
      })
    }
  }

  // priorities
  if (filters.priorities && filters.priorities.length > 0) {
    for (const priority of filters.priorities) {
      chips.push({
        key: `priority-${priority}`,
        label: `Priority: ${priority}`,
        onRemove: () =>
          setActiveFilters({
            ...filters,
            priorities: filters.priorities!.filter((p) => p !== priority),
          }),
      })
    }
  }

  // tagIds
  if (filters.tagIds && filters.tagIds.length > 0) {
    for (const tagId of filters.tagIds) {
      const tag = tags.find((t) => t.id === tagId)
      chips.push({
        key: `tag-${tagId}`,
        label: `Tag: ${tag?.label ?? tagId}`,
        onRemove: () =>
          setActiveFilters({
            ...filters,
            tagIds: filters.tagIds!.filter((id) => id !== tagId),
          }),
      })
    }
  }

  // assignees
  if (filters.assignees && filters.assignees.length > 0) {
    for (const assignee of filters.assignees) {
      chips.push({
        key: `assignee-${assignee}`,
        label: `Assignee: ${assignee}`,
        onRemove: () =>
          setActiveFilters({
            ...filters,
            assignees: filters.assignees!.filter((a) => a !== assignee),
          }),
      })
    }
  }

  // dueDateStatus
  if (filters.dueDateStatus) {
    const labelMap: Record<string, string> = {
      overdue: "Overdue",
      "due-soon": "Due Soon",
      "no-due-date": "No Due Date",
    }
    chips.push({
      key: `dueDateStatus-${filters.dueDateStatus}`,
      label: labelMap[filters.dueDateStatus] ?? filters.dueDateStatus,
      onRemove: () =>
        setActiveFilters({ ...filters, dueDateStatus: undefined }),
    })
  }

  return chips
}

// ─── Save View inline form ────────────────────────────────────────────────────

interface SaveViewFormProps {
  onSave: (name: string) => void
  onCancel: () => void
}

function SaveViewForm({ onSave, onCancel }: SaveViewFormProps) {
  const [name, setName] = React.useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) {
      onSave(trimmed)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="View name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 w-40 text-xs"
      />
      <Button type="submit" size="sm" disabled={!name.trim()}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  )
}

// ─── ViewToolbar ──────────────────────────────────────────────────────────────

export function ViewToolbar() {
  const savedViews    = useTrackerStore((s) => s.savedViews)
  const tags          = useTrackerStore((s) => s.tags)
  const activeFilters = useTrackerStore((s) => s.activeFilters)
  const activeSort    = useTrackerStore((s) => s.activeSort)
  const activeViewId  = useTrackerStore((s) => s.activeViewId)

  const setActiveView    = useTrackerStore((s) => s.setActiveView)
  const setActiveFilters = useTrackerStore((s) => s.setActiveFilters)
  const setActiveSort    = useTrackerStore((s) => s.setActiveSort)
  const saveView         = useTrackerStore((s) => s.saveView)
  const updateView       = useTrackerStore((s) => s.updateView)

  const [showSaveForm, setShowSaveForm] = React.useState(false)

  // Determine if the active view is a user (non-built-in) view
  const activeView = savedViews.find((v) => v.id === activeViewId) ?? null
  const canUpdateView = activeView !== null && !activeView.isBuiltIn

  // ── View selector ──────────────────────────────────────────────────────────

  function handleViewChange(id: string) {
    setActiveView(id)
    const view = savedViews.find((v) => v.id === id)
    if (!view) return

    // Apply base filters/sort from the view definition
    let filters: FilterCriteria = { ...view.filters }

    // Special handling for built-in views that need dynamic filter values
    if (id === "view-due-this-week") {
      const { from, to } = getCurrentWeekRange()
      filters = { ...filters, dueDateRange: { from, to } }
    } else if (id === "view-my-tasks") {
      const assignee = localStorage.getItem(ASSIGNEE_KEY)
      if (assignee) {
        filters = { ...filters, assignees: [assignee] }
      }
    }

    setActiveFilters(filters)
    setActiveSort(view.sort)
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setActiveFilters({ ...activeFilters, searchQuery: e.target.value })
  }

  // ── Sort selector ──────────────────────────────────────────────────────────

  function handleSortChange(value: string) {
    const option = SORT_OPTIONS.find((o) => o.value === value)
    if (option) {
      setActiveSort({ field: option.field, direction: option.direction })
    }
  }

  // ── Filter chips ───────────────────────────────────────────────────────────

  const chips = useFilterChips(activeFilters, tags, setActiveFilters)

  // ── Save / Update view ─────────────────────────────────────────────────────

  function handleSaveView(name: string) {
    saveView({ name, filters: activeFilters, sort: activeSort })
    setShowSaveForm(false)
  }

  function handleUpdateView() {
    if (activeViewId && canUpdateView) {
      updateView(activeViewId, { filters: activeFilters, sort: activeSort })
    }
  }

  // ── Built-in vs user views for the select ─────────────────────────────────

  const builtInViews = savedViews.filter((v) => v.isBuiltIn)
  const userViews    = savedViews.filter((v) => !v.isBuiltIn)

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-background">
      {/* View selector */}
      <Select value={activeViewId ?? ""} onValueChange={handleViewChange}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="Select view…" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Built-in Views</SelectLabel>
            {builtInViews.map((view) => (
              <SelectItem key={view.id} value={view.id}>
                {view.name}
              </SelectItem>
            ))}
          </SelectGroup>
          {userViews.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Saved Views</SelectLabel>
                {userViews.map((view) => (
                  <SelectItem key={view.id} value={view.id}>
                    {view.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>

      {/* Search input */}
      <div className="relative flex items-center">
        <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search tasks…"
          value={activeFilters.searchQuery ?? ""}
          onChange={handleSearchChange}
          className="h-8 w-52 pl-7 text-xs"
        />
      </div>

      {/* Active filter chips */}
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="flex items-center gap-1 pr-1 text-xs"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label={`Remove filter: ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sort selector */}
      <Select value={sortKey(activeSort)} onValueChange={handleSortChange}>
        <SelectTrigger className="h-8 w-52 text-xs">
          <SelectValue placeholder="Sort by…" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Update View button — only for non-built-in active views */}
      {canUpdateView && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={handleUpdateView}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Update View
        </Button>
      )}

      {/* Save View button / inline form */}
      {showSaveForm ? (
        <SaveViewForm
          onSave={handleSaveView}
          onCancel={() => setShowSaveForm(false)}
        />
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => setShowSaveForm(true)}
        >
          <Save className="h-3.5 w-3.5 mr-1" />
          Save View
        </Button>
      )}
    </div>
  )
}
