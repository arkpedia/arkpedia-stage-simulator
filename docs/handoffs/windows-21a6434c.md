> Transfer preparation, 2026-10-25: the human user approved saving the exact
> three modified and 16 untracked WIP files on `transfer/windows-wip-21a6434c`,
> based on `21a6434cbe0c09c4a5f5b13232cfce98016341d5`. This is **unvalidated WIP**;
> one Phantom targeting assertion is known to fail. No implementation was
> continued during transfer preparation. `feat/ch16-behaviors` and PR17 remain
> unchanged. Fetch this transfer branch on Windows; the WIP files are already
> present, so do **not** reapply the archived patch or untracked archive.
> Temporary binary source archives remain on the Mac. The handoff snapshot
> below records the pre-transfer state and the remaining work/cache requirements.

# Windows handoff — implementation stopped on MacBook

## Windows continuation checkpoint (2026-10-25)

Transferred via `transfer/windows-wip-21a6434c` at
`3f8b4f9cb976e054280b59d8e84eedd4d52cc00a`; local continuation is
`E:\Projects\arkpedia-stage-simulator`, branch `dev/windows-stage-continuation`.
The MacBook has stopped implementation and its preview server.

Local WIP now registers the exact Manglerbeast/Phantom families, shares M1Start
with the existing Slug via separate source-bound claims, preserves the existing
Infiltrator/Commander engagement registrations, and wires both runtime factories.
The candidate support builder verifies all retained hashes and claims exactly
one wrapper/active pair for each Manglerbeast and one active component for Phantom.
Candidate support snapshots are regenerated; no new stages have been admitted.

Fifty focused checks passed: Manglerbeast direct/source/mutation/automatic dispatch,
Slug regression, Commander regression, existing engagement, and miner source actions.
The Phantom registration test asserts that the nearest movement link and
latest-deployed weapon target remain separate. The original direct test now
checks damage on the selected weapon target. These changes are preserved on
GitHub at `686ac33e8d1a59e43bdb9ff71f8a67c66d1de38b`. Hosted run 40177079011 completed
successfully: **341 tests passed, zero failures/skips on each of Ubuntu and
Windows, Node 24**. This includes both Phantom suites, the ground/lifecycle
checks, source mutation gates, and the complete configured focused cohort.
This is focused validation, not a new full-repository run.

Local test limitation: Bitdefender quarantines the following benign simulator tests as a
JavaScript miner application (quarantine metadata reports
`GT:JS.Application.Miner.1.49A8D33B`):

- `test/arkpedia-unharmful-spawn.test.js` (committed baseline)
- `test/arkpedia-ch16-engagement-ground.test.js` (transferred WIP)
- `test/arkpedia-ch16-phantom.test.js` (transferred WIP)
- `test/arkpedia-ch16-family-registration.test.js` (new local WIP)

Do not commit the resulting local deletions, disable antivirus, or claim a
complete local run. The user cannot currently access the PC. Continue development
here and use GitHub-hosted CI for affected tests; GitHub file APIs preserve/edit
their source without executing quarantined files locally. Restore local files
only after the user has reviewed the detections. Hosted run:
https://github.com/arkpedia/arkpedia-stage-simulator-standalone/actions/runs/40177079011
The public catalogue and generated stage admissions are unchanged.

Checkout: `/Users/hyunmin/Projects/Arkpedia/arkpedia-stage-simulator`
Branch: `feat/ch16-behaviors`
HEAD (already pushed): `21a6434cbe0c09c4a5f5b13232cfce98016341d5`
Draft PR: https://github.com/arkpedia/arkpedia-stage-simulator-standalone/pull/17

## Preserved work

The working tree is intentionally dirty. This handoff directory contains:

- `tracked.patch`: all three tracked-file changes, binary-safe.
- `untracked.tar.gz` and `untracked-files.json`: all 16 untracked files, with repository-relative paths.
- `temporary-source-evidence.tar.gz`: the next story enemy native graphs/projectile/skeleton evidence, extraction scripts, failing-before-fix regressions and checkpoint validation logs.
- `SHA256SUMS`: transport checksums.

On Windows, fetch/check out the exact HEAD, apply `tracked.patch` and unpack
`untracked.tar.gz` into the checkout. Keep the temporary evidence separately.
Do not overwrite a different dirty checkout. Mac files remain intact; no WIP
commit was created and no continuation was launched after the stop request.

## Processes

