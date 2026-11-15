# Dorothy's enemy trap component

`enemy_1257_lydrty` now shares ordinary physical projectile transport, timed
casting and a persistent tile-trigger helper. No DV stage has a special script.
DV-5 and both DV-EX-7 variants become available when the shared capability graph
is rebuilt. Total coverage at this checkpoint is 659/2,163 enemy records and
905/3,892 combat stages.

The native skill selects an unoccupied, buildable ground tile whose centre is
within 0.3 of Dorothy. Its original F_Skill event releases the trap; the cast
uses Slow Down, and its five-second cooldown begins when casting finishes.
Disarm interrupts an unreleased cast. Existing traps exclude repeat placement
on the same tile. The shared projectile owns arming, 0.2-second target polling,
finite lifetime and cleanup, including after the source dies. It has no unit,
HP, deployment slot or victory hold.

A trap affects one selectable ground ally on its original single-tile range.
It deals 150% ATK Arts damage, then adds one 10% ATK stack to its living source
(up to fifty) and applies ten seconds of Stun. Damage uses the live source's
attack or the release snapshot after source death. The source record's ordinary
immunities, zero life-point value and unblockable trait remain shared features.
The retained `Passive` component is not attached by the root or its sole mode;
its unrelated flags and outcome log are not installed just because it exists.

The source gate checks both data levels, native selectors, wrapper, attack and
skill components, projectile controllers, buff template, range table and original
animation binding. Pinned bundles and table hashes are retained in the ordinary
native-evidence pipeline. Public descriptions corroborate placement, expiry,
damage, stun and stacking:

- [PRTS enemy Dorothy](https://prts.wiki/w/多萝西(敌方)).
- [BWiki enemy Dorothy](https://wiki.biligame.com/arknights/多萝西（敌）).

The trap's half-second arming delay and finite 999-second dwell use the retained
mover and blackboard. Poll phase, exact native projectile lifetime transitions,
source-death snapshot behavior and effect/frame parity are not certified against
a native execution trace. Regression tests make the implemented policy explicit.
The original enemy body is in the shared asset store; trap effects are visibly
labelled temporary markers. Native particle artwork remains separate work.

Verification:

- Eight focused tests cover timing, placement, no stacking, source death,
  interruption, Slow Down, target filtering, ATK cap and original-wave deployment.
- 404 enemy, wave, branch and device regressions pass.
- All 905 loadable stage graphs pass a ten-second runtime smoke.
- Desktop and touch load the original DV-5 wave and Dorothy body, deploy Fang
  onto the first armed trap, verify 975 damage plus Stun, and restart cleanly.
  Only stage life is raised for inspection; this is not a stage-clear claim.
- The body decodes all six clips in both browser layouts. Shared asset validation
  passes 3,722 models; the importer code was already covered by the preceding
  94-test device-artwork checkpoint.
- The lightweight model graph is current. A Fang/Kroos static source audit is
  497 modules / 3,681,437 uncompressed bytes, excluding stage, roster and model
  transfers; selected operator adapters remain on demand.

`data/arkpedia-enemy-dorothy-review.json` records the source and validation hashes.
