# Operator data on demand

The normal browser entry point now reads `data/arkpedia-operators.json`: a
searchable roster, build constraints, shared configuration and content hashes.
Full operator records load when their build editor opens or battle needs them.
Selected summons load through the shared dependency registry. Fixed squads and
hidden fixed cards replace the free squad. Trial actors in ordinary stages load
alongside the selected squad; actor-only tutorials explicitly supply the whole
team, including an empty deployment-card roster.
Stage-local full records retain their source builds.

Operators, summons, model metadata and stages share the same immutable JSON
object directory, checksum loader and atomic publisher. The runtime cache is
bounded, concurrent requests share in-flight work, failures can retry, and
installed records are cloned. Existing explicit model aliases still select one
artwork source; the new graph does not copy or download artwork during packing.
Models and native visual effects stream after simulation data is ready.

The current bootstrap is about 518 KB (132 KB gzip), compared with the old
27.8 MB snapshot (1.38 MB gzip). These are bootstrap sizes, not total application
transfer sizes. The preparation screen no longer imports native battle evidence.
The combat runtime now prepares selected operator adapters before construction.
An atomic generated index recognizes immediate identity/family guards in the
existing hooks and preserves their original registration order. Unknown guard
shapes remain shared dependencies. Node tools retain the eager synchronous API;
the browser never imports that compatibility registry. Specialized summon
factories and squad-wide talents also load with their source owners. The latter
bind to the current roster, independently of previously cached selections. See
`OPERATOR-RUNTIME-LOADING-REVIEW.md` for footprint and validation details.
Marcille's party validation now uses immutable source faction tags held by the
battle instead of importing the full snapshot.

`npm run content:operators` publishes the graph from the current source snapshot.
`npm run content:operators:check` verifies both freshness and every object byte.
The normal source-data builder also publishes this graph; isolated review
candidates do not replace it. Upload immutable objects before their manifests.
The full snapshot remains a compiler/test input, not a production startup fetch.
Controlled QA fixtures opt in with `?snapshot=1`. Older static deployments fall
back only when the new manifest is absent (HTTP 404), never when it is corrupt.

The editor ignores late responses for earlier selections and exposes a retry
button after a failed download. It disables start while required editor data is
loading. Battle startup loads the actual squad/support/predefined dependency
closure before constructing the synchronous simulator. Unloaded summaries are
explicitly rejected by `recordFor`, so missing stats cannot silently simulate.

Validation covers all 431 default builds against their original records, every
registered summon dependency, stage overrides, cache isolation, retries and
legacy fallback. Browser checks cover home startup without the full snapshot,
rapid selection, retry, summoner support and desktop/touch play. The shared
runtime and source fidelity limitations remain unchanged.

The retained checkpoint is `data/arkpedia-operator-library-review.json`.
