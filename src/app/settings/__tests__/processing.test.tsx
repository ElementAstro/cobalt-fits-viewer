import Screen from "../processing";
import {
  ProcessingEditorSection,
  ProcessingStackingSection,
  ProcessingExportSection,
  ProcessingComposeSection,
  ProcessingVideoSection,
  ProcessingPerformanceSection,
  ProcessingFrameClassSection,
} from "../../../components/settings/processing";

describe("settings/processing.tsx route", () => {
  it("exports a screen component", () => {
    expect(Screen).toBeTruthy();
  });

  it("exports all processing sub-components", () => {
    expect(ProcessingEditorSection).toBeTruthy();
    expect(ProcessingStackingSection).toBeTruthy();
    expect(ProcessingExportSection).toBeTruthy();
    expect(ProcessingComposeSection).toBeTruthy();
    expect(ProcessingVideoSection).toBeTruthy();
    expect(ProcessingPerformanceSection).toBeTruthy();
    expect(ProcessingFrameClassSection).toBeTruthy();
  });
});
