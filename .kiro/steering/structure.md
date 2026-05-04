# Project Structure

```
.
├── .kiro/
│   ├── specs/task-tracker/     # Spec: requirements, design, tasks
│   └── steering/               # AI assistant steering documents
└── task-tracker/               # Main application (React + Vite)
    ├── src/
    │   ├── components/         # React UI components
    │   │   ├── ui/             # shadcn/ui base components
    │   │   ├── layout/         # AppShell, Sidebar, MainPanel
    │   │   ├── tasks/          # TaskList, TaskRow, TaskDetail, EmptyState
    │   │   ├── sidebar/        # ProjectList, ProjectItem, TagList
    │   │   ├── toolbar/        # ViewToolbar
    │   │   ├── projects/       # ProjectSettings
    │   │   └── io/             # ImportExportPanel
    │   ├── services/           # Pure business logic services
    │   │   ├── __tests__/      # Service unit + property tests
    │   │   ├── ValidationService.ts
    │   │   ├── FilterService.ts
    │   │   ├── DependencyService.ts
    │   │   └── StorageService.ts
    │   ├── store/              # Zustand store
    │   │   ├── __tests__/      # Store integration tests
    │   │   └── trackerStore.ts
    │   ├── types/              # TypeScript type definitions
    │   │   ├── index.ts        # All domain types
    │   │   └── result.ts       # Result<T, E> type
    │   ├── lib/
    │   │   └── utils.ts        # cn() utility (clsx + tailwind-merge)
    │   ├── test/
    │   │   ├── setup.ts        # @testing-library/jest-dom setup
    │   │   ├── setup.test.ts   # Smoke tests for test infrastructure
    │   │   └── arbitraries.ts  # fast-check arbitrary generators
    │   ├── views/              # Built-in view components
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css           # Tailwind directives + CSS variables
    ├── public/
    ├── components.json         # shadcn/ui configuration
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── vite.config.ts          # Vite + Vitest configuration
    ├── tsconfig.json
    ├── tsconfig.app.json       # App TypeScript config (includes path aliases)
    ├── tsconfig.node.json      # Node/Vite config TypeScript config
    └── package.json
```

## Naming Conventions
- React components: PascalCase files (e.g., `TaskRow.tsx`)
- Services: PascalCase with `Service` suffix (e.g., `ValidationService.ts`)
- Tests: co-located in `__tests__/` subdirectory with `.test.ts` suffix
- Types: exported from `src/types/index.ts`
- Path alias: `@/` maps to `src/`
