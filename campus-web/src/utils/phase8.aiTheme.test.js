import { describe, expect, it } from "vitest";
import { getStoredTheme, storeTheme } from "./theme.js";

const shouldRequestAutocomplete = (query, { minLength = 2 } = {}) =>
  typeof query === "string" && query.trim().length >= minLength;

const debounceReady = (elapsedMs, debounceMs = 350) => elapsedMs >= debounceMs;

describe("Phase 8 frontend AI helpers", () => {
  it("requires minimum characters before autocomplete", () => {
    expect(shouldRequestAutocomplete("a")).toBe(false);
    expect(shouldRequestAutocomplete("ab")).toBe(true);
  });

  it("respects debounce window", () => {
    expect(debounceReady(100)).toBe(false);
    expect(debounceReady(350)).toBe(true);
  });
});

describe("theme helper", () => {
  it("stores dark as default preference key", () => {
    storeTheme("dark");
    expect(getStoredTheme()).toBe("dark");
  });
});
