# Stage simulator handover

Updated 2026-11-16. **Work was resumed on 2026-11-16 at the user's request**, on a macOS checkout, after the pause recorded earlier that day. Father Agenir is the first batch of the resumed work.

## Goal and agreed direction

Build a lightweight, complete stage simulator that can replace the current simulator. Finish **all enemies first, then stages**, using reusable mechanics and loading a stage's elements instead of hand-coding each stage. Earlier scope also included operators. Completion has **not** been reached.

When resumed, continue between completed batches without asking whether to continue, and commit/push regularly. The user dislikes small checkpoints that end the turn. Ask for input only for material architectural decisions that need it. Already approved:

- Individual stages with configurable mode rules for Integrated Strategies, Reclamation Algorithm and multi-floor modes; not whole-run progression.
- Explicit shared-model aliases for byte-identical artwork.
- On-demand operator data and enemy/device behavior loading.
- Expansion of the shared native buff compiler into validated portable programs.

## Repositories and saved state

The earlier sessions ran in a container under `/workspace`. That container, its `.cache` and its `/tmp` logs and research checkouts are not available on the macOS machine; everything needed was re-fetched from the pinned sources and hash-verified.

- Simulator: GitHub `arkpedia/arkpedia-stage-simulator`, branch `master`. On the Mac the remote is named **`legacy`** (`origin` there is the unrelated `arkpedia-stage-simulator-standalone`), and work happens in the worktree `~/Projects/Arkpedia/claude-sim/sim-master`, branch `work/enemies-continue`. Push with `git push legacy HEAD:master`.
- Assets: GitHub `arkpedia/arkpedia-sd-assets`, branch `main`, worktree `~/Projects/Arkpedia/claude-sim/arkpedia-sd-assets`, branch `work/enemies-continue`. Tools and tests expect this checkout as the simulator's sibling `../arkpedia-sd-assets`. Push with `git push origin HEAD:main`.
- Latest asset commit: **`0326075d70f179ceb0c3ceabaa1fa674c68e237e`**, original Hui-Ming Envy models, pushed to main.
- The latest implementation commit is the one that contains this file; see `git log`.
- No PR was created. No subagents were used.

### Rebuilding the ignored inputs on a fresh machine

```sh
set -e
npm ci
python3 -m venv .cache/arkpedia-venv
.cache/arkpedia-venv/bin/pip install -r tools/arkpedia/stages/requirements.txt
export ARKPEDIA_PYTHON=$PWD/.cache/arkpedia-venv/bin/python
node tools/arkpedia/cn-enemy-native-source.mjs --fetch
node tools/arkpedia/fetch-pinned-bundles.mjs 'battle/prefabs/[uc]projectiles.ab' --enemy-art
```

`extract-enemy-native-abilities.py` also reads three public tables into `.cache/arkpedia`, each checked against a pin in the script: `buff_template_data.json` (Global, `data/arkpedia-mvp.json` `behaviors.source`), `range_table_cn-<commit>.json` and `cn-native-source/tables/buff_table.json` (CN, the commit in `data/arkpedia-cn-native-source.json`). Fetch them from `raw.githubusercontent.com` at those commits. Rerunning the extractor on unchanged scopes must leave `data/arkpedia-enemy-native-abilities.json` byte-identical; that is the environment check.

## Current coverage and verification