The full test run, focused tests, native extraction and Chrome checks had
already finished. One old local preview remained: PID 42807, Node server on
127.0.0.1:3037, started by this task about six hours earlier. It received SIGTERM.
The process inventory also briefly saw the inventory's own Python process;
that process exited. No implementation/test harness was restarted.

The DeepSeek session was stopped previously and its monitor was deleted on
takeover. Do not resume it concurrently with the Windows implementation.
GitHub-hosted CI is external to this MacBook: run 40173307322 was still running
when last inspected; inspect it on Windows, especially Windows Node 22.

## Verified committed checkpoint

- Full actual CI entry point on exact HEAD21a6434c: 23,209 total, 23,196 passed,
  13 skipped, zero failed/cancelled, all eight Node groups passed.
  Log: `/tmp/codex-ch16-stage8-full.log` (also in temporary evidence archive).
- Focused cohort: 330 total, 328 passed, two opt-in browser skips, no failures.
- Separate actual-app 16-8 desktop/phone keyboard/touch, natural SP and restart
  passed; screenshots viewed: `/tmp/codex-ch16-8-ui/`.
- All ten experimental builds reproduce exact bytes. Public catalogue remains
  exactly 597 entries; ten additions are test-only (607 total, 606 file-backed).
- Experimental stages: 16-2..16-8 and 17-2..17-4. 16-8 includes the five native
  ALL-enabled group0 slugs (35 hostile spawns), excludes Six-Star group1.
- 16-8 route-only clear fixtures use explicit 600s and clear at
  369.17/403.57/314.10s. The unchanged 300s default timeout has a separate test.
- 16-9 has only independently manifest/receipt-verified source intake; no build
  or runtime admission. It contains a useDb=false local miner, story NPC and
  Core of Stupor. Do not substitute an old/public record for the local miner.
- Earlier HEAD98219c33: all Ubuntu Node22/24 and Windows Node24 shards passed;
  Windows Node22 shard1 timed out the full-catalogue smoke file at180s. HEAD21a
  gives only the full-catalogue sweep and existing seeded full-match aggregate
  files a bounded600s file deadline. Ordinary files retain180s; every assertion,
  stage and seed remains. Hosted confirmation is pending.

## Uncommitted continuation — do not claim full validation

Three tracked edits:
1. `server/sim/content/chapter16.js`: miner passive healing now copies full
   live Medic ATK. Original AssignAttributeToBB(ATK, scaleVar='') -> FixedValueHeal
   never reads the catalogue's legacy heal_scale. The old half-scale behavior
   failed the new source-based baseline (1200 vs1400 HP).
2. `server/sim/content/chapter16-engagement.js`: WALK_ONLY movement acquisition
   and neutral melee selection exclude flying/liftoff miners. Both regression
   cases failed before this change.
3. `test/arkpedia-ch16-behaviors.test.js`: updates the healing expectation to1400.

Six source/behavior regression checks for those repairs pass. The old committed
full run predates these changes; rerun appropriate broader validation after
finishing the next controller/stage integration.

Untracked new work:
- Manglerbeast graphs (two prefabs),46 indexed components, five templates,
  original art23 skeletons/bindings, portable extractors and independent exact
  reviewed contract. Both variants implemented in `chapter16-manglerbeast.js`.
  Twelve direct/source tests passed. Mode0 owns independent +100ASPD and taunt,
  5% initial-max-HP miner-only Physical pool, non-miner50% Phys/Arts reduction.
  No slug retaliation. Mode exit removes speed; shield-only removal preserves
  the separate speed buff. Native Trans is1s; three miner links, block volume1.
- Army Phantom (`enemy_10120_uaghst_2`) graph,13 indexed components, four templates,
  portable extractor, exact reviewed contract and `chapter16-phantom.js` factory.
  It uses the existing one-miner engagement/neutral melee and army mark; the
  generic Cannot-be-blocked trait owns unblockability.
- Phantom direct suite currently has one failing assertion: it assumes the
  linked nearest miner is also the weapon target. Debugging showed the independent
  weapon selector chooses the other deployment (ID4), while the movement link
  remains ID3. Fix the fixture/assertion against actual source target priority;
  do not force weapon/link identity. Temporary console instrumentation was removed.
- Neither new family is registered in shared feature gates/support nor imported
  into the chapter16 runtime dispatch yet. No16-10/16-11 stage is admitted.
  M1Start currently covers Slug only; extend via exact family union, preserving
  wrapper/active claims and fail-closed native/source/canonical mutation tests.
  Phantom shares the existing Can-fight-one-Miner spelling: preserve base
  Infiltrator and Commander behavior/claims; do not attach duplicate controllers.

