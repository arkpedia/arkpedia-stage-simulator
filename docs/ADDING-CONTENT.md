# Adding simulator content

Start with one operator or one reusable enemy, device, terrain or rule mechanic. Keep its
source evidence, implementation, admission rule and behavior tests in the same
change. Data import alone does not establish support.

Device source compilers stay outside the battle import graph. After changing
their contracts, run `npm run content:devices` to regenerate the shared compact
definitions, then `npm run content:devices:check`. Content publication refuses
stale definitions. See [DEVICE-RUNTIME-REVIEW.md](DEVICE-RUNTIME-REVIEW.md) for
the atomic factory registration and source/runtime equivalence checks.

Original wave clocks and predefined operator/card activation are shared source
contracts; see [STAGE-CAPABILITIES-REVIEW.md](STAGE-CAPABILITIES-REVIEW.md).
Individual-stage mode settings use the common validated preparation flow and
clone cached records before applying modifiers; see
[STAGE-MODE-RULES-REVIEW.md](STAGE-MODE-RULES-REVIEW.md).

Stage modifiers belong in the shared rule compiler and a reusable runtime
handler, not in per-stage battle branches. Native modifier IDs use
`shared/arkpedia/stage-native-rules.js` and one checksum-pinned evidence file.
Enemy talent parameters opt into overrides/multipliers on their feature
declaration. Character HP/DEF multipliers and Block additions use `stage-character-attributes.js`
across operators, summons and devices. See
[the rule review](STAGE-NATIVE-RULES-REVIEW.md) for current contracts and limits.

Original rule evidence can be explicitly refreshed with
`npm run content:rules -- <slug> --apply --refresh`. The compiler selects a
separate original level for adverse environments; only variants that share a
level reuse the parent. Refresh writes new immutable evidence, checks the old
binding's checksum under the shared publication lock, and atomically replaces
that binding. It does not publish or refresh a playable stage. After resolving
the shared capability blockers, run `npm run content:library` to compile all
compatible stages. Use `content refresh stage <slug> --apply` only to update a
legacy regression fixture. Batch evidence imports also accept `--refresh`; downloads may run
concurrently, while guarded binding publication is serialized.

When an existing variant incorrectly retains parent routes/waves, preview
`content refresh stage <slug> --routes` before adding `--apply`. This explicit
path replaces routes, wave schedules, enemy configurations and their compiled
pathing together. Tile grids, terrain, supplied units, devices, artwork and
catalogue visibility must stay unchanged. It checks the geometry/pathing hash,
rechecks source bytes under the same lock, and records a route-refresh receipt.

## Inspect an addition

```sh
npm run content -- plan operator char_002_amiya
npm run content -- plan enemy enemy_1040_bombd
npm run content -- plan stage 5-4
npm run content:inventory
```

Stage planning uses the adjacent `arkpedia-data/source/data` checkout. Set
`ARKPEDIA_CONTENT_SOURCE` to another source directory for content commands and
inventory generation. Operator/enemy plans work without the stage checkout.
The inventory identifies the source commit and hashes the files it reads, so
local source changes remain distinguishable even at the same commit.

## Operators

1. Retain the operator and skill source records at the pinned target revision.
   `data/arkpedia-roster-target.json` identifies the target; the snapshot builder
   is `tools/arkpedia/build-mvp.mjs`.
2. Implement behavior in a focused module under `server/sim/content/`. Reuse the
   existing targeting, skill, summon and resource lifecycle helpers. A module's
   `customize`/`install` hooks must return immediately for unrelated operators.
3. Register deployment hooks once in
   `server/sim/content/arkpedia-operator-runtime.js`. Order is explicit: all
   customization hooks run before the unit is set up, and installation follows
   setup. Keep lifecycle and squad hooks in their existing integration points
   when the mechanic needs them; this registry does not replace those hooks.
4. Admit only implemented skill IDs in `shared/arkpedia/operators.js`, regenerate
   the snapshot when its source selection changes, and test the actual mechanic.
   Include withdrawal, death, redeployment and summon ownership where applicable.
   Keep source review notes in `docs/<NAME>-REVIEW.md`. A new roster entry needs
   every source skill, promotion cap, rank unlock, public test and review document.
