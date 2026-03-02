import {
  validateHeaderKey,
  validateHeaderValue,
  validateHeaderRecord,
  isProtectedKeyword,
  inferValueType,
  PROTECTED_KEYWORDS,
} from "../headerValidator";

describe("validateHeaderKey", () => {
  it("accepts valid keys", () => {
    expect(validateHeaderKey("SIMPLE")).toBeNull();
    expect(validateHeaderKey("NAXIS1")).toBeNull();
    expect(validateHeaderKey("CD1_1")).toBeNull();
    expect(validateHeaderKey("CCD-TEMP")).toBeNull();
    expect(validateHeaderKey("A")).toBeNull();
  });

  it("rejects empty key", () => {
    expect(validateHeaderKey("")).not.toBeNull();
    expect(validateHeaderKey("")!.field).toBe("key");
  });

  it("rejects key longer than 8 characters", () => {
    expect(validateHeaderKey("LONGKEYNAME")).not.toBeNull();
  });

  it("rejects lowercase characters", () => {
    expect(validateHeaderKey("simple")).not.toBeNull();
  });

  it("rejects spaces in key", () => {
    expect(validateHeaderKey("NA XIS")).not.toBeNull();
  });

  it("rejects special characters", () => {
    expect(validateHeaderKey("KEY!")).not.toBeNull();
    expect(validateHeaderKey("KEY.1")).not.toBeNull();
  });
});

describe("validateHeaderValue", () => {
  it("accepts valid string values", () => {
    expect(validateHeaderValue("M42")).toBeNull();
    expect(validateHeaderValue("")).toBeNull();
  });

  it("accepts valid number values", () => {
    expect(validateHeaderValue(42)).toBeNull();
    expect(validateHeaderValue(3.14)).toBeNull();
    expect(validateHeaderValue(-10)).toBeNull();
    expect(validateHeaderValue(0)).toBeNull();
  });

  it("accepts valid boolean values", () => {
    expect(validateHeaderValue(true)).toBeNull();
    expect(validateHeaderValue(false)).toBeNull();
  });

  it("rejects null value", () => {
    expect(validateHeaderValue(null)).not.toBeNull();
    expect(validateHeaderValue(null)!.field).toBe("value");
  });

  it("rejects string longer than 68 characters", () => {
    const longStr = "a".repeat(69);
    expect(validateHeaderValue(longStr)).not.toBeNull();
  });

  it("accepts string of exactly 68 characters", () => {
    const str68 = "a".repeat(68);
    expect(validateHeaderValue(str68)).toBeNull();
  });

  it("rejects Infinity", () => {
    expect(validateHeaderValue(Infinity)).not.toBeNull();
    expect(validateHeaderValue(-Infinity)).not.toBeNull();
  });

  it("rejects NaN", () => {
    expect(validateHeaderValue(NaN)).not.toBeNull();
  });
});

describe("validateHeaderRecord", () => {
  it("returns empty for valid record", () => {
    expect(validateHeaderRecord({ key: "BITPIX", value: 16 })).toEqual([]);
  });

  it("returns empty for record with comment", () => {
    expect(validateHeaderRecord({ key: "OBJECT", value: "M42", comment: "target" })).toEqual([]);
  });

  it("returns key error for invalid key", () => {
    const errors = validateHeaderRecord({ key: "", value: 1 });
    expect(errors.some((e) => e.field === "key")).toBe(true);
  });

  it("returns value error for null value", () => {
    const errors = validateHeaderRecord({ key: "TEST", value: null });
    expect(errors.some((e) => e.field === "value")).toBe(true);
  });

  it("returns multiple errors for both invalid key and value", () => {
    const errors = validateHeaderRecord({ key: "", value: null });
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe("isProtectedKeyword", () => {
  it("returns true for protected keywords", () => {
    expect(isProtectedKeyword("SIMPLE")).toBe(true);
    expect(isProtectedKeyword("BITPIX")).toBe(true);
    expect(isProtectedKeyword("NAXIS")).toBe(true);
    expect(isProtectedKeyword("NAXIS1")).toBe(true);
    expect(isProtectedKeyword("NAXIS2")).toBe(true);
    expect(isProtectedKeyword("NAXIS3")).toBe(true);
    expect(isProtectedKeyword("END")).toBe(true);
  });

  it("returns false for non-protected keywords", () => {
    expect(isProtectedKeyword("OBJECT")).toBe(false);
    expect(isProtectedKeyword("FILTER")).toBe(false);
    expect(isProtectedKeyword("EXPTIME")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isProtectedKeyword("simple")).toBe(true);
    expect(isProtectedKeyword("Bitpix")).toBe(true);
  });

  it("trims whitespace", () => {
    expect(isProtectedKeyword("  SIMPLE  ")).toBe(true);
  });

  it("has expected count of protected keywords", () => {
    expect(PROTECTED_KEYWORDS.size).toBe(7);
  });
});

describe("inferValueType", () => {
  it("infers boolean true", () => {
    expect(inferValueType("true")).toEqual({ value: true, type: "boolean" });
    expect(inferValueType("T")).toEqual({ value: true, type: "boolean" });
  });

  it("infers boolean false", () => {
    expect(inferValueType("false")).toEqual({ value: false, type: "boolean" });
    expect(inferValueType("F")).toEqual({ value: false, type: "boolean" });
  });

  it("infers integer numbers", () => {
    expect(inferValueType("42")).toEqual({ value: 42, type: "number" });
    expect(inferValueType("-10")).toEqual({ value: -10, type: "number" });
    expect(inferValueType("0")).toEqual({ value: 0, type: "number" });
  });

  it("infers float numbers", () => {
    expect(inferValueType("3.14")).toEqual({ value: 3.14, type: "number" });
    expect(inferValueType("1e-5")).toEqual({ value: 1e-5, type: "number" });
  });

  it("infers string for non-numeric text", () => {
    expect(inferValueType("M42")).toEqual({ value: "M42", type: "string" });
    expect(inferValueType("RA---TAN")).toEqual({ value: "RA---TAN", type: "string" });
  });

  it("infers string for empty input", () => {
    expect(inferValueType("")).toEqual({ value: "", type: "string" });
  });

  it("trims whitespace", () => {
    expect(inferValueType("  42  ")).toEqual({ value: 42, type: "number" });
    expect(inferValueType("  true  ")).toEqual({ value: true, type: "boolean" });
    expect(inferValueType("  M42  ")).toEqual({ value: "M42", type: "string" });
  });
});
