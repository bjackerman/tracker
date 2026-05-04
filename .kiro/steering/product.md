# Product

## What It Is
A dynamic and extensible task tracker and project organizer that runs entirely in the browser. No backend, no authentication — all data is persisted to `localStorage`.

## Who It's For
Anyone who needs flexible task management — from personal to-do lists to multi-project team workflows.

## Key Features
- **Task management**: Create, update, and delete tasks with title, description, status, priority, due date, and assignee
- **Project organization**: Group tasks into projects; tasks can also exist as standalone inbox items
- **Custom fields**: Extend tasks with user-defined fields (text, number, date, boolean, single-select)
- **Tagging**: Apply free-form labels to tasks for cross-project categorization
- **Filtering & search**: Filter by status, priority, tag, assignee, due date range; keyword search across title and description
- **Saved views**: Save filter/sort/groupBy configurations as named views; four built-in views (By Due Date, By Priority, Workflow, Dependency)
- **Task dependencies**: Mark prerequisites, detect cycles, surface bottlenecks
- **Due date awareness**: Visual indicators for overdue and due-soon tasks
- **Data portability**: Export/import full state as JSON; lossless round-trip
- **Per-project configuration**: Custom status lists, priority lists, and project templates

## Domain Terminology
- **Task**: A discrete unit of work
- **Project**: A named container grouping related tasks
- **Status**: Current state of a task (e.g., To Do, In Progress, Done)
- **Priority**: Urgency ranking (Low, Medium, High, Critical)
- **Tag**: Free-form label for cross-project categorization
- **Custom Field**: User-defined attribute extending a task
- **View**: A saved or active presentation shaped by filters, grouping, and sort order
- **Bottleneck**: A non-final task that is blocking one or more other incomplete tasks
- **Final status**: A status equivalent to "Done" — marks a task as complete
