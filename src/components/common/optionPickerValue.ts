export function coerceOptionValue<T extends string | number>(
  options: { label: string; value: T }[],
  rawValue: string,
): T {
  const matched = options.find((opt) => String(opt.value) === rawValue);
  if (matched) return matched.value;
  const hasNumericOptions = options.some((opt) => typeof opt.value === "number");
  if (hasNumericOptions) {
    const parsed = Number(rawValue);
    if (!Number.isNaN(parsed)) return parsed as T;
  }
  return rawValue as T;
}
