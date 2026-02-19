import { useConverterStore } from "../useConverterStore";
import {
  DEFAULT_CONVERT_PRESETS,
  DEFAULT_FITS_TARGET_OPTIONS,
  DEFAULT_TIFF_TARGET_OPTIONS,
  type BatchTask,
  type ConvertPreset,
} from "../../lib/fits/types";

const makeTask = (overrides: Partial<BatchTask> = {}): BatchTask => ({
  id: `task-${Math.random().toString(36).slice(2, 8)}`,
  type: "convert",
  status: "pending",
  progress: 0,
  total: 10,
  completed: 0,
  failed: 0,
  createdAt: Date.now(),
  ...overrides,
});

const makePreset = (id: string): ConvertPreset => ({
  id,
  name: `Preset ${id}`,
  description: "custom preset",
  options: {
    format: "webp",
    quality: 77,
    bitDepth: 16,
    dpi: 150,
    tiff: DEFAULT_TIFF_TARGET_OPTIONS,
    fits: DEFAULT_FITS_TARGET_OPTIONS,
    stretch: "linear",
    colormap: "heat",
    blackPoint: 0.1,
    whitePoint: 0.9,
    gamma: 1.2,
    outputBlack: 0.02,
    outputWhite: 0.95,
    includeAnnotations: true,
    includeWatermark: true,
  },
});

describe("useConverterStore", () => {
  beforeEach(() => {
    useConverterStore.setState({
      currentOptions: {
        format: "png",
        quality: 90,
        bitDepth: 8,
        dpi: 72,
        tiff: DEFAULT_TIFF_TARGET_OPTIONS,
        fits: DEFAULT_FITS_TARGET_OPTIONS,
        stretch: "asinh",
        colormap: "grayscale",
        blackPoint: 0,
        whitePoint: 1,
        gamma: 1,
        outputBlack: 0,
        outputWhite: 1,
        includeAnnotations: false,
        includeWatermark: false,
      },
      presets: [],
      batchTasks: [],
    });
  });

  it("starts with default options", () => {
    const state = useConverterStore.getState();
    expect(state.currentOptions.format).toBe("png");
    expect(state.currentOptions.quality).toBe(90);
    expect(state.currentOptions.bitDepth).toBe(8);
    expect(state.currentOptions.dpi).toBe(72);
  });

  it("updates options via single setters and setOptions", () => {
    const store = useConverterStore.getState();
    store.setFormat("jpeg");
    store.setQuality(55);
    store.setBitDepth(16);
    store.setDpi(300);
    store.setOptions({
      colormap: "viridis",
      includeAnnotations: true,
      gamma: 1.8,
    });

    const options = useConverterStore.getState().currentOptions;
    expect(options.format).toBe("jpeg");
    expect(options.quality).toBe(55);
    expect(options.bitDepth).toBe(16);
    expect(options.dpi).toBe(300);
    expect(options.colormap).toBe("viridis");
    expect(options.includeAnnotations).toBe(true);
    expect(options.gamma).toBe(1.8);
  });

  it("applyPreset applies built-in preset when id exists", () => {
    useConverterStore.getState().setFormat("bmp");
    const builtIn = DEFAULT_CONVERT_PRESETS[0];
    useConverterStore.getState().applyPreset(builtIn.id);

    expect(useConverterStore.getState().currentOptions).toEqual(builtIn.options);
  });

  it("applyPreset applies custom preset and ignores missing id", () => {
    const custom = makePreset("custom-1");
    useConverterStore.getState().addPreset(custom);
    useConverterStore.getState().applyPreset("custom-1");
    expect(useConverterStore.getState().currentOptions).toEqual(custom.options);

    const before = useConverterStore.getState().currentOptions;
    useConverterStore.getState().applyPreset("not-found");
    expect(useConverterStore.getState().currentOptions).toEqual(before);
  });

  it("adds and removes custom presets", () => {
    const p1 = makePreset("p1");
    const p2 = makePreset("p2");
    useConverterStore.getState().addPreset(p1);
    useConverterStore.getState().addPreset(p2);
    expect(useConverterStore.getState().presets.map((p) => p.id)).toEqual(["p1", "p2"]);

    useConverterStore.getState().removePreset("p1");
    expect(useConverterStore.getState().presets.map((p) => p.id)).toEqual(["p2"]);
  });

  it("manages batch tasks and clears completed/failed tasks", () => {
    const t1 = makeTask({ id: "t1", status: "pending" });
    const t2 = makeTask({ id: "t2", status: "running" });
    const t3 = makeTask({ id: "t3", status: "completed" });
    const t4 = makeTask({ id: "t4", status: "failed" });
    const t5 = makeTask({ id: "t5", status: "cancelled" });

    const store = useConverterStore.getState();
    store.addBatchTask(t1);
    store.addBatchTask(t2);
    store.addBatchTask(t3);
    store.addBatchTask(t4);
    store.addBatchTask(t5);

    store.updateBatchTask("t2", { progress: 60, completed: 6 });
    expect(useConverterStore.getState().batchTasks.find((t) => t.id === "t2")?.progress).toBe(60);

    store.removeBatchTask("t1");
    expect(useConverterStore.getState().batchTasks.some((t) => t.id === "t1")).toBe(false);

    store.clearCompletedTasks();
    expect(useConverterStore.getState().batchTasks.map((t) => t.id)).toEqual(["t2", "t5"]);
  });
});
