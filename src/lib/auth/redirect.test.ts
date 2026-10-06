import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/skills/abc?x=1")).toBe("/skills/abc?x=1");
    expect(safeNext("/")).toBe("/");
  });
  it.each(["//evil.com", "/\\evil.com", "/\\/evil.com", "/\t/evil.com", "https://evil.com", "evil.com", "", null, 42])(
    "rejects %s",
    (v) => expect(safeNext(v)).toBe("/"),
  );
});
