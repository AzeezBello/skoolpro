import { describe, expect, it } from "vitest";
import { getLetterGrade } from "@/lib/grading";

describe("getLetterGrade", () => {
  it("maps boundaries to WAEC-style letters", () => {
    expect(getLetterGrade(100)).toBe("A");
    expect(getLetterGrade(70)).toBe("A");
    expect(getLetterGrade(69.9)).toBe("B");
    expect(getLetterGrade(60)).toBe("B");
    expect(getLetterGrade(50)).toBe("C");
    expect(getLetterGrade(45)).toBe("D");
    expect(getLetterGrade(40)).toBe("E");
    expect(getLetterGrade(39.9)).toBe("F");
    expect(getLetterGrade(0)).toBe("F");
  });
});
