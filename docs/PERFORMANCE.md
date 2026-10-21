# Battle-engine performance

Snapshot: 2026-10-21. `npm run bench:arkpedia -- --stage 14-11 --seconds 60 --runs 3` simulates a committed stage without rendering, browser or network.

Local result for **14-11** (150 spawns, 9 enemy types, 12 operators, 60 s cap; the battle clears at 34.3 s):

| Run | Steps | Simulated | Wall time | Steps/s |
|---|---|---|---|---|
| cold | 1,030 | 34.3 s | 41.6 ms | 24,760 |
| warm | 1,030 | 34.3 s | 23.8 ms | 24,760 |

So the engine runs roughly **300–500× faster than real time** on this machine. CI runners are slower, but the 22k-test suite's 10–12 minutes is dominated by test count and process startup, not by a single battle.

## Rust / WASM?

Not yet. The engine is not the bottleneck: a 34-second, 150-spawn battle is tens of milliseconds. A native rewrite would add a build/toolchain, a second source of truth for the data-driven feature registry, and FFI boundary costs, while the browser frame budget is more likely spent in rendering and UI.

Revisit if one of these becomes true:

1. A single battle exceeds ~100 ms of engine time on a mid-range phone, or a render frame consistently exceeds 16 ms with the engine paused.
2. Stage complexity grows by an order of magnitude (thousands of simultaneous units/statuses), not merely more catalogue files.
3. A WASM module can reuse the same compiled JSON and feature definitions without duplicating the rules.

The low-risk optimisations first: profile the renderer, avoid per-frame allocations in hot loops, and cache per-stage static data. `bench:arkpedia` is the regression gate for the engine side; `test/arkpedia-performance.test.js` adds a generous 5 s CI budget for 10 s of 14-11 so an accidental complexity jump fails the suite.
