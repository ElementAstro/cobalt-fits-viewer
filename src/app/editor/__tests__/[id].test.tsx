import Screen from "../[id]";

describe("editor/[id].tsx route", () => {
  it("exports a screen component", () => {
    expect(Screen).toBeTruthy();
  });

  it("exports a default function component", () => {
    expect(typeof Screen).toBe("function");
  });
});
