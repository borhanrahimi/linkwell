import { expect, test } from "vitest";
import { windowStart } from "@/lib/limits";

test("every moment in the same minute shares one window", () => {
  const start = windowStart(new Date("2026-10-20T12:34:00.000Z"), 60);

  expect(windowStart(new Date("2026-10-20T12:34:59.999Z"), 60)).toEqual(start);
  expect(windowStart(new Date("2026-10-20T12:35:00.000Z"), 60)).not.toEqual(start);
});

test("hour windows start on the hour", () => {
  expect(windowStart(new Date("2026-10-20T12:34:56.000Z"), 3600).toISOString()).toBe("2026-10-20T12:00:00.000Z");
});
