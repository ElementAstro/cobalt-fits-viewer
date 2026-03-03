/**
 * useBackupSummary hook 测试
 */

import { renderHook } from "@testing-library/react-native";
import { useBackupSummary } from "../useBackupSummary";
import { useFitsStore } from "../../stores/useFitsStore";
import { useAlbumStore } from "../../stores/useAlbumStore";
import { useTargetStore } from "../../stores/useTargetStore";
import { useSessionStore } from "../../stores/useSessionStore";

beforeEach(() => {
  useFitsStore.setState({ files: [] });
  useAlbumStore.setState({ albums: [] });
  useTargetStore.setState({ targets: [] });
  useSessionStore.setState({ sessions: [], plans: [] });
});

describe("useBackupSummary", () => {
  it("returns zeros when stores are empty", () => {
    const { result } = renderHook(() => useBackupSummary());
    expect(result.current).toEqual({
      fileCount: 0,
      albumCount: 0,
      targetCount: 0,
      sessionCount: 0,
      planCount: 0,
      estimatedBytes: 0,
    });
  });

  it("counts files and sums fileSize for estimatedBytes", () => {
    useFitsStore.setState({
      files: [
        { id: "f1", filename: "a.fits", fileSize: 1000 },
        { id: "f2", filename: "b.fits", fileSize: 2000 },
        { id: "f3", filename: "c.fits", fileSize: undefined },
      ] as never[],
    });

    const { result } = renderHook(() => useBackupSummary());
    expect(result.current.fileCount).toBe(3);
    expect(result.current.estimatedBytes).toBe(3000);
  });

  it("counts albums, targets, sessions, and plans", () => {
    useAlbumStore.setState({
      albums: [{ id: "a1" }, { id: "a2" }] as never[],
    });
    useTargetStore.setState({
      targets: [{ id: "t1" }] as never[],
    });
    useSessionStore.setState({
      sessions: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] as never[],
      plans: [{ id: "p1" }] as never[],
    });

    const { result } = renderHook(() => useBackupSummary());
    expect(result.current.albumCount).toBe(2);
    expect(result.current.targetCount).toBe(1);
    expect(result.current.sessionCount).toBe(3);
    expect(result.current.planCount).toBe(1);
  });
});
