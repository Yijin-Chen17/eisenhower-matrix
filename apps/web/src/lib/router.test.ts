import { describe, expect, it } from "vitest";
import { routeFromHash } from "./router";

describe("routeFromHash", () => {
  it("treats the empty hash as the board", () => {
    expect(routeFromHash("")).toBe("board");
    expect(routeFromHash("#")).toBe("board");
    expect(routeFromHash("#/")).toBe("board");
  });

  it("resolves the feature guide route", () => {
    expect(routeFromHash("#/guide")).toBe("guide");
    expect(routeFromHash("#/guide/")).toBe("board");
  });

  it("falls back to the board for unknown paths", () => {
    expect(routeFromHash("#/nope")).toBe("board");
    expect(routeFromHash("#settings")).toBe("board");
  });
});
