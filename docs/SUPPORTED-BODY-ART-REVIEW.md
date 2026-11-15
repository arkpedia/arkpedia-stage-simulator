# Supported enemy and reward-device bodies

Twenty-seven additional supported enemy records and three reward devices now
use their original native body artwork. Fifteen enemy identities reuse an
existing byte-identical model through an explicit manifest alias, preserving
separate source receipts, statistics and animation roles. Device aliases use
the same transport rules and reject cross-kind or chained aliases.

The Lost Hovercraft and both Dublinn hoverers now select their native ground
Idle/Move/Die/Attack mappings after their first accepted landing control. This
uses the existing form-visual controller; it does not add unreviewed landing
transition timings or change their combat clocks.

Three galleries cover ten enemy bodies/68 clips, three devices/eight clips and
seventeen enemy bodies/90 clips on both desktop and touch viewports. Controlled
battle fixtures verify the hoverer's airborne-to-ground role change, original
chest/mimic/fowl models, rescue and branch behavior, result counters and restart.
The asset validator accepts 3,752 complete models and the operator component
graph verifies 2,166 shared objects. Fourteen client/artwork regressions pass.

These are body and loading checks. The Portal and Window skeletons are simple
markers whose separate native effects are not part of this import. Likewise,
body coverage does not establish complete effects, native visual parity or
admission for every stage that references the enemy. Immutable asset commits
and browser results are recorded in `arkpedia-supported-body-art-review.json`.
