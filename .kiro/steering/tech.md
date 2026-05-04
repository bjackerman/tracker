# Tech Stack

## Language & Runtime
- TypeScript (strict mode)
- Node.js (via npm)

## Frameworks & Key Libraries
- **React 18** — UI framework
- **Vite 8** — build tool and dev server
- **Zustand** — state management
- **Tailwind CSS v3** — utility-first styling
- **shadcn/ui** — component library (copy-owned, built on Radix UI)
- **Radix UI** — accessible UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-popover`, `@radix-ui/react-tooltip`, `@radix-ui/react-separator`, `@radix-ui/react-switch`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-slot`)
- **date-fns** — date utilities
- **uuid** + `@types/uuid` — UUID generation
- **lucide-react** — icon library
- **class-variance-authority**, **clsx**, **tailwind-merge** — class name utilities
- **cmdk** — command palette primitive
- **react-day-picker** — calendar/date picker
- **tailwindcss-animate** — animation plugin

## Testing
- **Vitest** — test runner (with jsdom environment, globals enabled)
- **fast-check** — property-based testing
- **@testing-library/react** + **@testing-library/user-event** + **@testing-library/jest-dom** — React component testing

## Package Manager
- npm (with package-lock.json)

## Common Commands

```bash
# Install dependencies
npm install

# Build
npm run build

# Dev server (do NOT run in automated tasks)
npm run dev

# Test (run once)
npx vitest --run

# Test (watch mode)
npx vitest

# TypeScript check
npx tsc --noEmit

# Lint
npm run lint
```
