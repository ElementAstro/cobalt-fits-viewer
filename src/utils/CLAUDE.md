[Root](../../CLAUDE.md) > [src](..) > **utils**

# Utils Module (Utilities)

> Common utility functions

## Module Responsibility

This module provides reusable utility functions for the application.

## Entry & Startup

| File    | Purpose                         |
| ------- | ------------------------------- |
| `cn.ts` | className concatenation utility |

## Public Interfaces

### `cn(...classes)` - ClassName Helper

Concatenates class names, filtering out falsy values.

```typescript
import { cn } from "../utils/cn";

// Basic usage
cn("flex-1", "items-center"); // -> "flex-1 items-center"

// Conditional classes
cn("base-class", condition && "conditional-class");
cn("a", null, "b", undefined, "c"); // -> "a b c"

// With Tailwind merge (can be extended)
cn("px-2", "px-4"); // -> "px-2 px-4" (consider using tailwind-merge for dedup)
```

**Type Signature:**

```typescript
function cn(...classes: (string | undefined | null | false)[]): string;
```

## Key Dependencies

None - pure TypeScript utility.

## Related Files

```
src/utils/
`-- cn.ts    # ClassName utility
```

## Recommendations

Consider enhancing `cn` with `tailwind-merge` for class deduplication:

```typescript
import { twMerge } from "tailwind-merge";

export function cn(...classes: (string | undefined | null | false)[]): string {
  return twMerge(classes.filter(Boolean).join(" "));
}

// Then: cn("px-2", "px-4") -> "px-4" (merged)
```

## Changelog

| Date       | Changes                          |
| ---------- | -------------------------------- |
| 2026-02-14 | AI context documentation created |
