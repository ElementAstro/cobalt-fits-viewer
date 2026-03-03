import { useCallback } from "react";

export function normalizeChipValues(items: string[], pendingInput: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of [...items, pendingInput]) {
    const trimmed = v.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

export function useChipInput() {
  const addItem = useCallback(
    (
      value: string,
      list: string[],
      setter: (next: string[]) => void,
      inputSetter: (next: string) => void,
    ) => {
      const trimmed = value.trim();
      if (trimmed && !list.includes(trimmed)) {
        setter([...list, trimmed]);
      }
      inputSetter("");
    },
    [],
  );

  const removeItem = useCallback(
    (value: string, list: string[], setter: (next: string[]) => void) => {
      setter(list.filter((item) => item !== value));
    },
    [],
  );

  return { addItem, removeItem };
}
