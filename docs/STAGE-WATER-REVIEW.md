# Shared permanent deep water

The source compiler distinguishes permanent deep water (Tide Controller skill 3)
from timed low/high tides (skills 1/2). A single compiled water program contains
the contact tiles and original skill values. Source skill rank and supported
blackboard overrides survive compilation; unknown overrides, scheduled
activation and overlapping controllers remain explicit blockers.

The reusable runtime scans ground-unit contact every 0.2 seconds. Enemy contact
applies a non-stacking ASPD change and final movement multiplier, deals immediate
entry damage and then ticks on that unit's own one-second clock. Leaving water,
flying, or covering the tile with a floating platform releases the effect at
the next scan. The shared `buff_sea` marker lets swimming enemies reuse their
existing conditional behavior. Open deep-water tiles require a platform for
ordinary operator deployment.

The native `periodic_damage_without_modify_no_fx` template requires resolved
sourceless true damage. Its explicit damage-pipeline option skips numerical
damage modifiers while retaining protection, hit-count targets, shields, HP
floors and damage receipts. It grants no damage SP and is not classified as
environment damage. Ordinary damage keeps the existing pipeline.

Evidence comes from the checksum-pinned skill and tile bundles, skill table and
buff templates, retained in `data/arkpedia-water-source.json`. Reproduce it with
`tools/arkpedia/extract-stage-water.py`; its common prefab reader is reusable for
later atomic imports. Artwork is unchanged and remains shared.

This checkpoint automatically adds 15 stages, bringing the generated library to
791 available of 3,892 combat stages. All 791 passed the ten-second graph/runtime
smoke. Targeted behavior/damage tests and compiler/scheduler regressions passed;
desktop and touch browser checks cover CG-5, DH-7 and BOL_VAR with diagnostic
enemy contact and real platform placement. See `data/arkpedia-water-review.json`.
These are not full player clears or native frame-parity certification. Native
submergence graphics and timed tide activation remain follow-up work; the old
standalone snapshots retain their legacy water helper.

Tile colors, heights and keyboard labels now follow semantic legend definitions,
including deep-water tiles, rather than assuming fixed numeric legend indices.
The same geometry renders correctly when its legend indices are reassigned.
