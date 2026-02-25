import { coerceOptionValue } from "../optionPickerValue";

describe("coerceOptionValue", () => {
  it("returns number values with correct type", () => {
    const options = [
      { label: "One", value: 1 },
      { label: "Two", value: 2 },
    ];

    expect(coerceOptionValue(options, "2")).toBe(2);
  });

  it("returns string values with correct type", () => {
    const options = [
      { label: "Dark", value: "dark" },
      { label: "Light", value: "light" },
    ];

    expect(coerceOptionValue(options, "light")).toBe("light");
  });

  it("falls back to raw value when option is missing", () => {
    const options = [{ label: "A", value: "a" }];

    expect(coerceOptionValue(options, "not-found")).toBe("not-found");
  });

  it("coerces unmatched numeric fallback correctly", () => {
    const options = [
      { label: "Small", value: 12 },
      { label: "Large", value: 16 },
    ];

    expect(coerceOptionValue(options, "14")).toBe(14);
    expect(typeof coerceOptionValue(options, "14")).toBe("number");
  });

  it("returns NaN for non-parseable string with numeric options", () => {
    const options = [{ label: "A", value: 1 }];

    expect(coerceOptionValue(options, "abc")).toBe("abc");
  });
});
