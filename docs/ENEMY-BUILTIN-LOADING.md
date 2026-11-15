# Common abilities without the legacy catalog

The common builtin ability group imports rebirth directly from shared form
mechanics, and damage/element/tile-area helpers from shared effects. Its unused
legacy feature registry import is removed. The legacy enemy entry point still
reexports the identical damage and area helpers.

A browser check loads the builtin group and the three selected form adapters
without requesting the legacy enemy catalog. Other abilities selected by a
stage can still require that catalog. This change preserves existing behavior
and parameters; it admits no additional enemy or stage.

Sixteen shared API/runtime-plan tests pass. The 54-test transformation,
Tidal Corrosion, vehicle-dependency and solvent integration run passes 52,
with the same two previously established Chimera pollution failures.
All 969 available stages pass ten-second smoke checks.
Evidence: `data/arkpedia-enemy-builtins-loading-review.json`.
