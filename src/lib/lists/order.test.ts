import { describe, expect, it } from "vitest";
import { TodoItemSchema } from "@/lib/sheets/schema";
import { deadlineLabel, moveTo, nextDeadline, parseLines, positionBetween, scheduledGroup, sortItems, STEP, topPosition } from "./order";

const item = (id: string, extra: Record<string, unknown> = {}) => TodoItemSchema.parse({ id, list_id: "l", title: id, ...extra });

describe("positions", () => {
  it("splits the gap between neighbours", () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
    expect(positionBetween(undefined, 1024)).toBe(1024 - STEP);
    expect(positionBetween(1024, undefined)).toBe(1024 + STEP);
    expect(positionBetween(undefined, undefined)).toBe(STEP);
    expect(positionBetween(1, 1 + 1e-9)).toBeNull();
  });

  it("moves one item with a single update", () => {
    const list = [
      { id: "a", position: 1024 },
      { id: "b", position: 2048 },
      { id: "c", position: 3072 },
    ];
    expect(moveTo(list, "c", 0)).toEqual([{ id: "c", position: 0 }]);
    expect(moveTo(list, "a", 1)).toEqual([{ id: "a", position: 2560 }]);
    expect(moveTo(list, "a", 9)).toEqual([{ id: "a", position: 3072 + STEP }]);
  });

  it("re-spaces the list when neighbours have no room left", () => {
    const list = [
      { id: "a", position: 1 },
      { id: "b", position: 1 },
      { id: "c", position: 5 },
    ];
    expect(moveTo(list, "c", 1)).toEqual([
      { id: "a", position: STEP },
      { id: "c", position: 2 * STEP },
      { id: "b", position: 3 * STEP },
    ]);
  });

  it("puts new items above the rest", () => {
    expect(topPosition([])).toBe(STEP);
    expect(topPosition([{ position: 500 }, { position: 100 }])).toBe(100 - STEP);
  });
});

describe("sortItems", () => {
  const items = [
    item("a", { position: 3, priority: "low" }),
    item("b", { position: 1, deadline: "2026-11-10" }),
    item("c", { position: 2, priority: "high", starred: true, deadline: "2026-11-08" }),
  ];
  const ids = (s: Parameters<typeof sortItems>[1]) => sortItems(items, s).map((i) => i.id);

  it("orders by each sort, falling back to manual order", () => {
    expect(ids("manual")).toEqual(["b", "c", "a"]);
    expect(ids("deadline")).toEqual(["c", "b", "a"]);
    expect(ids("priority")).toEqual(["c", "a", "b"]);
    expect(ids("starred")).toEqual(["c", "b", "a"]);
  });
});

describe("deadlines", () => {
  const today = "2026-11-06"; // a Friday
  it("labels relative to today", () => {
    expect(deadlineLabel("2026-11-06", today)).toEqual({ label: "Today", tone: "today" });
    expect(deadlineLabel("2026-11-07", today)).toEqual({ label: "Tomorrow", tone: "soon" });
    expect(deadlineLabel("2026-11-05", today)).toEqual({ label: "Yesterday", tone: "overdue" });
    expect(deadlineLabel("2026-11-10", today).label).toBe("Tue");
    expect(deadlineLabel("2026-12-24", today)).toEqual({ label: "24 Dec", tone: "later" });
    expect(deadlineLabel("2027-01-02", today).label).toBe("2 Jan 2027");
  });

  it("groups for the Scheduled view", () => {
    expect(scheduledGroup("2026-11-01", today)).toBe("overdue");
    expect(scheduledGroup(today, today)).toBe("today");
    expect(scheduledGroup("2026-11-13", today)).toBe("week");
    expect(scheduledGroup("2026-11-14", today)).toBe("later");
  });
});

describe("parseLines", () => {
  it("makes one item per line without bullets", () => {
    expect(parseLines("- Milk\n• Eggs\n\n1. Bread\n[ ] Butter\n☐ Rice\n  Tea  ")).toEqual(["Milk", "Eggs", "Bread", "Butter", "Rice", "Tea"]);
  });
});

describe("schema", () => {
  it("reads hand-typed priorities and unknown values", () => {
    expect(item("x", { priority: "High" }).priority).toBe("high");
    expect(item("x", { priority: "urgent" }).priority).toBe("");
    expect(item("x").priority).toBe("");
  });
});

describe("nextDeadline", () => {
  const today = "2026-11-06";
  it("steps once from a future or current deadline", () => {
    expect(nextDeadline("2026-11-06", "daily", today)).toBe("2026-11-07");
    expect(nextDeadline("2026-11-10", "weekly", today)).toBe("2026-11-17");
    expect(nextDeadline("2026-11-06", "yearly", today)).toBe("2027-11-06");
  });

  it("keeps the day of month, clamping short months", () => {
    expect(nextDeadline("2027-01-31", "monthly", today)).toBe("2027-02-28");
  });

  it("skips occurrences already past", () => {
    expect(nextDeadline("2026-10-01", "weekly", today)).toBe("2026-11-12");
    expect(nextDeadline("2026-09-15", "monthly", today)).toBe("2026-11-15");
    expect(nextDeadline("2026-11-01", "daily", today)).toBe(today);
  });

  it("repeats from today without a deadline", () => {
    expect(nextDeadline("", "daily", today)).toBe("2026-11-07");
  });
});
