// Smoke test to verify arbitraries can be imported and used
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  arbitraryTitle,
  arbitraryStatusDef,
  arbitraryPriorityDef,
  arbitraryCustomFieldDef,
  arbitraryProject,
  arbitraryTask,
  arbitraryTag,
  arbitraryTrackerState,
  arbitraryFilterCriteria,
  arbitraryDependencyGraph,
  arbitraryCustomFieldValue,
  arbitraryTaskInput,
  arbitraryProjectInput,
} from "./arbitraries";

describe("Arbitraries smoke tests", () => {
  it("arbitraryTitle generates non-empty strings", () => {
    fc.assert(
      fc.property(arbitraryTitle(), (title) => {
        expect(typeof title).toBe("string");
        expect(title.trim().length).toBeGreaterThan(0);
        expect(title.length).toBeLessThanOrEqual(200);
      }),
      { numRuns: 10 }
    );
  });

  it("arbitraryStatusDef generates valid StatusDef", () => {
    fc.assert(
      fc.property(arbitraryStatusDef(), (status) => {
        expect(typeof status.name).toBe("string");
        expect(status.name.trim().length).toBeGreaterThan(0);
        expect(status.isDefault).toBe(false);
        expect(status.isFinal).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  it("arbitraryPriorityDef generates valid PriorityDef", () => {
    fc.assert(
      fc.property(arbitraryPriorityDef(), (priority) => {
        expect(typeof priority.name).toBe("string");
        expect(priority.name.trim().length).toBeGreaterThan(0);
        expect(priority.weight).toBeGreaterThanOrEqual(1);
        expect(priority.weight).toBeLessThanOrEqual(10);
      }),
      { numRuns: 10 }
    );
  });

  it("arbitraryCustomFieldDef generates valid CustomFieldDef", () => {
    fc.assert(
      fc.property(arbitraryCustomFieldDef(), (field) => {
        expect(typeof field.id).toBe("string");
        expect(typeof field.name).toBe("string");
        expect(field.name.trim().length).toBeGreaterThan(0);
        expect(["text", "number", "date", "boolean", "single-select"]).toContain(
          field.type
        );
        if (field.type === "single-select") {
          expect(Array.isArray(field.options)).toBe(true);
          expect(field.options!.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 10 }
    );
  });

  it("arbitraryProject generates valid Project", () => {
    fc.assert(
      fc.property(arbitraryProject(), (project) => {
        expect(typeof project.id).toBe("string");
        expect(typeof project.name).toBe("string");
        expect(project.name.trim().length).toBeGreaterThan(0);
        expect(Array.isArray(project.statuses)).toBe(true);
        expect(Array.isArray(project.priorities)).toBe(true);
        expect(Array.isArray(project.customFields)).toBe(true);
        expect(typeof project.createdAt).toBe("string");
        expect(typeof project.updatedAt).toBe("string");
      }),
      { numRuns: 10 }
    );
  });

  it("arbitraryTask generates valid Task", () => {
    fc.assert(
      fc.property(arbitraryTask(), (task) => {
        expect(typeof task.id).toBe("string");
        expect(typeof task.title).toBe("string");
        expect(task.title.trim().length).toBeGreaterThan(0);
        expect(typeof task.status).toBe("string");
        expect(typeof task.priority).toBe("string");
        expect(Array.isArray(task.tags)).toBe(true);
        expect(Array.isArray(task.customFieldValues)).toBe(true);
        expect(Array.isArray(task.prerequisiteIds)).toBe(true);
        expect(typeof task.createdAt).toBe("string");
        expect(typeof task.updatedAt).toBe("string");
      }),
      { numRuns: 10 }
    );
  });

  it("arbitraryTag generates valid Tag", () => {
    fc.assert(
      fc.property(arbitraryTag(), (tag) => {
        expect(typeof tag.id).toBe("string");
        expect(typeof tag.label).toBe("string");
        expect(tag.label.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 10 }
    );
  });

  it("arbitraryTrackerState generates valid TrackerState", () => {
    fc.assert(
      fc.property(arbitraryTrackerState(), (state) => {
        expect(state.version).toBe(1);
        expect(Array.isArray(state.projects)).toBe(true);
        expect(Array.isArray(state.tasks)).toBe(true);
        expect(Array.isArray(state.tags)).toBe(true);
        expect(Array.isArray(state.savedViews)).toBe(true);
        expect(Array.isArray(state.templates)).toBe(true);

        // Verify task projectIds reference existing projects or are null
        const projectIds = new Set(state.projects.map((p) => p.id));
        for (const task of state.tasks) {
          if (task.projectId !== null) {
            expect(projectIds.has(task.projectId)).toBe(true);
          }
        }
      }),
      { numRuns: 10 }
    );
  });

  it("arbitraryFilterCriteria generates valid FilterCriteria", () => {
    fc.assert(
      fc.property(
        arbitraryTrackerState().chain((state) =>
          arbitraryFilterCriteria(state.tasks).map((criteria) => ({
            state,
            criteria,
          }))
        ),
        ({ criteria }) => {
          expect(typeof criteria).toBe("object");
          if (criteria.statuses) {
            expect(Array.isArray(criteria.statuses)).toBe(true);
          }
          if (criteria.priorities) {
            expect(Array.isArray(criteria.priorities)).toBe(true);
          }
          if (criteria.projectIds) {
            expect(Array.isArray(criteria.projectIds)).toBe(true);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it("arbitraryDependencyGraph generates acyclic dependencies", () => {
    fc.assert(
      fc.property(
        arbitraryTrackerState().chain((state) =>
          arbitraryDependencyGraph(state.tasks).map((tasksWithDeps) => ({
            state,
            tasksWithDeps,
          }))
        ),
        ({ state, tasksWithDeps }) => {
          expect(Array.isArray(tasksWithDeps)).toBe(true);
          expect(tasksWithDeps.length).toBe(state.tasks.length);

          // Verify all prerequisiteIds reference tasks that appear earlier in the array
          const seenIds = new Set<string>();
          for (const task of tasksWithDeps) {
            for (const prereqId of task.prerequisiteIds) {
              expect(seenIds.has(prereqId)).toBe(true);
            }
            seenIds.add(task.id);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it("arbitraryCustomFieldValue generates values matching field type", () => {
    fc.assert(
      fc.property(
        arbitraryCustomFieldDef().chain((field) =>
          arbitraryCustomFieldValue(field).map((value) => ({ field, value }))
        ),
        ({ field, value }) => {
          expect(value.fieldId).toBe(field.id);

          if (value.value !== null) {
            switch (field.type) {
              case "text":
                expect(typeof value.value).toBe("string");
                break;
              case "number":
                expect(typeof value.value).toBe("number");
                break;
              case "date":
                expect(typeof value.value).toBe("string");
                expect(/^\d{4}-\d{2}-\d{2}$/.test(value.value as string)).toBe(
                  true
                );
                break;
              case "boolean":
                expect(typeof value.value).toBe("boolean");
                break;
              case "single-select":
                expect(typeof value.value).toBe("string");
                if (field.options) {
                  expect(field.options).toContain(value.value);
                }
                break;
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it("arbitraryTaskInput generates valid TaskInput", () => {
    fc.assert(
      fc.property(arbitraryTaskInput(), (taskInput) => {
        expect(typeof taskInput.title).toBe("string");
        expect(taskInput.title.trim().length).toBeGreaterThan(0);
        expect(typeof taskInput.status).toBe("string");
        expect(typeof taskInput.priority).toBe("string");
        expect(Array.isArray(taskInput.tags)).toBe(true);
        expect(Array.isArray(taskInput.customFieldValues)).toBe(true);
        expect(Array.isArray(taskInput.prerequisiteIds)).toBe(true);
        // Should NOT have id, createdAt, updatedAt
        expect("id" in taskInput).toBe(false);
        expect("createdAt" in taskInput).toBe(false);
        expect("updatedAt" in taskInput).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  it("arbitraryProjectInput generates valid ProjectInput", () => {
    fc.assert(
      fc.property(arbitraryProjectInput(), (projectInput) => {
        expect(typeof projectInput.name).toBe("string");
        expect(projectInput.name.trim().length).toBeGreaterThan(0);
        expect(Array.isArray(projectInput.statuses)).toBe(true);
        expect(Array.isArray(projectInput.priorities)).toBe(true);
        expect(Array.isArray(projectInput.customFields)).toBe(true);
        // Should NOT have id
        expect("id" in projectInput).toBe(false);
      }),
      { numRuns: 10 }
    );
  });
});