5. Run the focused tests and `test/arkpedia-operator-runtime.test.js`, which sweeps
   every admitted skill through deployment and a short activation attempt. The
   sweep catches dispatch errors; per-skill tests establish behavior.

## Enemies

1. `npm run content -- plan enemy <id>` reports missing skill/talent/handbook and
   native component coverage. Records and database levels live in
   `data/arkpedia-enemy-records.json`.
2. Prefer a reusable feature in `shared/arkpedia/enemy-features.js`. Its `covers`
   predicate must recognize the reviewed parameter signature and native behavior,
   not simply a matching skill name. Native claims account only for components
   the implementation actually handles.
3. Add the runtime factory in `server/sim/content/enemies.js` or the regular
   feature runtime. Factories may return an ability or an ordered ability array.
   The runtime attaches each ability through the common dispatchers.
   For a family-specific handler, declare `matchesRecord(record)` alongside
   `covers(record, native)`. Runtime dispatch and spawn-dependency collection
   use that lightweight match before reading family parameters or animation
   clocks. Skill names such as `PowerAttack`, `charge` and `MultiAttack` occur
   in unrelated families; the name alone must not select their implementation.
   The match does not replace the native admission predicate.
4. Keep source evidence through `extract-enemy-native-abilities.py` when native
   fields are needed. The extractor verifies the downloaded bundles against
   their pinned hashes; support generation verifies retained components against
   the native timing index. Do not edit evidence to make a predicate pass.
5. Add behavior and refusal tests. `test/helpers/enemyHarness.js` exercises the
   feature dispatch without requiring a real stage. Use the Bombtail addition
   (`test/arkpedia-bombtail.test.js`) as a compact example.
6. Regenerate support with `node tools/arkpedia/enemy-support.mjs`, then run the
   relevant tests and `npm run check:arkpedia-enemies`. The derived registry
   automatically includes every covered database level and transitive spawn
   dependency. Do not edit generated support decisions by hand.

Managed delayed enemy summons can use
`battle.stageWaveScheduler.scheduleSummon(source, delay, spawn, options)`.
Capture the intended route/position before scheduling; return the emitted unit
or array from `spawn`. The timer and children keep the source's wave ownership
after source death or a wave timeout. `dontBlockWave` affects wave clearance;
final victory and planned kill credit remain separate. A summon that starts
in an existing hit-count form can call `enterEnemyHusk(battle, child)` after
spawn. This selects the shared lifecycle without a synthetic death, cleanse
or extra rebirth immunity interval.

### Shared enemy artwork

Keep body files in `arkpedia-sd-assets`, once per original model. The extractor
`tools/arkpedia/extract-native-enemy-models.py --ids <JSON-array> --out <directory>`
prepares checksum-verified native skeletons, atlas pages and source receipts.
Import the per-bundle receipt with the SD repository's
`scripts/import-original-models.mjs`, run its tests and validator, and pin an
immutable SD commit. Ambiguous models remain pending rather than borrowing a body.

Adopt one or more exact IDs with
`node tools/arkpedia/enemy-artwork.mjs --commit <SHA> --ids <JSON-array> --write`.
Without `--write`, it validates the proposed addition only. It rechecks committed
file hashes and original animation metadata, preserves existing models and
combat data, and rejects conflicting replacements. The persistent
`data/arkpedia-enemy-artwork.json` registry survives snapshot rebuilds. Each JSON
replacement is atomic; rerunning completes an interrupted snapshot refresh.
The renderer uses the model's own asset pin and replaces a temporary marker when
streaming finishes. No per-stage copy or code branch is needed.

Device bodies follow the same process with
`extract-native-device-models.py --ids <JSON-array> --out <directory>` and
`device-artwork.mjs --commit <SHA> --ids <JSON-array> --write`. The separate
`arkpedia-device-artwork.json` registry feeds the same shared body verifier and
lazy component store. A device has one `default` body, selected by device identity,
regardless of faction. An explicitly reviewed operator-style native facing still
takes precedence. `stage.devices` supplies the model dependencies; do not add
stage-name conditions, duplicate facings, or copy files into the simulator.
`ARKPEDIA_REVIEW_KIND=device` selects device models in the shared artwork review.

