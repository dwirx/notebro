# Repository Guidelines

## Project Structure & Module Organization

Quicknote is a Bun-powered React notes app. Source code lives in `src/`: `App.tsx` contains the main shell, `frontend.tsx` mounts React, and `index.ts` starts the Bun server. Shared logic belongs in `src/lib/`, Zustand state and IndexedDB persistence in `src/store/`, and worker-related code in `src/workers/`. Reusable UI primitives are under `src/components/ui/`. Global styling is split between `src/index.css` and `styles/globals.css`. Tests are colocated with the code they cover, for example `src/lib/noteLogic.test.ts`. Production output is generated in `dist/` and should not be edited by hand.

## Build, Test, and Development Commands

- `bun install`: install dependencies from `bun.lock`.
- `bun dev`: start the hot-reloading development server, typically at `http://localhost:3000/`.
- `bun run build`: run `build.ts` and emit the production bundle.
- `bun test`: run the Vitest suite once.
- `bunx tsc --noEmit`: run TypeScript checks without writing files.
- `bun start`: run the app with `NODE_ENV=production`.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Keep strict TypeScript compatibility; `tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, and related safety checks. Prefer named exports for shared utilities, colocate narrow helpers near their caller, and use the `@/*` path alias for imports from `src/`. Follow the existing two-space indentation, double quotes, and semicolon style. Name components in `PascalCase`, hooks with `use` prefixes, types/interfaces in `PascalCase`, and tests as `*.test.ts` or `*.test.tsx`.

## Testing Guidelines

Vitest is the test framework. Add focused unit tests for pure note logic, import/export behavior, sorting, filtering, and store actions when they change. Keep tests close to the implementation file and describe behavior, not internals. Before shipping, run:

```bash
bun test
bunx tsc --noEmit
bun run build
```

## Commit & Pull Request Guidelines

The current history only contains an initial commit, so use simple, imperative commit subjects such as `Add note export tests` or `Fix mobile editor navigation`. Pull requests should include a short summary, verification commands run, linked issues when applicable, and screenshots or recordings for UI changes. Note any IndexedDB, import/export, or worker behavior changes explicitly.

## Security & Configuration Tips

The app is local-first and stores notes in browser IndexedDB. Do not introduce network sync, analytics, or external storage without documenting the data flow and user impact. Keep generated logs, screenshots, `node_modules/`, and `dist/` out of committed source unless intentionally required.
