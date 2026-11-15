# Standard enemy spawn contracts

`deathSpawn`, `deathSpawnDelayed` and `periodicSpawn` now require an explicit
enemy ID and a nonnegative integer count in compiled plans. The shared plan
module declares their count fields once and exposes
`enemyRuntimeSpawnDependencies(plan)` for the build audit and selected runtime
preparation. Custom controllers keep their separately reviewed dependencies.

The build audit refuses a standard spawn whose child is absent from its source
support declaration. Runtime preparation and constructor checks refuse a
missing child record before loading modules or beginning combat. Supplying a
complete graph prepares the child's own behavior alongside its parent. This
catches a missing dependency even when the child is basic and needs no module.

Both Auto Meal Distributor variants now declare their existing helper IDs.
Their source child records are packed by the ordinary stage compiler instead
of depending on an accidental global catalogue entry. The overloaded `Attack`
talent registration emits a death-spawn component only for its actual
enemy-key form. Four unrelated Attack groups no longer emit undefined-key
no-op spawners. Their existing other mechanics are unchanged by this cleanup;
it does not certify those families' complete native behavior.

Validation: all 782 admitted database levels pass the dependency audit; 206
integration tests pass. All 969 available stages pass ten-second smoke checks,
with no availability removed. A controlled browser fixture refuses a missing
helper before importing a behavior module, then prepares both distributors and
their helpers and observes one first helper from each. No source registry or
runtime compiler is requested in the browser. This fixture verifies the
existing timer path, not original native frame timing or an original-stage
playthrough. Evidence: `data/arkpedia-enemy-spawn-contracts-review.json`.