When adding or changing an operator adapter, register it in
`server/sim/content/arkpedia-operator-runtime-eager.js`, then run
`npm run content:runtime` and its freshness check. Simple source identity/family
guards let the generated index load that adapter only for selected operators;
other shapes remain shared until explicitly reviewed. Keep validation and
behavior in the same source module.
Put the family guard before reading skill or talent fields in every registered
hook. Reuse the existing shared operator registry rather than maintaining a
second ID list. The index also recognizes the shared `REGULAR_SUMMONS` registry.
The browser-facing deck API lives in `arkpedia-summon-deck.js`; keep operator
controllers and their evidence in the prepared owner path. Legacy summon
installation may bind `sourceToken`, `createToken` and `installToken` to the
current deck state. Do not retain those callbacks across owner redeployments.

For specialized summons, mark `ownerFactory: true` in the shared summon record
and install `unit.mem.regularSummonFactory` in the owner's guarded adapter. It
receives `(battle, state, row, col, direction)` and returns the native token;
shared placement owns payment, stock and cooldowns. Do not add a static owner
import or identity branch to the shared placement dispatcher. Optional
`regularSummonPlacementKeys(owner)` and
`regularSummonAllowsEnemy(battle, owner, row, col)` callbacks carry placement
exceptions. Factory-specific optional arguments need an explicit wrapper.

For squad-wide effects, declare source-owner IDs and exports in
`arkpedia-operator-service-index.js`. The current battle's service table chooses
the actual implementation or the declared neutral behavior, independently of
which modules previous squads cached. Preserve the established call order and
add a real cross-operator test; an individual owner's test cannot prove a squad
bonus. Keep native source contracts inside their owning module.

The SD importer reuses byte-identical bodies through explicit `assetAlias`
references while retaining each enemy's original roles and source receipt.
Use `--reuse-files` when adopting such a relocation of an existing model: it
accepts only unchanged file hashes, metadata and provenance. Older asset pins
remain readable. `--native-bindings` on the extractor resolves variant folders
and animation names through the original prefab's pointers; it also respects
the native material's alpha-texture switch.

`tools/arkpedia/review-enemy-artwork.mjs` exercises registered model loading,
every clip's finite pose and idle galleries in desktop/touch Chromium.
`tools/arkpedia/asset-coverage.mjs` reports remaining stage artwork gaps using
the renderer's exact prefab aliases. Artwork availability does not imply combat
support or native visual/frame parity.

## Stages

The primary browser catalogue is generated from source stages and implemented
capabilities. Adding a source stage that uses existing mechanics requires no
per-stage JavaScript, copied enemy records, or manual catalogue entry. For a new
mechanic, add its source contract, shared compiler/runtime handling and behavior
tests together; then rebuild and validate the library:

```sh
npm run content:library
npm run content:library:check
```

The library report lists each remaining capability and its affected stage IDs.
Use representative normal/challenge and interaction tests to check mechanics;
the short all-stage smoke check alone does not establish full game fidelity.
Immutable geometry, pathing, enemy definitions and stats are shared by hash.
Original wave programs are separate shared components too. Planning and library
builds verify native action timing and route identity before admission; implement
new action lifecycles in the shared scheduler rather than adding independent
per-stage timers. See `STAGE-WAVES-REVIEW.md`.
Deploy the manifest and its objects together, retaining old objects for clients
that already loaded an earlier manifest. Artwork keeps explicit model aliases.

Original level receipts remain provenance inputs. The following commands import
that evidence or maintain legacy fixtures; individual fixture installation is
not required to make a stage available in the new library.

```sh
# Import one original level's rule evidence from the pinned CN revision.
# Add --global to use the pinned Global revision. Omit --apply for a preview.
npm run content:rules -- <slug> --apply
# Preview missing evidence for otherwise unblocked stages; --all includes modes.
npm run content:rules:batch -- --all
# Import evidence in bounded, resumable batches. This does not publish stages.
npm run content:rules:batch -- --all --apply
# Inspect dependencies and run a short smoke simulation without writing.
npm run content -- add stage <slug>
# Compile, validate, smoke-test, retain provenance and publish a test-only entry.
npm run content -- add stage <slug> --apply
```

