export function isE2EMode(): boolean {
  return process.env.EXPO_PUBLIC_E2E === "1";
}
