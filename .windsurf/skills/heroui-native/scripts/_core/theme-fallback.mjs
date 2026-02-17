export const FALLBACK_THEME = {
  theme: "default",
  latestVersion: "beta",
  source: "fallback",
  light: {
    colors: [
      { category: "base", name: "background", value: "hsl(0, 0%, 100%)" },
      { category: "semantic", name: "foreground", value: "hsl(285.89, 5.9%, 21.03%)" },
      { category: "semantic", name: "accent", value: "hsl(253.83, 100%, 62.04%)" },
      { category: "status", name: "danger", value: "hsl(25.74, 100%, 65.32%)" },
      { category: "status", name: "success", value: "hsl(150.81, 100%, 73.29%)" },
      { category: "status", name: "warning", value: "hsl(72.33, 100%, 78.19%)" },
    ],
  },
  dark: {
    colors: [
      { category: "base", name: "background", value: "hsl(0, 0%, 14.5%)" },
      { category: "semantic", name: "foreground", value: "hsl(0, 0%, 98.4%)" },
      { category: "semantic", name: "accent", value: "hsl(264.1, 100%, 55.1%)" },
      { category: "status", name: "danger", value: "hsl(25.3, 100%, 63.7%)" },
      { category: "status", name: "success", value: "hsl(163.2, 100%, 76.5%)" },
      { category: "status", name: "warning", value: "hsl(86, 100%, 79.5%)" },
    ],
  },
  borderRadius: {
    full: 9999,
    lg: 12,
    md: 8,
    sm: 6,
  },
  opacity: {
    disabled: 0.4,
    hover: 0.8,
    pressed: 0.6,
  },
};
