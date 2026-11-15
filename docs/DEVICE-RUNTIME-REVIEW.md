# Compiled device runtime

The browser consumes compiled device definitions instead of downloading the
complete native device extraction and rerunning source admission predicates.
`tools/arkpedia/device-runtime.mjs` evaluates the existing source compilers for
every admitted level, skill, direction and ownership variant. Identical outputs
share one definition; dimensions that do not change the result collapse while
retaining their input validation. Eleven factories currently produce 272 unique
definitions in a roughly 100 KB artifact.

The original native predicates and stat/skill interpolation remain the only
source compilers. They still run during content compilation. Stage-specific
branch IDs and action indices are validated separately and bound to fresh
definition instances, preserving independent state between devices and battles.
The compiler also derives supported device identities, geometry and constants.
Pure beam routing and targeting helpers are shared code, without evidence imports.

Shredder admission retains the exact broken-stump prefab component in the
generated artifact. It does not require all other devices' native evidence.
Enemy-support generation and content-context loading check the artifact against
fresh compilation and source digests before publishing. Unknown configurations
continue to fail; this does not widen stage or enemy admission.

Run `npm run content:devices` after changing a source device contract, then
`npm run content:devices:check`. Add a new runtime factory to `DEVICE_FAMILIES`
with its finite configuration dimensions. The compiler invokes the existing
factory and shares repeated definitions automatically. Do not copy native
checks or hard-code compiled statistics in the browser adapter.

The regression suite compares every generated configuration to its original
compiler, checks rejection/default semantics, arbitrary branch bindings,
independent mutable results, source/compiled specification parity and stale
publication refusal. It also traverses the battle import graph to ensure raw
device evidence cannot accidentally return to the client.

The Fang/Kroos static source closure falls from 3,681,437 bytes to approximately
2.31 MB, about 37% smaller. This is an uncompressed source audit, excluding
stage/roster/model transfers and optional visual effects; it is not a load-time
benchmark. All 905 available stage graphs pass their ten-second runtime smoke
with the compiled definitions. These checks do not establish full-stage clears
or native frame parity.
