import { renderHook } from "@testing-library/react-native";
import { useChipInput } from "../useChipInput";

describe("useChipInput", () => {
  it("addItem appends trimmed value to list and clears input", () => {
    const { result } = renderHook(() => useChipInput());
    const setter = jest.fn();
    const inputSetter = jest.fn();

    result.current.addItem("  Ha  ", ["OIII"], setter, inputSetter);

    expect(setter).toHaveBeenCalledWith(["OIII", "Ha"]);
    expect(inputSetter).toHaveBeenCalledWith("");
  });

  it("addItem skips duplicate values", () => {
    const { result } = renderHook(() => useChipInput());
    const setter = jest.fn();
    const inputSetter = jest.fn();

    result.current.addItem("Ha", ["Ha", "OIII"], setter, inputSetter);

    expect(setter).not.toHaveBeenCalled();
    expect(inputSetter).toHaveBeenCalledWith("");
  });

  it("addItem skips empty/whitespace values", () => {
    const { result } = renderHook(() => useChipInput());
    const setter = jest.fn();
    const inputSetter = jest.fn();

    result.current.addItem("   ", ["Ha"], setter, inputSetter);

    expect(setter).not.toHaveBeenCalled();
    expect(inputSetter).toHaveBeenCalledWith("");
  });

  it("removeItem filters out the specified value", () => {
    const { result } = renderHook(() => useChipInput());
    const setter = jest.fn();

    result.current.removeItem("Ha", ["Ha", "OIII", "SII"], setter);

    expect(setter).toHaveBeenCalledWith(["OIII", "SII"]);
  });

  it("removeItem handles value not in list gracefully", () => {
    const { result } = renderHook(() => useChipInput());
    const setter = jest.fn();

    result.current.removeItem("Lum", ["Ha", "OIII"], setter);

    expect(setter).toHaveBeenCalledWith(["Ha", "OIII"]);
  });
});
