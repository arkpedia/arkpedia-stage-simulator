# Stage simulator handover

Updated 2026-11-16. **Work is paused at the user's request.** The user asked to stop, create this file, and commit everything. Do not resume implementation until asked.

## Goal and agreed direction

Build a lightweight, complete stage simulator that can replace the current simulator. Finish **all enemies first, then stages**, using reusable mechanics and loading a stage's elements instead of hand-coding each stage. Earlier scope also included operators. Completion has **not** been reached.

When resumed, continue between completed batches without asking whether to continue, and commit/push regularly. The user dislikes small checkpoints that end the turn. Ask for input only for material architectural decisions that need it. Already approved:

- Individual stages with configurable mode rules for Integrated Strategies, Reclamation Algorithm and multi-floor modes; not whole-run progression.
- Explicit shared-model aliases for byte-identical artwork.
- On-demand operator data and enemy/device behavior loading.
- Expansion of the shared native buff compiler into validated portable programs.

## Repositories and saved state

- Simulator: `/workspace/arkpedia-stage-simulator`, local branch `work`, push target `origin master`.
- Assets: `/workspace/arkpedia-sd-assets`, local branch `work`, push target `origin main`.
- Latest implementation commit: **`5d685947`**, `Implement blocked Limo death modes and original passengers`, already pushed to master.
- Latest asset commit: **`fb6623a5eb205ff461037ee23fe178cdb327db42`**, original Limo models, already pushed to main.
- Both working trees were clean before adding this handover. No pending Father Agenir implementation was started.
- No PR was created. No subagents were used; current instructions prohibit spawning them without an explicit request.

Use normal Git pushes, not manual Git blob APIs:

```sh
set -e
git -c credential.helper='!gh auth git-credential' push origin HEAD:master
```

Use `HEAD:main` in the asset repository.

## Current coverage and verification

- **768 / 2,163 enemy records admitted; 1,395 remain.**
- **833 database levels**, **213 runtime kinds**.
- **970 published stage graphs** remain pinned for the stages phase. This is not a count of fully certified stage clears or the remaining stage backlog.
- Asset repository: **3,843 complete models**; simulator original enemy artwork catalogue: 561 models.
- Latest Limo focused suite: **111 passing tests**, including raw/compiled combat equivalence across all 833 admitted levels.
- After adding a real displaced-hole regression, the complete Limo family suite passed **14/14**. This last change added the existing `deathByFall` check to the new Limo controller; it did not change core displacement.
- All 970 published stage graphs passed ten-second constructor/runtime smoke. These are **not original-stage clears**.
- Latest broad run was the Caster batch: **1,806 tests, 1,801 passes, 3 skips, 2 known failures**. Both known failures are in `test/content/feedback1d-solvent.test.js`, lines around 234 and 460, and concern stale Chimera pollution aura/SP expectations. Do not describe this baseline as fully green.
- Desktop and touch browser fixtures and original-body galleries passed for each completed family. Fixtures use controlled battles on compiled 0-1 geometry and explicit SP receivers/aura markers; they do not certify the native Blood Debt controller, original-stage clears, effects/audio or frame/pixel parity.

Detailed source hashes, validation scopes and browser receipts are committed in `data/arkpedia-*-review.json`, with explanations in `docs/ENEMY-*-REVIEW.md`.

Useful latest local logs:

- `/tmp/famiglia-limos-focused.log`
- `/tmp/famiglia-limos-tests-final.log`
- `/tmp/famiglia-limos-stage-smoke.log`
- `/tmp/famiglia-limos-browser.log`, `/tmp/famiglia-limos-browser-touch.log`
- `/tmp/famiglia-casters-focused.log`, `/tmp/famiglia-casters-broad.log`

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

Earlier work in this same ongoing effort includes Paramilitary Axemen (`3b0ed249`), Blocker drones (`234b3744`), Radioactive Originium Slugs (`842c7462`), shared native energy programs (`321dedb7`), Paramilitary Snipers (`96a4121d`) and shared stage-result overload logging (`57caa46c`).

## Important implementation boundaries

### Shared programs and runtime loading

- Build/source bridge: `shared/arkpedia/native-buff-programs.js` reads retained native evidence and compiles once. Browsers receive portable component graphs/references, not source templates or the native compiler.
- `shared/arkpedia/behavior-native-compiler.js` accepts a strict native dialect. `shared/arkpedia/behavior-program.js` validates the full bounded graph and blackboard before execution.
- Prepared programs expose `requiredServices` and `validateServices(allowed)`. Every consumer must declare supported services before actor traits attach. Energy-only consumers must not silently accept SP programs.
- Resource operations currently include signed bounded integer `energyAdd` on the root owner and **nonnegative target-bound `spAdd`**. Signed SP and owner-bound/native silent SP variants have **not** been implemented.
- New guarded-stat lowering recognizes the exact native absence check followed by one permanent inert stat attachment. It does **not** implement arbitrary STACK merging. A present same-key buff suppresses creation; native `FinishBuffsById` removes all same-key instances. Supported modifiers are ATK percentage, DEF percentage and ASPD, with zero fallback and bounded signed operands. Shared damage operands retain their nonnegative domain.
- The runtime index is `server/sim/content/arkpedia-enemy-runtime-index.js`. Some legacy kinds still route through `enemies.js`; further startup reduction remains useful.
- `ammoAttack` is already implemented in standalone `arkpedia-enemy-ammo.js`, including reusable `enemyAmmo(max, initial)`, but its runtime-index entry still points through the legacy `enemies` module. Repointing it may help the next ammo enemy without duplicating the account.

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

