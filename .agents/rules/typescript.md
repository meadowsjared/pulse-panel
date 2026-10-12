# TypeScript Guidelines

- **Never use the `as` keyword**: Under no circumstances should type assertions (`value as Type`, `as const`, etc.) be used. Write proper TypeScript with accurate types, control flow narrowing, generics, and type guards instead of assertions.
