export const LANDSCAPE_PHONE_MIN = 640;
export const TABLET_MIN = 900;

export type LayoutMode = "portrait" | "landscape-phone" | "landscape-tablet";

export function getLayoutMode(width: number, height: number): LayoutMode {
  if (width <= height) {
    return "portrait";
  }

  if (width >= TABLET_MIN) {
    return "landscape-tablet";
  }

  if (width >= LANDSCAPE_PHONE_MIN) {
    return "landscape-phone";
  }

  return "portrait";
}