Next useful implementation: finish Phantom target-priority test, integrate
both exact families, verify mutations/automatic dispatch, independently pin
16-10/16-11 from canonical245d7c6, review normal waves/devices/hidden groups,
build test-only, add seeded integration/parity/browser checks. Continue the
remaining Chapter16/17 normal-stage/controller backlog afterward.

16-9 story investigation (temporary archive only): both story prefab graphs,
26 indexed components, six templates and projectile_enemy_fearpj from pinned
`battle/prefabs/[uc]projectiles.ab`; art23 skeletons/CAB bindings verified.
Core Attack clip is eventless0.533333361s. Its projectile has speed10/lifetime10,
radius1, survives source death, final trace-hit inclusion. Fear applies only to
marked miners, checks full HP every0.5s, owns derived fear/disarm until full heal.
Guardian Skill_01 hit1.066666722/end1.766666651; Attack02 hit0.766666651/end1.866666675.
Its75s delayed5%-max-HP/second True DOT and global gyegrd_a[exist] need controllers.
Story hostile actions also use native harmless flags with counted/nonzero-LPR
records; the current builder intentionally rejects those unknown semantics.
Implement and review the receipt/lifecycle behavior; do not remove the guard.

## Canonical ownership / ignored assets needed on Windows

Enemy records remain checksum-verified `arkpedia/arkpedia-data@79e81a8a872b2ecc592647d81a864ccbf1f8ca06`
(1901 enemies/2125 records), never an old public overlay.
All admitted source stage inputs pin `arkpedia-data@245d7c601ce3a4a42adcfb84faa1bd1123d507bb`,
producer `arkpedia/arkpedia@7c94fb8516030728586005b01e75620bfc9b4c3b`, upstream
`ArknightsAssets/ArknightsGamedata@db6f9ef8046ad17dbebe3ff1d0dd88844a5bc78c`.

Useful ignored Mac assets (copy as bytes or refetch with pinned hash checks):
- `.cache/arkpedia/cn-native-source/hot_update_list.json` and
  `official-android-version.json`.
- `.cache/arkpedia/cn-native-source/bundles/`: preserve full native bundle cache
  for the remaining source investigation. Immediately relevant files are
  `battle/enm_pfb_27.ab`, `battle/enm_pfb_28.ab`, `battle/enm_pfb_31.ab`,
  `battle/prefabs/[uc]projectiles.ab`, `config/buff_template_holder.ab`,
  `refs/arts/enm_art_23.ab` and `refs/arts/enm_art_26.ab`.
- `.cache/arkpedia/canonical/` and `.cache/arkpedia/canonical-stage-*/` contain
  immutable canonical enemy/stage snapshots. The loaders can refetch exact pins.
- `.cache/arkpedia/cn-native-source/status-enums-dump.cs` is optional discovery
  evidence, field/numeric definitions only; it does NOT contain client methods.
- Recreate Python/UnityPy dependencies on Windows. Do not copy the Mac
  `.cache/map-env` virtualenv as an executable Windows environment.
- `node tools/arkpedia/test-assets.mjs` is CI's pinned original skeleton intake;
  `npm ci` supplies JS dependencies/vendor assets. Do not claim a missing binary
  disproves retained native evidence.

Related repos are already pushed and can be fetched on Windows:
- `/private/tmp/arkpedia-stage-route-data`, branch preview/ch16-stage-route-export,
  HEAD245d7c6; draft arkpedia/arkpedia-data PR44, validation passed and publish skipped.
- `/private/tmp/arkpedia-stage-route-producer`, branch fix/stage-route-export,
  HEAD7c94fb8; draft arkpedia/arkpedia PR763. Its generated data/public tree is
  intentionally dirty; preserve it and never git-add-A. Normal compiler export
  is `/private/tmp/arkpedia-ch16-ch17-all-canonical-export`. Canonical245 already
  retains all34 normal16-2..18/17-2..18 source levels; no substitute producer repo.

## Non-negotiable continuation constraints

All new stages remain explicitly test-only. Keep checksum/receipt/native/support
and parity gates, preserve work and exclusive ownership. No public catalogue or
production pointer promotion, merge or deployment without explicit human approval.
Only GitHub-hosted CI runners; never NAS/self-hosted. Do not resume work on MacBook.
