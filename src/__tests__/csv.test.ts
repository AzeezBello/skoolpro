import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/client/csv";

describe("parseCsv", () => {
  it("parses headers, quoted commas and CRLF", () => {
    const rows = parseCsv('full_name,class_name\r\n"Okafor, Ada",JSS1A\r\nTunde,"JSS ""2"" B"\r\n');
    expect(rows).toEqual([
      { full_name: "Okafor, Ada", class_name: "JSS1A" },
      { full_name: "Tunde", class_name: 'JSS "2" B' },
    ]);
  });

  it("returns empty for header-only input", () => {
    expect(parseCsv("a,b\n")).toEqual([]);
  });
});
