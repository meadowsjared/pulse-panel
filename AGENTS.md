# Repository Rules & Guidelines

## TypeScript Guidelines

- **Never use the `as` keyword**: Do not use TypeScript type assertions (`value as Type`, `as const`, `as any`, etc.). Model types accurately using proper type annotations, type guards, discriminated unions, generic type parameters, and type narrowing instead of casting with `as`.
