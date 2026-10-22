# Remaining content

Snapshot: 2026-10-21. Regenerate the numbers with `npm run coverage:arkpedia-stages`.

| Area | Done | Total |
|---|---|---|
| Operators / operator forms | 431 | 431 |
| Enemies supported | 413 | 1,552 |
| Main source stages with committed files | 219 | 709 |
| Public catalogue (includes embedded 0-1) | 220 | 220 built |

The public catalogue is the committed `data/arkpedia-stage-*.json` set plus the embedded 0-1 stage; `testOnly` remains the gate for future stages.

## Built by chapter

`npm run coverage:arkpedia-stages` prints the current table. At this snapshot: Chapter 0 10/22, 1 9/22, 2 9/20, 3 7/16, 4 6/20, 5 5/21, 6 10/31, 7 2/36, 9 3/55, 10 15/49, 11 0/50, 12 0/55, 13 6/60, 14 2/59, 15 0/37, 16 0/34, 17 0/35, Other 17/67. Chapters 11–12 are dominated by the civilian/spy identity mechanic; 15–17 by missing geometry in the export.

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

- Full repository suite: 22,831 tests, 22,820 passed, 0 failed, 11 skipped.
- `npm run check:arkpedia-enemies` and `npm run check:arkpedia-stages` are the registry gates.
- GitHub-hosted matrix only; `test/arkpedia-ci-runners.test.js` guards the runner labels.

## Conditional spawns

63 main stages are conditional: **205 branch** entries and **86 hidden-group** entries, read from `stage-conditional/<slug>.json`. The hidden-group entries are being checked for whether they are UI-hidden but always spawning; branch entries need the branch trigger before a stage can be built.