Every new combat stage, including normal difficulty, requires original rule
evidence. The importer resolves the original filename through the pinned game stage
table, or an exact pinned tree path for mode-only levels. It verifies the table
and level bytes against their Git blob hashes,
records SHA-256 receipts, and preserves the exact rune array (including `null`).
Explicit original `maxPlayTime` values are retained too: -1 removes the regular
stage's five-minute default, and positive limits remain enforced. Older source
levels without that field retain the legacy default until separately reviewed.
A new build with a wave at or after that default deadline is refused until its
original timing is supplied, so an unreachable final wave cannot be published.
It never overwrites an existing receipt or publishes a stage. Unsupported runes
are retained as blocked evidence; implementing their effects remains necessary.
The cached source tree/table and original level blobs live under `.cache/arkpedia/`
and are not additions to the public content catalogue. Downloads are verified
again on reuse; concurrent normal/challenge imports share the same download.

New receipts use small schema-2 stage bindings. Their exact rune/options/source
record is retained once under `data/stage-rules/levels/<sha256>.json`, shared by
normal and challenge variants. Both the binding and shared level are checked
again before a stage addition commits. Existing inline receipts remain readable.
Publication uses exclusive atomic links: interrupted imports cannot leave a
partial binding or overwrite prior evidence. `--limit=N` bounds pending imports;
rerunning skips existing verified bindings and reports individual failures.

Reusable challenge rules currently cover global life, enemy HP/ATK/DEF/movement,
weight additions, attack-range multipliers, literal enemy-ID stat selectors,
operator exclusions, deployment-limit/initial-DP additions, legacy natural-DP
interval multipliers and explicit hidden-group activation.
New rule families belong in `shared/arkpedia/stage-rules.js`, with strict mask
and parameter validation plus tests of the resulting battle behavior. Keep
inactive difficulty rules inactive and retain unsupported active rules as blockers.
Normal-only rules are active on normal stages. Easy/six-star rules in a shared
level remain inactive on normal/challenge; their modes are not thereby admitted.

The addition command refuses missing enemies, unsupported devices/tokens/modes,
unresolved conditional waves, invalid routes and unknown enemy overrides. It
uses the same compiler as the coverage report. It creates one stage file, then
atomically replaces the catalogue: the catalogue is the publication point.
Source hashes are checked again before publication. Existing files and entries
are never overwritten. A failure before publication removes the newly created
file and releases the writer lock.

Active Originium is a reusable terrain feature. The stage compiler retains its
per-level damage, ATK, ASPD and duration instead of using another mode's defaults.
Missing parameters and mixed strengths are refused until their semantics are
reviewed. Add future terrain features through the terrain compiler and runtime,
with tests for entering, leaving, airborne units and deployment lifetimes.

A process or machine crash can leave an unlisted file and
`data/.content-add.lock`. Confirm no writer is running, inspect the orphan and
catalogue, then remove only the abandoned lock/file or finish the reviewed
addition manually. This is an append-only publication protocol, not a transaction
across the entire filesystem. Other catalogue writers should not run concurrently.

Review at `/arkpedia/?experimental=1&stage=<slug>`. Check the full wave schedule,
routes, placement, supplied units, stage rules, special mechanics and a complete
battle. Challenge variants require a per-stage receipt under `data/stage-rules/`.
Retain the exact original level's runes and immutable source hash, then add a
compiler for any unimplemented rune. The 5-4 Challenge receipt and
`test/arkpedia-stage-rules.test.js` demonstrate both successful
compilation and refusal of unknown keys, masks and mismatched identities.

Hidden groups are not automatically active. Retain a normal-stage rule receipt
as well when the original level enables a group only in Challenge. PS-3 and SE-5
show this pattern: normal compilation excludes their `raid` enemies, while
Challenge includes them and applies the stat/life runes. A group whose activation
is not established by the receipt remains blocked. Random packs and branches
still need their own controller implementation. See `docs/STAGE-RULES-REVIEW.md`.

A local rule receipt's hash is checked again at publication, just like source
geometry. A ten-second smoke run establishes loadability only. Review challenge
variants against their own source; sharing geometry does not establish matching
rules. After review, remove `testOnly` and set `reviewed: YYYY-MM-DD` in the
catalogue. Record the review evidence in the stage's `contentAddition.validation`.

## Finish the change

