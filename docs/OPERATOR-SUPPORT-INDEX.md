# Compact runtime operator support

The regular browser uses a generated support index instead of importing every
source registration module. The source registrations remain the only place to
edit support metadata. The index contains 436 registrations, including fixed
actors; the published selectable roster still has 431 forms. Full operator
records, summons, model metadata and selected adapters retain their existing
on-demand loading and component identities.

Source and runtime assertions share one validation implementation. The source
library compiler validates against the source registry, so adding an operator
does not depend on first loading an already-refreshed runtime index. Publishing
the operator library also atomically refreshes the index; the normal library
check refuses any stale support metadata. The standalone maintenance command
is `node tools/arkpedia/operator-support-index.mjs [--check]`.

Across 0-1, MB-8 and TW-3, pre-battle simulation/shared requests fall from 278 to
38. Each stage saves 240 module requests and 76,634 measured response bytes.
The 0-1 total falls from 356 requests/450,296 bytes to 116/373,662. Measurements
exclude data, artwork and other application scripts. All three stages load
and restart without errors and do not request the aggregate source registry.
The public full-mode API still has the same Battle class, 129 kits and nine
domains, and importing it leaves an existing regular battle unchanged.

Validation: 54 focused operator/library/squad/battle tests and five compiler,
parity, rejection and publication checks pass. The operator sweep exercises
all published skills. All 969 available stages pass ten-second smoke checks.
The broad simulation/content suite reports 1,797 passed, three skipped and
the same two baseline Chimera pollution failures. This change makes no new content admission or native-fidelity claim.
Evidence: `data/arkpedia-operator-support-index-review.json`.
