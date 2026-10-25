# Remaining content

Snapshot: 2026-10-22. Regenerate the numbers with `npm run coverage:arkpedia-stages`.

| Area | Done | Total |
|---|---|---|
| Operators / operator forms | 431 | 431 |
| Enemies supported | 440 | 1,552 |
| Main source stages with committed files | 601 | 564 |
| Public catalogue (includes embedded 0-1) | 597 | 597 built |

The public catalogue contains 597 reviewed stages. Experimental 16-2, 16-3, 16-4, 17-2 and 17-3 are separate test-only builds using the complete canonical enemy candidate; see `CH16-BEHAVIORS.md`. There are 602 catalogue entries: 597 public and five test-only. The older coverage snapshot below has not been regenerated.

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

- Last baseline full repository suite (`7cc8d93e`): 23,011 tests, 23,000 passed, 0 failed, 11 skipped. Subsequent canonical-stage loader checks are additional focused tests, not a rerun of this baseline.
- The `d9772edc` full local run exercised 23,021 tests: 22,936 passed, 11 failed, 63 cancelled, 11 skipped. The failures/cancellations came from denied localhost sockets (`listen EPERM`). All nine affected files were rerun with local socket permission: 123/123 passed. Later raw-level/tunnel additions have separate focused verification; this is not a claim of one completely green full-suite invocation at the later head.
- The 16-3 integration full run exercised 23,042 tests with loopback permission: 23,029 passed, one failed, zero cancelled, 12 skipped (742 seconds). The sole failure was the report's stale file-backed-stage count, 597 instead of 598; that count is corrected and its test passes on rerun. The focused Chapter 16/17 suite passes 105/105; the opt-in real-app browser check passes, including public rejection, natural SP, keyboard/touch and restart. This records the full invocation and targeted repair separately.
- After the independent Attack/Combat clock and navigation-cursor corrections, a complete loopback-enabled run is green: 23,055 tests, 23,043 passed, zero failed/cancelled, 12 skipped (716 seconds). The focused suite passes 118/118. This supersedes the earlier repaired documentation-count run for those changes.
- `npm run check:arkpedia-enemies` and `npm run check:arkpedia-stages` are the registry gates.
- GitHub-hosted matrix only; `test/arkpedia-ci-runners.test.js` guards the runner labels.

## Conditional spawns

63 main stages are conditional: **205 branch** entries and **86 hidden-group** entries, read from `stage-conditional/<slug>.json`. The hidden-group entries are being checked for whether they are UI-hidden but always spawning; branch entries need the branch trigger before a stage can be built.