```sh
npm run check:arkpedia-enemies
npm run check:arkpedia-stages
npm run content:inventory -- --write
node --test test/arkpedia-content-addition.test.js test/arkpedia-remaining-doc.test.js
```

Also run the focused behavior tests and existing tests for affected shared
mechanics. Commit the implementation, evidence, tests, stage file(s), generated
registries and inventory together. The generated `docs/REMAINING.md` separates
public, developer-only, ready and blocked stages, including all source modes.
Never use an admission bypass to reduce its remaining counts.

CI remains on GitHub-hosted Ubuntu/Windows runners for Node 22 and 24; the
runner-policy test forbids self-hosted labels. Feature-branch pushes do not
start CI; pull requests do.

## Enemy source channels and stage-local variants

`data/arkpedia-enemy-record-sources.json` pins both original table pairs by
commit, Git blob and SHA-256. `npm run content:enemy-records -- --fetch --preview`
verifies/cache-downloads the inputs without replacing the catalogue. The same
command without `--preview` rebuilds it; `--check` checks reproducibility.
Global entries take precedence. CN contributes only absent IDs, so an expanded
catalogue never silently changes an existing Global enemy's stats or levels.
Importing records does not admit their behavior; regenerate enemy support after
an import and inspect the remaining native/skill blockers.

A level's `enemyDbRefs` entry with `useDb: false` is a stage-local definition,
not a missing global enemy. The planner verifies the cached original level's
Git blob and SHA-256 and compiles that complete definition. Only reviewed basic
prefabs with compatible attack/movement behavior and no additional skills or
talents are currently accepted. Unsupported local definitions remain explicit
`enemy-alias` blockers. Restore a missing original cache with
`npm run content:rules -- <slug>` (without `--apply`).

The compiled stage carries its own alias map and stats; it never modifies the
global enemy registry. `assetPrefabKey` points to the original enemy model,
and renderer preloading deduplicates those model keys. Two stages can therefore
use the same local ID with different stats while sharing one asset. The atomic
publisher rechecks the original level bytes as well as the geometry and rule
receipts before making the new stage visible.

Stage-specific talent multipliers also belong to a feature's declaration.
Expose a reviewed numeric field through `stageMultipliers` on that feature,
with a validator for the resulting value. The stage compiler changes a private
record copy and refuses undeclared fields, unknown targets, strings and invalid
results. It cannot create a feature or replace a spawned enemy identity.
Current declarations cover Agent block-debuff duration (up to 3,600 seconds)
and positive integral death-spawn counts (up to the shared runtime limit of 20). Add a parameter only
when its shared runtime handles the full allowed range; test real stage
behavior as well as rejection cases.

### Shared device definitions and handbook gaps

Device admission uses `stageDeviceSpec`, including explicit prefab keys when
translated names can collide. For a new static device, retain its original
character/skill/range records with `tools/arkpedia/stage-device-source.mjs`, add
one shared runtime descriptor, and validate the original level instance with
`stage-device-instances.mjs`. Both the original level and shared source file join
the atomic publication recheck. Reuse source range IDs rather than copying tile
arrays; `x-1` is the 13-tile grid used by ice crystals and altars.

Handbook text may omit attack mechanics. Native-only features can require a
reviewed attack/selector/projectile even when the handbook says only “Flying
unit.” The Imperial Artillery Targeteer is such a case. Empty scan effects use
component-level auxiliary admission, rather than a hardcoded ability-count
exception. See the per-family review documents for exact supported semantics.

Existing stages can adopt newly implemented original rules with
`npm run content -- refresh stage <id>` and then `--apply`. This checks source
hashes and runtime loading, refuses geometry changes, and atomically updates
rule-dependent fields while preserving artwork and catalogue visibility.
See [the card-rule review](STAGE-CARD-RULES-REVIEW.md) for shared cost and
redeployment helpers. New token/card implementations must use those helpers
for display, affordability, payment, refunds and cooldowns.

### Original per-stage enemy parameters

`plan stage` also reads the verified original level's `enemyDbRefs`. The map
export omits talent blackboards, so it cannot establish that an enemy uses its
global defaults. Literal changes go through `stageOverrides` declarations on the
owning feature and `applyStageEnemyBlackboard`; they are applied before challenge
multipliers. Identical numeric/string parameters are harmless; new or changed
identities, duplicate parameters, level mismatches and unreviewed skill/SP changes
are blockers. A new behavior declares and tests its permitted parameters once.
Normal/challenge stages share the existing original blob and global assets.

