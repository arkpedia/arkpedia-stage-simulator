# Hui-Ming stage tiles

Stage compilation now carries Hui-Ming (yin/yang) tiles into a battle. A stage whose geometry contains `tile_yinyang_road`, `tile_yinyang_wall` or `tile_yinyang_switch` gets a `huiMing` program, and the battle installs the tile controller from it. No original Hui-Ming stage is published yet; the remaining blockers are listed below.

## Source

- **Tile prefabs.** `tools/arkpedia/extract-hui-ming-tiles.py` retains the three native tile prefabs from the checksum-pinned CN tile bundle, with the seven pinned Global buff templates they name, in `data/arkpedia-hui-ming-tile-source.json`. `--check` reproduces the file. `tools/arkpedia/stage-hui-ming.mjs` pins each prefab and template by digest and refuses to compile a stage when any differs.
- **What the prefabs say.** The road and wall marks are two-mode dynamic buff tiles for the player's own ground units: mode 0 gives `buff_yin`, mode 1 `buff_yang`, together with the same/opposite scale buffs and one result log. Nothing is cleared on leaving, and a mode switch does not act on enemies. The switch tile starts the immediate `buff_yinyang_switch` on a ground enemy that enters.
- **Stage data.** Each mark tile's own blackboard supplies its starting mode (`dynamic`) and the two scales. They are read from the stage geometry's tile legend.

## Compilation

`shared/arkpedia/stage-hui-ming.js` turns a geometry into `{ kind: 'huiMing', marks, switches, scanInterval }` with board rows and columns. It refuses, instead of ignoring, any mark blackboard that is not exactly the three known keys, a mode other than 0 or 1, a negative scale, a switch tile with a blackboard, and a tile whose height, walkability or deployability differs from the reviewed form. `compileStage` refuses a stage that has these tiles without a program, or a program without the tiles. The content inventory reports a refusal as a `Hui-Ming tiles` stage-data blocker.

Of the 34 source stage geometries that use these tiles, 30 compile. The four refused ones carry something outside the review: `ta-10` and `ta-ex-8` add an `act49side_boss_level_tile_mark` key from a later event, and two Integrated Strategies variants of one map have a mark tile with a malformed blackboard and no `dynamic`.

## Runtime

`StandardBattle` validates `stage.huiMing` and installs `installHuiMingTiles`, the controller reviewed in `docs/ENEMY-HUI-MING-REVIEW.md`. An operator deployed on a mark takes its attribute and scales; the 'Envy' charged shot flips the mark under its target; an enemy entering a switch tile swaps its attribute.

## Verification

Four stage tests cover the reviewed evidence and its refusals, compilation of a cut of an original geometry, the refusal list above, and a full stage battle that installs the controller and gives a deployed operator the mark's attribute. The broad simulator and content run measured 1,807 tests, 1,803 passes, three skips, one todo and no failures, and all 970 pinned stage graphs pass ten-second runtime smoke. The 84 stage, content and enemy-runtime test files (1,525 tests) have 104 failures, every one of them already in `docs/ci-test-set-failing-baseline-2026-11-16.txt`; none is new.

## Boundaries

- **No original Hui-Ming stage is published.** The 'Who is Real' stages still need three things outside this change: reviewed alias contracts for their stage-local enemy variants (for example `enemy_1122_sphond_0`), the `trap_026_inverter` device, and the per-stage original level caches that the build tools read, which do not exist on this machine. The pinned stage library was not republished.
- The committed content inventory predates these batches and was not regenerated, for the same missing caches.
- Tile clocks and enter/leave ordering have no retained method bodies. Occupancy is a tenth-second scan; see the tile boundaries in `docs/ENEMY-HUI-MING-REVIEW.md`.
- The tile modes are not yet part of the stage result record.
