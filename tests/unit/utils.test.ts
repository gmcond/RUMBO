import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("combina clases y resuelve conflictos de tailwind", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("descarta valores falsy", () => {
    expect(cn("text-sm", false && "hidden", undefined)).toBe("text-sm");
  });
});
