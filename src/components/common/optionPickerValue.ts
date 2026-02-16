export function coerceOptionValue<T extends string | number>(
  options: { label: string; value: T }[],
  rawValue: string,
): T {
  const matched = options.find((opt) => String(opt.value) === rawValue);
  if (matched) return matched.value;
  return rawValue as T;
}