The atomic publisher retains the original blob digest and checks it again before
writing. `refresh stage` can update already registered records without replacing
reviewed geometry, art or visibility. Keep blocked stages blocked until all of
their original rules and devices are reviewed; do not copy only the convenient
part of a new plan into them.

Manual placed devices retain original level/rank per instance and share their
source records, native prefabs, controller and activation panel. To restore
missing devices on an existing stage, preview
`npm run content -- refresh stage <slug> --devices`, then add `--apply`.
The normal refresh preserves existing devices; the explicit device refresh
keeps geometry, artwork and catalogue visibility and records `deviceRefresh`.
See [MANUAL-STAGE-DEVICES-REVIEW.md](MANUAL-STAGE-DEVICES-REVIEW.md) for the native
contracts and remaining scheduled-spawn/visual limits.

Capturable devices use the same instance import and atomic publication path.
Declare allowed original skill indices in the registry, retain the native
mode/lifecycle contract, and implement the behavior once in its shared
controller. Never copy faction variants or assets into each stage. See
[CAPTURABLE-STAGE-DEVICES-REVIEW.md](CAPTURABLE-STAGE-DEVICES-REVIEW.md) for
Gelato capture and refill, and [ENEMY-AMMUNITION-REVIEW.md](ENEMY-AMMUNITION-REVIEW.md)
for the bounded ammunition account reused by enemy families.

Initial predefined-device activation is resolved by alias against original
instances before matching shared positions. Declare `level_predefines_enable`
in the rule compiler; do not infer faction or activation from display names.
Scheduled activation still needs its own controller. Fixed additive enemy
parameters use `stageAdditions` beside `stageMultipliers`; only declared numeric
slots may change. Mixed arithmetic on the same slot remains blocked until its
native ordering is reviewed.

Level-owned enemy rewards declare `stageInjectedParameters` and
`stageTokenDependencies` on their shared feature. These are explicit typed slots
for original prefab parameters absent from the global enemy table. A stage must
supply the original values and exactly one supported reward card, including its
zero initial stock. String identities cannot silently create new behaviors.
The publisher records the shared token source and timing hashes alongside the
original level; runtime deliveries update the existing card account.

For a full stage-local enemy definition that reuses reviewed feature behavior,
add a bounded entry to `FEATURE_ALIAS_CONTRACTS` in
`shared/arkpedia/enemy-aliases.js`. Declare the native prefab, exact inherited
ability text and talent-group structure, permitted numeric/string parameters,
and the existing native predicate. The compiler keeps original local stats and
parameters, and both compilation and battle startup repeat the shape gate.
The original verified level blob and shared source hashes provide provenance;
`assetPrefabKey` reuses the existing artwork. New skills, unrelated talents,
unknown definition fields and active SP accounts remain rejected. Add a test
that exercises the actual inherited effect, its changed parameter, immutable
base records, and rejected extra behavior before publishing affected stages.

Operator data delivery uses the same immutable component store as stages. After
updating source records or model metadata, run `npm run content:operators` and
`npm run content:operators:check` (the normal source-data builder publishes this
automatically). Declare summon dependencies once in `shared/arkpedia/summons.js`;
the loader and renderer both use them. Keep source build constraints and faction
tags in the generated roster summary, and combat stats in the full record.
Do not add an eager full-snapshot import to a browser runtime module. See
[OPERATOR-LOADER-REVIEW.md](OPERATOR-LOADER-REVIEW.md).

Read level enemy attributes from the verified original `enemyDbRefs`, together
with talent and skill blackboards. Preserve every defined field so unsupported
fields fail validation; do not repair corrupt viewer values with guessed
defaults. The shared compiler canonicalizes cloned geometry before hashing it.
Predefined enable rules resolve original aliases before actor/card activation.
An actor is not a deployment card, and duplicate operator builds must not be
hidden by inventing squad exclusions.

