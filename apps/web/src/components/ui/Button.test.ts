import { describe, expect, it } from "vitest";

import { buttonVariants } from "./Button";

describe("buttonVariants", () => {
  it("replaces the transparent border with the outline border", () => {
    const classes: string[] = buttonVariants({ variant: "outline" }).split(" ");
    expect(classes).toContain("border-line-strong");
    expect(classes).not.toContain("border-transparent");
  });

  it("keeps the transparent border of variants without one", () => {
    expect(buttonVariants().split(" ")).toContain("border-transparent");
  });
});