The next contemplated enemy was **Father Agenir (`enemy_1284_sgprst`)**, followed by the Siracusan Civilian / remaining Blood Debt actors and then other enemy families. No Agenir code, retained evidence scopes, model import or animation wrapper has been added yet.

Private, ignored inspections already available:

- `.cache/arkpedia/famiglia-limos-father-native-inspection.json`: both Limos and Father Agenir, hash-verified native prefab inspection.
- `.cache/arkpedia/famiglia-controller-followup-native-inspection.json`: both Casters, both Capos and Siracusan Civilian.
- `.cache/arkpedia/famiglia-blood-debt-native-inspection.json`: Soldiers, Crossbowmen, Intimidators and Silencers.
- `.cache/arkpedia/vgctrl-native-inspection.json`: native Blood Debt device/skill, described below.

These cache files are inspection aids, **not admission**. They are ignored and are not portable Git artifacts. Re-extract if the workspace cache is absent.

### Father Agenir findings

- Record: ranged physical, HP 22,000, ATK 900, DEF 500, RES 40, BAT 4.5, normal range 1.9; silence immune.
- `Passive.sp = 2`, `Passive.attack@def = -300`.
- Native SP/ammo data: maximum 10, initial 10, increment 0. Reuse the existing `enemyAmmo` account rather than creating a second magazine store.
- Two native modes, `Default` and `VG`, with different ordinary attack/selector bindings and empty visual passives. VG attacks use a global selector. Inspect the complete packets before designing the adapter.
- Common checker is `enemy_common_check_vg`, already compiled for the Crossbowmen, half-second polling.
- `enemy_sgprst_vg_add` runs ON_BUFF_START, selects `SelectVg`, and creates a **derived** receiver buff `enemy_sgprsr_modify_vg` (note spelling), template `modify_sp[trigger_with_no_ui]`, infinite lifetime, one-second interval, finished with parent.
- This likely needs reusable selected periodic SP links and a native owner-bound/silent SP program variant. Inspect the exact retained Global template before extending the compiler.
- Existing mode projectile execution is in `arkpedia-enemy-programmed-projectiles.js`; preserve captured packet and target lifetime semantics if extending it for ammo/global range/DEF debuffs.

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
- Preview is `http://127.0.0.1:3185`; do not touch ports 3182–3184.
- Python: `/workspace/.venvs/arkpedia/bin/python`. Animation wrappers need `ARKPEDIA_PYTHON` set to it; system Python lacks Unity extraction dependencies.
- Canonical source data: `/workspace/arkpedia-data/source/data`; native bundles: `.cache/arkpedia/cn-native-source`.
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
/workspace/.venvs/arkpedia/bin/python tools/arkpedia/inspect-native-enemies.py \
  --enemies enemy_1284_sgprst --out .cache/arkpedia/agenir-native-inspection.json
```

For a new family, add exact retention scopes to `extract-enemy-native-abilities.py`, extract, then create an animation wrapper using verified skeleton IDs and the actual art bundle. Recent Famiglia bodies use `refs/arts/enm_art_11.ab`; prefab bundle numbering does not imply art bundle numbering.

```sh
/workspace/.venvs/arkpedia/bin/python tools/arkpedia/extract-native-enemy-models.py \
  --ids .cache/arkpedia/FAMILY-ids.json \
  --out .cache/arkpedia/FAMILY-models --native-bindings
```

Import into the asset repo with `scripts/import-original-models.mjs`, validate with `scripts/validate.mjs`, commit/push main, then publish the exact commit in the simulator:

```sh
node tools/arkpedia/enemy-artwork.mjs --commit ASSET_COMMIT \
  --ids .cache/arkpedia/FAMILY-ids.json --write
```

Artwork publication also updates MVP/operator metadata and writes new enemy definition objects. Include those generated files, but do not republish pinned stage graphs during the enemies phase.

Ignored review helpers are `.cache/arkpedia/famiglia-*-browser-review.mjs` (`--touch` supported) and `.cache/arkpedia/gnawbeasts-art-review.mjs` for galleries. Chromium is `/usr/bin/chromium`, via puppeteer-core; certificate pins are in `.cache/arkpedia/prison-device-browser-review/ca-pins.txt`. Inspect gallery screenshots explicitly. No CUA session is active.

Read-only public native research checkouts are `/tmp/arkbattle-native-research` and `/tmp/arknightsdb-native-research`; file indexes are `/tmp/arkbattle-research-files.txt` and `/tmp/arknightsdb-native-files.txt`. Prefer small known `git show` paths; broad promisor searches can trigger large fetches. Declaration dumps are not method bodies, archived static evidence is not fresh native extraction, and neither establishes live hotfix/frame parity.