- **785 / 2,163 enemy records admitted; 1,378 remain.**
- **851 database levels**, **217 runtime kinds**.
- **970 published stage graphs** remain pinned for the stages phase. This is not a count of fully certified stage clears or the remaining stage backlog.
- Asset repository: **3,860 complete models**; simulator original enemy artwork catalogue: 578 models.
- Latest Limo focused suite: **111 passing tests**, including raw/compiled combat equivalence across all 833 admitted levels.
- After adding a real displaced-hole regression, the complete Limo family suite passed **14/14**. This last change added the existing `deathByFall` check to the new Limo controller; it did not change core displacement.
- All 970 published stage graphs passed ten-second constructor/runtime smoke. These are **not original-stage clears**.
- Latest broad run was the Father Agenir batch, before its Chimera test edit: **1,806 tests, 1,801 passes, 3 skips, 2 known failures**, identical to the Caster baseline. The two failures were stale Chimera expectations in `test/content/feedback1d-solvent.test.js`. They were then updated to the reviewed controller and the shared pollution registry; one unresolved claim (pollution damage grants hurt SP and triggers a Defender skill, which the registry's no-SP packets contradict) is kept as a `todo` test. That file was rerun alone (15 pass, 1 todo). The broad suite was then rerun: **1,807 tests, 1,803 passes, 3 skips, 1 todo, 0 failures**. The Hui-Ming batches, which add the opt-in `sourceAtkScale` event to `server/sim/damage.js` and live target-priority comparators to `server/sim/targeting.js`, measured the same totals on their final code, and all 970 stage graphs passed the ten-second smoke.
- **CI.** The last successful master run was on 2026-10-30. The recent failed runs that were inspected (2026-11-16) stopped after about 45 seconds in `tools/arkpedia/test-assets.mjs` with `Conflicting immutable skeleton`: a shared-model alias is published by a later assets pin than the file it names. Causes of earlier failures were not examined. The Agenir batch fixes that step. CI runs only the top-level `test/*.test.js` files (`tools/run-tests.mjs`), in eight test jobs of up to 90 minutes per push, so push once per finished batch. In the first run after the fix (Agenir batch) the skeleton step succeeded. All four Windows jobs then failed in the test step; the Ubuntu jobs were cancelled when the next push superseded the run, so no Ubuntu result exists yet. The 150 locally failing test names of that baseline are kept in `docs/ci-test-set-failing-baseline-2026-11-16.txt` for comparison.
- **CI test set, measured locally for the first time (macOS, 2026-11-16).** `node --test --test-concurrency=3 test/*.test.js` at the Agenir batch: 21,560 tests, 21,275 passes, 135 skips, 150 failures in 68 files. The 150 failing tests were then rerun by file at the previous handover commit `28c868e5` and at the Agenir batch (119 in 68 files, plus 31 stage-smoke and stage-file tests defined in `tools/`): the failing names are identical at both commits, so none of them comes from the batch. Most are environmental, not behavioural: `Original level cache missing; restore it with content:rules for this stage` (ignored per-stage caches that existed only in the old container) and stage files compared against a compile from the sibling `arkpedia-data` checkout. The workflow checks out neither, so CI stays red until those tests are made hermetic or the inputs are provided; the failing test names in CI itself were not compared with the local list. `tools/arkpedia/stage-index.mjs --check` also fails at both commits (`Invalid stage file: arkpedia-stage-branches-review.json`).
- Desktop and touch browser fixtures and original-body galleries passed for each completed family. Fixtures use controlled battles on compiled 0-1 geometry and explicit SP receivers/aura markers; they do not certify the native Blood Debt controller, original-stage clears, effects/audio or frame/pixel parity.

Detailed source hashes, validation scopes and browser receipts are committed in `data/arkpedia-*-review.json`, with explanations in `docs/ENEMY-*-REVIEW.md`.

The `/tmp` logs of earlier batches were in the old container and are gone; their results are recorded in the committed review receipts.

## Recent completed batches

All listed commits were pushed. Their matching original models were published separately in the shared asset repository.

| Commit | Work |
| --- | --- |
| `11a3b4cd` | Famiglia Soldiers and Intimidators; selected death-SP gifts, independent killed logs, native taunt modifier, shared device SP adapter and program service preflight. Coverage 758. |
| `da0405a8` | Famiglia Crossbowmen pair: half-second native mode polling, physical/Arts conversion, captured cast mode, independent mode markers and removable killed-log attachments. Coverage 760. |
| `69049f51` | Famiglia Silencers pair and guarded permanent-stat program lowering. Conditional ATK/DEF +15%, ASPD +50; native one-second stealth restoration. Conditional source traits resolve in both raw compatibility and compiled paths. Coverage 762. |
| `593b3c8a` | Famiglia Capos pair: independent recipient death auras, 40 SP per attached killed recipient, overlapping source contributions, native Arts melee. Coverage 764. |
| `14fd1aee` | Famiglia Casters pair: two-target Arts packets and eight-second channels, eight one-second pulses of five SP, entry-only Asset Liquidation condition, native three-part visuals and shared scheduler callbacks. Coverage 766. |
| `5d685947` | Famiglia Limos pair: blocked before-zero death mode, original Soldier passengers, scheduler/route reuse, independent killed/direct-destruction results and original death clips. Coverage 768. |
| Father Agenir batch | One magazine whose rounds buy permanent DEF stacks at arrival, global Skill mode under Asset Liquidation, start-only selected periodic SP link (`selectedSpLink`), silent `ModifySp`/empty `CreateEffect` lowering, CI skeleton-step fix, Chimera test update. Coverage 769. See `docs/ENEMY-FATHER-AGENIR-REVIEW.md`. |
| Hui-Ming batch | Shared yin/yang attribute account (`arkpedia-hui-ming.js`), opt-in per-recipient `sourceAtkScale` damage event, fourteen Hui-Ming enemies: six plain, the Fury pair, the Stabby archers, the Blindey pair and the Smarty pair; live target-priority comparators and multi-pair block conditions; then the 'Smarty' pair's blast chain (`huiMingBlast`), the Hui-Ming tile controller and the 'Envy' pair. Coverage 785. See `docs/ENEMY-HUI-MING-REVIEW.md`. |

Earlier work in this same ongoing effort includes Paramilitary Axemen (`3b0ed249`), Blocker drones (`234b3744`), Radioactive Originium Slugs (`842c7462`), shared native energy programs (`321dedb7`), Paramilitary Snipers (`96a4121d`) and shared stage-result overload logging (`57caa46c`).

## Important implementation boundaries

### Shared programs and runtime loading

- Build/source bridge: `shared/arkpedia/native-buff-programs.js` reads retained native evidence and compiles once. Browsers receive portable component graphs/references, not source templates or the native compiler.
- `shared/arkpedia/behavior-native-compiler.js` accepts a strict native dialect. `shared/arkpedia/behavior-program.js` validates the full bounded graph and blackboard before execution.
- Prepared programs expose `requiredServices` and `validateServices(allowed)`. Every consumer must declare supported services before actor traits attach. Energy-only consumers must not silently accept SP programs.
- Resource operations currently include signed bounded integer `energyAdd` on the root owner and **nonnegative target-bound `spAdd`**, which now also lowers the silent (`_dontShowSpUI`) target variant; the native empty-key `CreateEffect` lowers to nothing. Signed SP and owner-bound SP have **not** been implemented in programs. Agenir's own round spending (`ModifySp` −1 on BUFF_SOURCE after `CheckHasSp`) is an exact-template gate over the `enemyAmmo` account, not a program.
- New guarded-stat lowering recognizes the exact native absence check followed by one permanent inert stat attachment. It does **not** implement arbitrary STACK merging. A present same-key buff suppresses creation; native `FinishBuffsById` removes all same-key instances. Supported modifiers are ATK percentage, DEF percentage and ASPD, with zero fallback and bounded signed operands. Shared damage operands retain their nonnegative domain.
- The runtime index is `server/sim/content/arkpedia-enemy-runtime-index.js`. Some legacy kinds still route through `enemies.js`; further startup reduction remains useful.
- `ammoAttack` is already implemented in standalone `arkpedia-enemy-ammo.js`, including reusable `enemyAmmo(max, initial)`, but its runtime-index entry still points through the legacy `enemies` module. Repointing it may help the next ammo enemy without duplicating the account. The same file now exports `ammoHitBuff`, an arrival buff that spends the source's rounds for flat DEF stacks; `programmedProjectileModes` composes it through optional `ammo`, per-mode `ammoHit` and per-mode `globalRange` parameters.
- `arkpedia-enemy-sp-link.js` (`selectedSpLink`) is the start-only selected periodic SP link: selection happens once, when the parent passive starts; derived buffs live on their receivers and finish with the parent.

### Shared SP and channels

- `server/sim/content/arkpedia-device-sp.js` owns the existing-gauge adapter and now also `selectedDeviceSpTargets`. Channels and death auras import the filter here, not the death-SP behavior.
- `registerDeviceSp` currently accepts any live battle unit, despite the name; it has no kind check. The selector itself selects tagged devices. `addDeviceSp` currently accepts nonnegative additions only and delegates to a registered provider or `SkillRuntime.gainSp`.
- `channelledSpEmitter` composes the ordinary projectile sequence with `timedEnemyCasts`.
- `timedEnemyCasts` gained optional spec `start`, `visual`, `finish` callbacks, receiving the existing ability state as the last argument. `beforeCast` also receives state as its fourth argument. Existing specs retain their behavior.
- Caster entry checks absence of `vgctrl_s[aura]`; gaining the marker during an active channel does not cancel it. Channel cooldown runs from actual cast start, independently of its duration.
- There is also an older `arkpedia-enemy-channel.js` targeted travelling-pulse channel. Its link/target lifecycle and begin + pulse + recovery timing differ from the new fixed-budget SP channel; do not conflate them.

### Limos and child dependencies

- `blockedDeathSummons` in `arkpedia-enemy-blocked-death.js` captures blocking in the existing `killed` dispatch, before ordinary removal unblocks the unit. It uses existing `scatterFragments`, route and ground-placement helpers.
- It bypasses both before-zero branches when `e.mem.deathByFall` is true. Actual regular displacement sets this before invoking its fall callback, which may call ordinary `kill` while the blocker pointer still exists. A real-hole regression covers this.
- Queued requests hold victory and survive host removal. The normal/elite child IDs are `enemy_1277_sgman` / `_2`; their actual admitted behavior is loaded and used.
- `SPAWN_COUNTS` in `shared/arkpedia/enemy-runtime-plan.js` now recognizes `blockedDeathSummons: 'cnt'`. Its flat `params.key` exposes the dependency; missing child records are refused before module imports.
- Parent death passive and killed-log attachment are independent. Unblocked destruction records `sgcar_boom_direct`; both killed modes record `killed` while the corresponding native log remains attached.
- The death clip mapping is applied by an owned death hook after common ordinary-attack cleanup: `Die_1` normally, `Die_2` after entering the special mode.
- The special mode installs an **immediate passive**. Do not substitute the retained Die_2 OnAttack artwork event for that installation.

## Likely next work, not yet implemented

Father Agenir (`enemy_1284_sgprst`) is done. The remaining Blood Debt actors are gated on material work described below: the Siracusan Civilian needs allied route actors, and the native controller belongs to the stages phase. Continue with other enemy families until one of those is taken up. `data/arkpedia-enemy-support.json` lists every unadmitted record with its missing reasons; 126 records have a single missing reason.

### April Fools (FunLive) target collectors, inspected but not started

Ten records have a single missing reason, an unclaimed native ability: `enemy_5012_mstntd`, `5014_dmanfd`, `5017_dwarfd`, `5019_hmotfd`, `5020_hslrfd`, `5022_smbone`, `5023_smbtwo`, `5024_divmfd`, `5025_bmbdfd`, `5026_icedfd`. All have ATK 0 and range 0. Findings from the pinned prefabs and Global templates (inspection only, nothing retained or admitted):

- Nine carry a `FoolsCollector` ability (script `-4234909118878081699`, immediate buff, no selector). It is never self-triggered: the mode's `funlive_collect_info` buff calls `TriggerAbility('FoolsCollector')` on a photographed unit and records a non-rare target when the unit has no such ability. The ability's buff judges once at start and calls `CollectTargetInfoFunLiveModeOnly` with a rare flag: `judge_not_moving` (dwarfd, smbone, smbtwo), `judge_is_moving` (hmotfd, divmfd, bmbdfd, icedfd), `judge_in_water` on `tile_deepsea` (hslrfd), `checkpoint` back-to-front index 1 (dmanfd). The collecting mode controller is stages-phase work, like the Blood Debt controller. A faithful enemy-side component is an externally triggered collector with a registered mode sink and no effect without one; it must not be claimed as an inert visual.
- `IfEnemyIsMovingBySelf` and the back-to-front checkpoint index need a stated reading; the engine's `e.moving` is the nearest fact for the first. Neither was established from method bodies.
- Wrinkles per record: dwarfd swaps its animation keys (Idle plays `Attack`, Attack plays `Idle`); hmotfd has block volume 3 and a limited `buff_swim` marker with lifetime 0; hslrfd keeps the Dockworker `Drown` talent component (`enemy_hvyslr_drown`) without a record talent, and its collector is a common ability; divmfd has two modes; bmbdfd and icedfd attack through `MockCombat`; mstntd has no collector, only visual passives and a death-audio buff (`funlive_mstntd_death[audio]`). smbone and smbtwo are the plain cases: ordinary melee packet, collector, and an `NpcEffect` buff (17 s and 32 s) that on finish leaves a 30-second `funlive_npc_angry_effect` marker.
- Bodies resolve to existing skeletons (for example `enemy_1159_swfmob`, `enemy_1163_hvymot`, `enemy_1259_durwar`), so the clock wrapper must name the source skeleton, as `funlive-caster-animations.mjs` does, and the models import as explicit aliases.

### Hui-Ming (yin-yang) family: account and tile controller built, five records left

The user approved building the shared attribute system on 2026-11-16. `arkpedia-hui-ming.js` holds the account and sixteen records are admitted (six plain, the Fury pair's opposite-attribute scale as an optional `bonus`, the 'Stabby' pair's opposite-attribute target preference, the 'Blindey' pair's same-attribute blocking through `pairedBlockerBuffs` with several pairs, the 'Smarty' pair's blasts through `huiMingBlast`, and the 'Envy' pair's charged tile shift through `huiMingChargedShift`); see `docs/ENEMY-HUI-MING-REVIEW.md`. The remaining five `talent:yinyang` records: the 'Envy' variant `15081_dqmage` (not inspected; check for the other-mode `Trace` components first), the 'Free' boss (`1517_xi`, `5054_dqxi`), and `15008_dqspsb` and `15082_dqklr`, which carry extra `Trace` and `TargetSelector` components of another mode (24 records list `talent:Trace` as missing). Extend `'talent:yinyang'` in `enemy-features.js` per family; `huiMingAccountNative` and `huiMingBlackboard` are exported for that. Operator attributes come from stage tiles and devices, which is stages-phase work.

The 'Smarty' pair is admitted; its source facts and boundaries are in `docs/ENEMY-HUI-MING-REVIEW.md`.

**Hui-Ming tiles (user approved building the tile system on 2026-11-16).** `arkpedia-hui-ming-tiles.js` is a battle-level controller: `installHuiMingTiles(b,{marks:[{row,col,mode,same,diff}],switches:[{row,col}]})` and `flipHuiMingTileUnder(b,unit)`. Nothing installs it on a real stage yet. Stages-phase work to finish it: retain the three tile prefabs (`tile_yinyang_road`, `tile_yinyang_wall`, `tile_yinyang_switch` in `battle/prefabs/[uc]tiles.ab`) through `extract-device-native-source.py` as Reeds did, read each mark tile's `dynamic` and scale blackboard from the stage tile legend (34 source stages use these tiles, 11 of them the switch tile), and install the controller from stage compilation. `tools/arkpedia/fetch-pinned-bundles.mjs 'battle/prefabs/[uc]tiles.ab'` fetches the bundle. The 'Free' boss has not been inspected.

The private inspections named in earlier versions of this file lived in the old container's ignored cache and are gone. Re-extract with `tools/arkpedia/inspect-native-enemies.py` when needed; they were inspection aids, **not admission**.

### Siracusan Civilian findings and blocker

- `enemy_3004_speople`: applyWay NONE, no damage, lpr 0, HP 3,000. `Passive.speople_modify_vg.sp = -1`, `Passive.speople_dead_vg.sp = 40`.
- Native `speople_t` has one-second periodic selected SP changes and a killed gift. It strips blackboard prefixes by child buff key.
- **Native root side is 2 (ally)**. Do not admit it as an ordinary hostile enemy just to increase coverage. Allied route actors need correct movement, targeting, exit and death/passive lifecycle handling first.
- Current `leak` requires enemy side, and ally removal clears nonpersistent buffs before the death event. Those are material boundaries for an allied route actor. Existing legacy `friendlyUnit` only marks an enemy profile friendly; it does not by itself establish native allied NPC behavior.
- Signed SP adjustments are not yet supported by the portable program/provider contract.

### Native Blood Debt controller, stages phase

- `trap_092_vgctrl` / `sktok_vgctrl` are privately inspected but **not admitted** or present in committed device source.
- Root native side 2, TRAP category, tag `vgctrl`, invincible/unhealable, no withdrawal, hidden HP bar.
- Skill: AUTO, duration 35, SP cost 500, initial SP 0/300/400 by skill level, time increment 3.
- Same-side DEFAULT global aura `vgctrl_s[aura]`: HP +0%, ATK +20%, DEF +15%, removed on detach.
- Immediate `vgctrl_call_bro` invokes `MoveNextLevelBranch` with loop true and blackboard branch ID `vgctrl_bro`. Existing `StageBranchScheduler` has start/summon operations but no next/loop branch cursor. Implement that generic operation once; do not hand-code individual Il Siracusano stages.
- Source generation entry points are `tools/arkpedia/stage-device-source.mjs` and `extract-device-native-source.py`.

Other previously inspected, still gated families include racing actors, Carnevale conditional targetability, Blighted-area pollution actors, dream tile/link actors, and special scenario dummies. Empty handbook text is not evidence that their native controllers are inert.

## Reproduction and guardrails

- **Never edit `tools/arkpedia/public-review-server.mjs`.** Verified SHA-256:
  `127fb1b74be89d0a35e6bfa4e3d35927d170fa4d3129287f6c523114c5bcaa22`.
- Preview is `http://127.0.0.1:3185` (`HOST=127.0.0.1 PORT=3185 node scripts/start-arkpedia.mjs`); do not touch ports 3182–3184.
- Python: the venv built above (`.cache/arkpedia-venv/bin/python`; `/workspace/.venvs/arkpedia/bin/python` in the old container). Animation wrappers need `ARKPEDIA_PYTHON` set to it; system Python lacks Unity extraction dependencies.
- Canonical source data: the sibling `arkpedia-data/source/data` checkout; native bundles: `.cache/arkpedia/cn-native-source`.
- Prefabs are pinned CN; retained buff templates are pinned Global. Do not silently replace the template source with CN.
- `nativeComponents` groups only non-referenced components by name. Use `$ref` and `$siblings` for referenced components. `$ref` ignores file ID, so source gates must explicitly require local references where appropriate.
- Source gates/clock files must be added to the support/runtime-plan input hash lists.
- Generators run sequentially:

```sh
set -e
node tools/arkpedia/enemy-support.mjs
node tools/arkpedia/enemy-runtime-plans.mjs --write
node tools/arkpedia/native-buff-programs.mjs --write
```

- If a shared source contract used by device compilers changes, their source digest may become stale. An enemy-only talent helper was deliberately kept in `enemy-talent-binding-contract.js` so adding it did not invalidate device compilation through `enemy-outcome-contracts.js`.
- Natural buff expiry calls `onExpire`, not `onRemove`; `_tickBuffs` invokes a due pulse before expiry. A five-second/one-second buff can emit five pulses.
- Independent same-key buffs need an explicit high `maxStacks` when they must coexist; default max is one and can evict the older instance.
- Use `grid.setTile` to replace a tile in tests; legend tile objects are frozen/shared.
- Node `--test` can ignore nonexistent file arguments. Find actual test paths with `rg --files test` before running a batch.
- Avoid printing/diffing huge compact JSON or grepping a full one-line JSON document. Parse it and print bounded summaries.
- Do not rehash historical review receipts after later source changes. Their hashes describe their reviewed commit. Later broad-test completion may be added as a separate verification field without rewriting source hashes.
- Use `set -e` for check/commit command sequences. Do not stage ignored native caches, virtual environments, temporary logs or credentials.

### Focused checks and broad baseline

```sh
set -e
node --test test/arkpedia-famiglia-limos.test.js
node --test test/arkpedia-enemy-runtime-plans.test.js test/arkpedia-enemy-runtime-loading.test.js
node tools/arkpedia/enemy-support.mjs --check
node tools/arkpedia/enemy-runtime-plans.mjs --check
node tools/arkpedia/check-stage-library.mjs
```

Broad suite when justified by shared changes:

```sh
node --test --test-concurrency=2 test/sim/*.test.js test/content/*.test.js
```

### Native inspection, models and browser review

```sh
$ARKPEDIA_PYTHON tools/arkpedia/inspect-native-enemies.py \
  --enemies enemy_1284_sgprst --out .cache/arkpedia/agenir-native-inspection.json
```

For a new family, add exact retention scopes to `extract-enemy-native-abilities.py`, extract, then create an animation wrapper using verified skeleton IDs and the actual art bundle. Recent Famiglia bodies use `refs/arts/enm_art_11.ab`; prefab bundle numbering does not imply art bundle numbering.

```sh
$ARKPEDIA_PYTHON tools/arkpedia/extract-native-enemy-models.py \
  --ids .cache/arkpedia/FAMILY-ids.json \
  --out .cache/arkpedia/FAMILY-models --native-bindings
```

Import into the asset repo with `scripts/import-original-models.mjs`, validate with `scripts/validate.mjs`, commit/push main, then publish the exact commit in the simulator:

```sh
node tools/arkpedia/enemy-artwork.mjs --commit ASSET_COMMIT \
  --ids .cache/arkpedia/FAMILY-ids.json --write
```

Artwork publication also updates MVP/operator metadata and writes new enemy definition objects. Include those generated files, but do not republish pinned stage graphs during the enemies phase.

The old container's ignored review helpers are gone. Committed replacements: `tools/arkpedia/review-enemy-artwork.mjs` for galleries (`ARKPEDIA_REVIEW_ORIGIN`, `ARKPEDIA_REVIEW_CHROME`, `ARKPEDIA_REVIEW_IDS_FILE`, `ARKPEDIA_REVIEW_OUT`) and `tools/arkpedia/review-father-agenir.mjs` as the template for a controlled battle fixture: it serves the app through `public-review-server.mjs`, injects one compiled enemy record before the battle starts, deploys a benched operator as the target and drives the battle from the page. A plain ally-side device is not a valid enemy target. Run them headless against the preview on port 3185; on macOS set `ARKPEDIA_REVIEW_CHROME` to the Chrome binary. Inspect the screenshots explicitly.

The public native research checkouts under `/tmp` belonged to the old container. If they are cloned again: prefer small known `git show` paths; broad promisor searches can trigger large fetches. Declaration dumps are not method bodies, archived static evidence is not fresh native extraction, and neither establishes live hotfix/frame parity.
