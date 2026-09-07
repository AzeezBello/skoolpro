import { describe, expect, it } from "vitest";
import { normalizeRequestedAmount } from "@/lib/server/payments";

describe("normalizeRequestedAmount", () => {
  it("respects explicit units", () => {
    expect(normalizeRequestedAmount(500000, 5000, "kobo")).toBe(5000);
    expect(normalizeRequestedAmount(5000, 5000, "naira")).toBe(5000);
  });
  it("guesses kobo when the value is implausibly large for the balance", () => {
    expect(normalizeRequestedAmount(500000, 5000)).toBe(5000);
    expect(normalizeRequestedAmount(4000, 5000)).toBe(4000);
  });
  it("rejects invalid input", () => {
    expect(normalizeRequestedAmount("abc", 5000)).toBeNull();
    expect(normalizeRequestedAmount(-1, 5000)).toBeNull();
  });
});
