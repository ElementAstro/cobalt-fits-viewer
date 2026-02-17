export function toKebabCase(name) {
  return String(name)
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function normalizeDocPath(path) {
  const value = String(path ?? "").trim();
  if (!value) {
    return "";
  }

  const clean = value.startsWith("/") ? value.slice(1) : value;
  return clean.endsWith(".mdx") ? clean : `${clean}.mdx`;
}

export function normalizeApiDocPath(path) {
  const value = String(path ?? "").trim();
  const noLeadingSlash = value.startsWith("/") ? value.slice(1) : value;
  if (noLeadingSlash.startsWith("docs/")) {
    return noLeadingSlash.slice("docs/".length);
  }
  return noLeadingSlash;
}

export function normalizeComponentItems(components = []) {
  const names = [...new Set(components.filter(Boolean).map((name) => String(name).trim()))];
  const sorted = names.sort((a, b) => a.localeCompare(b));
  return sorted.map((name) => ({
    id: toKebabCase(name),
    name,
    slug: toKebabCase(name),
  }));
}

export function parseComponentsFromLlmsTxt(content) {
  const components = [];
  let inComponentsSection = false;

  for (const line of String(content).split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "### Components") {
      inComponentsSection = true;
      continue;
    }
    if (inComponentsSection && trimmed.startsWith("### ")) {
      break;
    }
    if (!inComponentsSection) {
      continue;
    }

    const match = trimmed.match(
      /^-\s*\[([^\]]+)\]\(https:\/\/v3\.heroui\.com\/docs\/native\/components\/[a-z]/,
    );
    if (match) {
      components.push(match[1]);
    }
  }

  return components;
}

export function normalizeThemePayload(raw) {
  const payload = raw ?? {};
  const light = payload.light?.colors ?? [];
  const dark = payload.dark?.colors ?? [];
  const normalizeTokenName = (tokenName) => {
    const clean = String(tokenName ?? "").trim();
    if (!clean) {
      return "--color-unknown";
    }
    if (clean.startsWith("--")) {
      return clean;
    }
    return `--color-${clean}`;
  };

  const normalizeColors = (colors) =>
    colors.map((token) => ({
      category: token.category ?? "semantic",
      name: normalizeTokenName(token.name),
      value: token.value ?? "",
    }));

  return {
    theme: payload.theme ?? "default",
    latestVersion: payload.latestVersion ?? "unknown",
    light: { colors: normalizeColors(light) },
    dark: { colors: normalizeColors(dark) },
    borderRadius: payload.borderRadius ?? {},
    opacity: payload.opacity ?? {},
    source: payload.source ?? "api",
  };
}
