import {
  REQUIRED_PROCESSING_OPERATION_IDS,
  assertProcessingRegistryCoverage,
  getProcessingOperation,
  listProcessingOperations,
} from "../registry";

describe("processing registry", () => {
  it("covers all declared operation ids", () => {
    expect(() => assertProcessingRegistryCoverage()).not.toThrow();
    for (const id of REQUIRED_PROCESSING_OPERATION_IDS) {
      expect(getProcessingOperation(id)).toBeDefined();
    }
  });

  it("splits scientific and color operations by stage", () => {
    const scientific = listProcessingOperations("scientific");
    const color = listProcessingOperations("color");

    expect(scientific.length).toBeGreaterThan(0);
    expect(color.length).toBeGreaterThan(0);
    expect(scientific.every((item) => item.stage === "scientific")).toBe(true);
    expect(color.every((item) => item.stage === "color")).toBe(true);
  });
});
