import { act, renderHook } from "@testing-library/react-native";
import { InteractionManager } from "react-native";
import { useImageEditor } from "../useImageEditor";

jest.mock("../../lib/processing/executor", () => ({
  executeProcessingPipeline: jest.fn(),
}));
jest.mock("../../lib/processing/recipe", () => ({
  normalizeProcessingPipelineSnapshot: jest.fn(),
}));
jest.mock("../../lib/processing/registry", () => ({
  getProcessingOperation: jest.fn(),
}));
jest.mock("../../lib/logger", () => ({
  LOG_TAGS: {
    ImageEditor: "ImageEditor",
  },
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const executorLib = jest.requireMock("../../lib/processing/executor") as {
  executeProcessingPipeline: jest.Mock;
};
const recipeLib = jest.requireMock("../../lib/processing/recipe") as {
  normalizeProcessingPipelineSnapshot: jest.Mock;
};
const registryLib = jest.requireMock("../../lib/processing/registry") as {
  getProcessingOperation: jest.Mock;
};
type InteractionTask = Parameters<typeof InteractionManager.runAfterInteractions>[0];

function createInteractionHandle(cancel: jest.Mock = jest.fn()) {
  return {
    then: (onfulfilled?: () => any) =>
      Promise.resolve().then(() => (onfulfilled ? onfulfilled() : undefined)),
    done: (...args: any[]) => (typeof args[0] === "function" ? args[0]() : undefined),
    cancel,
  } as ReturnType<typeof InteractionManager.runAfterInteractions>;
}

function computeSizeFromSnapshot(
  width: number,
  height: number,
  snapshot: {
    scientificNodes: Array<{ operationId: string; params?: Record<string, unknown> }>;
  },
) {
  let w = width;
  let h = height;
  for (const node of snapshot.scientificNodes) {
    if (node.operationId === "rotate90cw" || node.operationId === "rotate90ccw") {
      const nextW = h;
      const nextH = w;
      w = nextW;
      h = nextH;
    } else if (node.operationId === "crop") {
      const cw = Number(node.params?.width);
      const ch = Number(node.params?.height);
      if (Number.isFinite(cw) && Number.isFinite(ch)) {
        w = Math.max(1, Math.trunc(cw));
        h = Math.max(1, Math.trunc(ch));
      }
    }
  }
  return { width: w, height: h };
}

describe("useImageEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(InteractionManager, "runAfterInteractions")
      .mockImplementation((task?: InteractionTask) => {
        if (typeof task === "function") {
          Promise.resolve().then(() => task());
        }
        return createInteractionHandle();
      });

    recipeLib.normalizeProcessingPipelineSnapshot.mockImplementation((snapshot) => ({
      version: 1,
      savedAt: Date.now(),
      profile: "standard",
      scientificNodes: snapshot?.scientificNodes ?? [],
      colorNodes: snapshot?.colorNodes ?? [],
    }));

    executorLib.executeProcessingPipeline.mockImplementation(
      ({ input, snapshot }: { input: { width: number; height: number }; snapshot: any }) => {
        const size = computeSizeFromSnapshot(input.width, input.height, snapshot);
        return {
          scientificOutput: {
            pixels: new Float32Array(size.width * size.height).fill(0.5),
            width: size.width,
            height: size.height,
          },
          colorOutput: {
            rgbaData: new Uint8ClampedArray(size.width * size.height * 4).fill(8),
          },
        };
      },
    );

    registryLib.getProcessingOperation.mockImplementation((id: string) => {
      if (id === "rotate90cw" || id === "rotate90ccw" || id === "crop") {
        return { stage: "scientific" };
      }
      if (id === "saturation") {
        return { stage: "color" };
      }
      return undefined;
    });
  });

  const flushInteractionTasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it("emits apply/undo/redo operation events with reversible history indexes", async () => {
    const onOperation = jest.fn();
    const { result } = renderHook(() => useImageEditor({ onOperation }));

    await act(async () => {
      result.current.initialize(new Float32Array([1, 2, 3, 4, 5, 6]), 2, 3, "linear", "grayscale");
      await flushInteractionTasks();
    });

    expect(result.current.current?.width).toBe(2);
    expect(result.current.current?.height).toBe(3);
    expect(result.current.historyLength).toBe(1);
    expect(result.current.historyIndex).toBe(0);

    await act(async () => {
      result.current.applyEdit({ type: "rotate90cw" });
      await flushInteractionTasks();
    });

    expect(result.current.historyLength).toBe(2);
    expect(result.current.historyIndex).toBe(1);
    expect(result.current.current?.width).toBe(3);
    expect(result.current.current?.height).toBe(2);

    await act(async () => {
      result.current.undo();
      await flushInteractionTasks();
    });
    expect(result.current.historyIndex).toBe(0);
    expect(result.current.current?.width).toBe(2);
    expect(result.current.current?.height).toBe(3);

    await act(async () => {
      result.current.redo();
      await flushInteractionTasks();
    });
    expect(result.current.historyIndex).toBe(1);
    expect(result.current.current?.width).toBe(3);
    expect(result.current.current?.height).toBe(2);

    expect(onOperation).toHaveBeenCalledTimes(3);
    expect(onOperation.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        type: "apply",
        op: { type: "rotate90cw" },
        previousHistoryIndex: 0,
        historyIndex: 1,
        previousHistoryLength: 1,
        historyLength: 2,
        before: { width: 2, height: 3 },
        after: { width: 3, height: 2 },
      }),
    );
    expect(onOperation.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        type: "undo",
        previousHistoryIndex: 1,
        historyIndex: 0,
        previousHistoryLength: 2,
        historyLength: 2,
        before: { width: 3, height: 2 },
        after: { width: 2, height: 3 },
      }),
    );
    expect(onOperation.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        type: "redo",
        previousHistoryIndex: 0,
        historyIndex: 1,
        previousHistoryLength: 2,
        historyLength: 2,
        before: { width: 2, height: 3 },
        after: { width: 3, height: 2 },
      }),
    );
  });

  it("caps history length at maxHistory", async () => {
    const { result } = renderHook(() => useImageEditor({ maxHistory: 3 }));

    await act(async () => {
      result.current.initialize(new Float32Array([1, 2, 3, 4]), 2, 2);
      await flushInteractionTasks();
    });
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        result.current.applyEdit({ type: "rotate90cw" });
        await flushInteractionTasks();
      });
    }

    expect(result.current.historyLength).toBe(3);
    expect(result.current.historyIndex).toBe(2);
  });

  it("reports unsupported operation id as error", async () => {
    const { result } = renderHook(() => useImageEditor());

    await act(async () => {
      result.current.initialize(new Float32Array([1, 2, 3, 4]), 2, 2);
      await flushInteractionTasks();
    });
    await act(async () => {
      result.current.applyEdit({ type: "unknown-op" } as any);
      await flushInteractionTasks();
    });

    expect(result.current.error).toBe("Unsupported operation: unknown-op");
  });

  it("routes color operations into colorNodes", async () => {
    const onRecipeChange = jest.fn();
    const { result } = renderHook(() => useImageEditor({ onRecipeChange }));

    await act(async () => {
      result.current.initialize(new Float32Array([1, 2, 3, 4]), 2, 2);
      await flushInteractionTasks();
    });
    await act(async () => {
      result.current.applyEdit({ type: "saturation", amount: 0.25 });
      await flushInteractionTasks();
    });

    expect(result.current.recipe?.scientificNodes.length).toBe(0);
    expect(result.current.recipe?.colorNodes.length).toBe(1);
    expect(result.current.recipe?.colorNodes[0]?.operationId).toBe("saturation");
    expect(onRecipeChange).toHaveBeenCalled();
  });
});
