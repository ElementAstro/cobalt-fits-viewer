import { renderHook } from "@testing-library/react-native";
import { useAutoSolve } from "../useAutoSolve";

jest.mock("../useAstrometry", () => ({
  useAstrometry: jest.fn(),
}));

jest.mock("../../stores/useAstrometryStore", () => ({
  useAstrometryStore: jest.fn(),
}));

jest.mock("../../stores/useFitsStore", () => ({
  useFitsStore: jest.fn(),
}));

jest.mock("../../lib/logger", () => {
  const actual = jest.requireActual("../../lib/logger") as typeof import("../../lib/logger");
  return {
    ...actual,
    Logger: {
      ...actual.Logger,
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
});

const { useAstrometry } = jest.requireMock("../useAstrometry") as {
  useAstrometry: jest.Mock;
};
const { useAstrometryStore } = jest.requireMock("../../stores/useAstrometryStore") as {
  useAstrometryStore: jest.Mock;
};
const { useFitsStore } = jest.requireMock("../../stores/useFitsStore") as {
  useFitsStore: jest.Mock;
};
const loggerLib = jest.requireMock("../../lib/logger") as {
  Logger: { info: jest.Mock };
};

describe("useAutoSolve", () => {
  const submitFile = jest.fn();

  let filesState: Array<{ id: string }>;
  let astrometryState: { config: { autoSolve: boolean; apiKey: string } };

  beforeEach(() => {
    jest.clearAllMocks();
    filesState = [{ id: "f1" }];
    astrometryState = { config: { autoSolve: true, apiKey: "k" } };
    useAstrometry.mockReturnValue({ submitFile });
    useAstrometryStore.mockImplementation((selector: (s: typeof astrometryState) => unknown) =>
      selector(astrometryState),
    );
    useFitsStore.mockImplementation((selector: (s: { files: typeof filesState }) => unknown) =>
      selector({ files: filesState }),
    );
  });

  it("does nothing when autoSolve disabled or apiKey missing", () => {
    astrometryState = { config: { autoSolve: false, apiKey: "k" } };
    const { rerender } = renderHook(() => useAutoSolve());
    expect(submitFile).not.toHaveBeenCalled();

    astrometryState = { config: { autoSolve: true, apiKey: "" } };
    rerender({});
    expect(submitFile).not.toHaveBeenCalled();
  });

  it("submits only newly imported files", () => {
    const { rerender } = renderHook(() => useAutoSolve());
    expect(submitFile).not.toHaveBeenCalled();

    filesState = [{ id: "f1" }, { id: "f2" }, { id: "f3" }];
    rerender({});

    expect(submitFile).toHaveBeenCalledTimes(2);
    expect(submitFile).toHaveBeenCalledWith("f2");
    expect(submitFile).toHaveBeenCalledWith("f3");
    expect(loggerLib.Logger.info).toHaveBeenCalled();
  });

  it("does not resubmit existing ids on rerender", () => {
    const { rerender } = renderHook(() => useAutoSolve());

    filesState = [{ id: "f1" }, { id: "f2" }];
    rerender({});
    expect(submitFile).toHaveBeenCalledTimes(1);

    rerender({});
    expect(submitFile).toHaveBeenCalledTimes(1);
  });
});
