# Capability-driven stage loading

Goal: a lightweight replacement simulator that loads stage definitions and
composes reusable mechanics. Stage IDs are data identities, not implementation
units. Existing per-stage files remain regression fixtures and a compatibility
format; they are no longer the admission list for the new loader.

## Implementation

1. Use the existing shared source compiler/preflight to discover every combat
   stage automatically. Availability follows implemented enemy, device, terrain,
   wave and rule capabilities, independent of legacy catalogue membership.
2. Publish a static manifest and immutable, shared JSON components. Geometry,
   pathing, enemy definitions/stats and fixed-squad records are referenced rather
   than repeated in each stage payload. Artwork keeps its existing shared-model
   alias scheme. The browser needs neither the source checkout nor a compilation
   server; it loads only the selected stage's dependency closure.
3. Resolve the component graph with a bounded fetch cache, verify identities,
   and install it through the same StandardBattle contract. Publish the manifest
   only after its complete component graph is written. Failed loads cannot leave
   a partially installed stage or leak prior stage overrides into the next stage.
4. Switch the app to the generated library. Expose unsupported stages with useful
   missing-capability information. Keep compatibility with existing stage files.
5. Test graph sharing, corruption/failure handling, automatic admission, source
   compiler equivalence, switching isolation, real battle startup and browser
   loading. Measure output size and selected-stage transfer, not just entry count.

## Following implementation work

Prioritize shared missing capabilities by affected stages: scheduled device
activation and branch actions, environment/visibility controllers, additional
individual-stage mode contracts, reusable enemy families and boss phases. Stage-specific checks are
regression examples, not permission gates or bespoke implementations. Do not
claim completeness from registration or successful startup alone. Remaining
mechanics must stay explicit instead of falling back to approximate behavior.

Full mode runs and carried progression remain outside the agreed scope.
Operator records and selected runtime adapters now load on demand; see
`OPERATOR-LOADER-REVIEW.md` and `OPERATOR-RUNTIME-LOADING-REVIEW.md`. Shared
enemy/device/core imports remain the next delivery-size work.

The home page can reuse the already embedded bootstrap default, preserving
controlled operator-review fixtures and avoiding a duplicate fetch. Explicit
stage selections always load the generated component graph. Removing that
embedded scene belongs with the later bootstrap split, not a hidden exception
for an individual stage ID.

## Verification

The implementation and current measurements are recorded in
[`STAGE-LIBRARY-REVIEW.md`](STAGE-LIBRARY-REVIEW.md). Rebuild with
`npm run content:library`, then run `npm run content:library:check` to exercise
every deployed graph. The generated priority report groups compiler refusals by
their shared reason across stage variants, and distinguishes affected stages
from those with only that reported blocker. Implementing one check can expose
further compiler refusals; neither count is a promise of immediate unlocks.

Original wave/fragment programs, clear gates and conditional route resolution
are implemented in the shared pipeline; see `STAGE-WAVES-REVIEW.md`. The legacy
flat timeline remains only for older standalone snapshots and controlled fixtures.
Route clock waits and predefined operator/card activation are implemented; see
`STAGE-CAPABILITIES-REVIEW.md`. Configurable numerical rules for individual
Integrated Strategies stages are documented in `STAGE-MODE-RULES-REVIEW.md`.

Library publication now checks availability by stage identity before writing
objects or replacing the manifest. A net increase cannot hide the loss of an
older loadable stage. Intentional withdrawals have an explicit
`npm run content:library -- --allow-removals` maintenance override after review;
ordinary content additions preserve every currently available stage. The guard
is exercised alongside atomic publication and immutable-component validation.
