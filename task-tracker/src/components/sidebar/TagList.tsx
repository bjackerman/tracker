import { X } from "lucide-react"
import { useTrackerStore } from "@/store/trackerStore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function TagList() {
  const tags = useTrackerStore((s) => s.tags)
  const activeFilters = useTrackerStore((s) => s.activeFilters)
  const setActiveFilters = useTrackerStore((s) => s.setActiveFilters)

  const activeTagIds = activeFilters.tagIds ?? []
  const hasTagFilter = activeTagIds.length > 0

  function handleTagClick(tagId: string) {
    setActiveFilters({ ...activeFilters, tagIds: [tagId] })
  }

  function handleClearFilter() {
    const { tagIds: _removed, ...rest } = activeFilters
    setActiveFilters(rest)
  }

  if (tags.length === 0) return null

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tags
        </span>
        {hasTagFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleClearFilter}
          >
            <X className="mr-1 h-3 w-3" />
            Clear filter
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 py-1">
        {tags.map((tag) => {
          const isActive = activeTagIds.includes(tag.id)
          return (
            <button
              key={tag.id}
              onClick={() => handleTagClick(tag.id)}
              className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-full"
              aria-pressed={isActive}
            >
              <Badge
                variant={isActive ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-colors",
                  isActive && "ring-2 ring-ring ring-offset-1"
                )}
              >
                {tag.label}
              </Badge>
            </button>
          )
        })}
      </div>
    </div>
  )
}
