function split(value: string): string[] {
  return value.replaceAll("\\", "/").split("/").filter(Boolean);
}

function normalize(value: string): string {
  const parts = split(value);
  const stack: string[] = [];

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }

  return stack.join("/");
}

export function join(...parts: string[]): string {
  return normalize(parts.join("/"));
}

export function dirname(input: string): string {
  const normalized = normalize(input);
  const parts = split(normalized);
  if (parts.length <= 1) return ".";
  return parts.slice(0, -1).join("/");
}

export function relative(from: string, to: string): string {
  const fromParts = split(normalize(from));
  const toParts = split(normalize(to));

  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }

  const up = new Array(fromParts.length - common).fill("..");
  const down = toParts.slice(common);
  const merged = [...up, ...down];
  return merged.length > 0 ? merged.join("/") : ".";
}

const pathShim = {
  join,
  dirname,
  relative,
};

export default pathShim;