For a native run-facing result, record its exact counter or instance event in
`server/sim/content/arkpedia-stage-outcomes.js` and add a presentation descriptor
to `shared/arkpedia/stage-outcomes.js`. Keep gameplay effects in shared enemy
controllers and gate them with the retained source actions. Do not invent a
wallet deduction or return timer from handbook wording. Verify event filters,
targeting, duplicate removal, restart isolation and result presentation; see
[STAGE-OUTCOMES-REVIEW.md](STAGE-OUTCOMES-REVIEW.md).

The native extractor automatically retains passive helper candidates for
single-mode enemies with no handbook abilities, talents, skills or wrappers.
Candidate intake is not admission: the existing exact auxiliary classifier
still decides support from the retained component and template semantics. See
[ENEMY-AUXILIARY-INTAKE-REVIEW.md](ENEMY-AUXILIARY-INTAKE-REVIEW.md).
For mode-local talents, retain and verify the original component ancestry;
the presence of a database blackboard alone does not make a talent global.

Keep runtime data compact. Shared gameplay constants can be checked against
the retained native evidence by source predicates, as with the two Flux ranges.
Do not import a whole research evidence file into browser controllers for a
few values. Run `tools/arkpedia/runtime-footprint.mjs` and the demand-loading
browser review after changing that dependency graph.

Enemy artwork adoption (`enemy-artwork.mjs --write`) updates both the compatibility
snapshot and the lightweight operator/model index. The immutable model component
must be present before the new index is published; callers do not need a separate
operator-library rebuild. Verify an actual stage with the on-demand loader as
well as the snapshot artwork gallery.

Firelight additions demonstrate composing behaviors across source records:
`emberRebirth` owns hit-count/revival forms, `burningReedsAttack` owns the shared
terrain predicate and optional Sanctuary, `chargedAttacks` chooses projectile
payloads, and `chargedMeleeSequence` consumes an atomic list of animation events.
An enemy adapter supplies native-checked parameters and presentation clocks;
`StageReeds` alone owns tile state transitions. Stage imports resolve these
capabilities and shared model records automatically. Keep original source gates
and tests beside each new adapter; do not add a stage-ID switch for an enemy
behavior or duplicate a model for its alternate form.

Native `TriggerEnvSystem` actions dispatch through `triggerStageEnvironment` in
`arkpedia-stage-environments.js`. Keep the source unit, environment key and
optional event name; level-owned controllers subscribe to
`stageEnvironmentTrigger`. A dispatcher is not an environment implementation.
A source level requiring an unimplemented controller must remain blocked by
stage admission even if an enemy's dispatch action is implemented.

For timed objectives, use a simulation-time `stageDeadline`, not a browser timer
or fake enemy escapes. The end check resolves actual clearance before deadline
failure. Source environment admission must prove the objective and wave shape;
`strife_mode_feature` currently accepts only a single immediate kill-all wave.
Multi-wave deadlines require their own reviewed transition contract.

Security Service danger uses `shared/arkpedia/stage-danger.js` and
`server/sim/content/arkpedia-stage-danger.js`. Add source parameters to that
contract with original evidence and tests; do not encode a stage ID or copy a
second wave clock. Percentage attack speed uses `aspdPct`, independently of
flat `aspd` and final `aspdMul`. Environment support does not remove the mode's
separate card/deployment capability gate; see `STAGE-DANGER-REVIEW.md`.

Dormant Power Armor is another example of composing a stage from reusable pieces:
`stage-power-armor.js` admits device/skill source, the instance compiler binds
`branch_id` and `action_index`, and `StageBranchScheduler.summon` supplies the
reviewed route plus initial HP ratio. Driver death and Engineer repair are enemy
features, not stage scripts. Add a new device variant through its exact source
contract and ordinary instance binding; do not copy DV-6 or duplicate model files.
See [the Power Armor review](STAGE-POWER-ARMOR-REVIEW.md) for current limits.

Persistent enemy traps use `addEnemyTileTrigger` for a finite, source-independent
projectile lifecycle and `enemyTileTriggerAt` for tile exclusion. Content supplies
selection and payload callbacks, not a new placed actor or per-stage timer.
`timedEnemyCasts` supports an explicit `cooldownFromEnd` policy and `canCast` guard;
existing callers retain their previous cooldown policy. Keep placement, damage,
stacking and native admission in the enemy feature, and use the common marker
until its original effects have been reviewed.
