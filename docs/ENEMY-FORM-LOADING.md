# Selected enemy form mechanics

Jesselton, Flamechaser and Blade Knight adapters now import rebirth and husk
mechanics from `arkpedia-enemy-forms.js`. This module also owns the existing
hit-count and form helpers. The legacy catalog imports and reexports the same
functions. Rebirth cleanse/cooldown reset, husk transitions, kill credit and
visual form events retain their existing behavior.

A browser import check loads all three selected adapters without fetching the
legacy enemy catalog. This does not mean every stage containing them avoids
that catalog: MB-8 still selects other legacy abilities. Its measured
simulation/shared response bytes grow by 734 after the split. Basic 0-1 and
TW-3 measurements remain unchanged; all three load and restart without errors.

Validation: 48 enemy-family/compiled-plan tests and 41 legacy transformation,
displacement and shared-API tests pass. All 969 available stages pass ten-second
smoke checks. This extraction makes no new enemy or
stage admission and does not certify additional native fidelity.
Evidence: `data/arkpedia-enemy-forms-loading-review.json`.
