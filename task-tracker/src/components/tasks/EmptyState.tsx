export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-muted-foreground text-sm">No tasks match your current filters.</p>
      <p className="text-muted-foreground text-xs mt-1">Try adjusting your search or filters.</p>
    </div>
  )
}
