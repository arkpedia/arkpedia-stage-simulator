# Remaining content

Snapshot: 2026-10-22. Regenerate the numbers with `npm run coverage:arkpedia-stages`.

| Area | Done | Total |
|---|---|---|
| Operators / operator forms | 431 | 431 |
| Enemies supported | 440 | 1,552 |
| Main source stages with committed files | 597 | 564 |
| Public catalogue (includes embedded 0-1) | 597 | 597 built |

The public catalogue contains 597 reviewed stages. Experimental 16-2 is a separate test-only build using the complete canonical enemy candidate; see `CH16-BEHAVIORS.md`. Committed experimental files are counted above but are excluded from the public count.

## Built by chapter

`npm run coverage:arkpedia-stages` prints the current table. At this snapshot (combat stages only; hard-variant geometry resolved from the base): Chapter 0 21/22, 1 18/22, 2 20/20, 3 13/16, 4 18/20, 5 8/20, 6 19/28, 7 24/32, 9 21/34, 10 28/30, 11 6/32, 12 29/35, 13 10/38, 14 25/38, 15 21/34, 16 1/32, 17 0/31, Other 37/61, Side stories 17/19. Remaining first blockers: devices 119, unsupported tokens 53, enemies 47, conditional 10.

## Why the other 594 main stages are not built

| First blocker | Stages |
|---|---|
| No stage geometry in the source export | 311 |
| Unsupported enemy family | 159 |
| Conditional spawns | 63 |
| Deployable tokens | 60 |
| Other | 1 |

The unsupported-enemy group is ranked by stage count. The current top families:

| Stages | Enemy | Missing mechanic |
|---|---|---|
| 24 | `enemy_1313_wdfmr` Norport Civilian | friendly-unit identity / DP reward |
| 13 | `enemy_1107_uoffcr` Infected Patrol Captain | Ursus Civilian target priority |
| 13 | `enemy_1078_sotisc` Guerrilla Fighter | Inspired movement bonus |
| 11 | `enemy_1223_dmech` Sarkaz Heirbearer Artificer | Londinium artillery charge |
| 11 | `enemy_1315_wdyjd_2` Sentry Spymaster | spy identity / invisibility |
| 11 | `enemy_1421_lrchld` Beacon | beacon pickup/drop |
| 10 | `enemy_1080_sotidp` Guerrilla Herald | Inspired ATK/DEF aura |
| 10 | `enemy_1079_sotisp` Guerrilla Sniper | Inspired extra target |

## Next useful steps

1. Finish a stage family end-to-end (geometry, enemies, build, public review) before starting another. `docs/ADDING-CONTENT.md` has the workflow.
2. Prefer enemy families that unblock several stages at once; the coverage report is the ordering tool.
3. Deployable tokens and conditional spawns are engine features, not per-stage data. Model them once in `server/sim/arkpedia.js` and the stage adapter, with a focused test, before enabling the affected stages.
4. Every public promotion needs a `reviewed` date; the catalogue test enforces it.

## Verification

- Last baseline full repository suite: 23,002 tests, 22,991 passed, 0 failed, 11 skipped.
- `npm run check:arkpedia-enemies` and `npm run check:arkpedia-stages` are the registry gates.
- GitHub-hosted matrix only; `test/arkpedia-ci-runners.test.js` guards the runner labels.

## Conditional spawns

63 main stages are conditional: **205 branch** entries and **86 hidden-group** entries, read from `stage-conditional/<slug>.json`. The hidden-group entries are being checked for whether they are UI-hidden but always spawning; branch entries need the branch trigger before a stage can be built.
