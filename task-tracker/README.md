# Task Tracker (Draft)

A lightweight, local-first task tracking web app built with **React + TypeScript + Vite**.

> ⚠️ This README is a draft and can be refined as features and workflows are finalized.

## Overview

Task Tracker helps you organize work by project, status, priority, due date, and dependencies. The app is designed to run entirely in the browser, with persisted local storage and import/export support for backup and migration.

## Current Features

- **Project management**
  - Create, rename, update, and delete projects.
  - Configure project-level statuses, priorities, and custom fields.
- **Task management**
  - Create, update, and delete tasks.
  - Assign tasks to projects, tags, priorities, statuses, and due dates.
  - Open a task detail panel for focused editing.
- **Views and organization**
  - Built-in views such as:
    - By Due Date
    - By Priority
    - Workflow View
    - Dependency View
    - All Tasks
    - My Tasks
    - Due This Week
  - Save and manage additional custom views with filters/sorting.
- **Dependencies**
  - Define task dependencies.
  - Cycle detection to prevent invalid dependency chains.
- **Persistence and recovery**
  - Local persistence via browser storage.
  - Import/export JSON data.
  - Recovery dialog for handling corrupted stored data.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **State management:** Zustand
- **UI primitives:** Radix UI
- **Styling:** Tailwind CSS
- **Testing tools included:** Vitest, Testing Library, fast-check

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Project Structure (high-level)

```text
src/
  components/      # UI and layout components
  services/        # validation, storage, filtering, dependency logic
  store/           # Zustand tracker store and actions
  types/           # core domain types
  views/           # built-in view modules
```

## Data & Storage Notes

- The app is currently local-first and stores data in-browser.
- Export regularly if you want portable backups.
- If storage becomes unreadable, a recovery flow can reset state or download raw data.

## Known Gaps / TODO (Draft)

- Clarify release/versioning strategy.
- Add contribution guidelines.
- Document test scripts (if/when added to `package.json`).
- Add screenshots and UX walkthrough.
- Define roadmap and non-goals.

## License

TBD.
