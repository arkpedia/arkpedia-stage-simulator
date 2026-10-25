# Chapter 16/17 behavior implementation

The data source remains `arkpedia/arkpedia-data` at
`79e81a8a872b2ecc592647d81a864ccbf1f8ca06`. The consumer compiles the complete
checksum-verified snapshot (1,901 enemies / 2,125 records), then derives candidate
support. The public enemy catalogue/support files and 597 public stages are
unchanged. Nothing here promotes a stage to public or changes a production pointer.

Stage inputs now pin `arkpedia-data@245d7c601ce3a4a42adcfb84faa1bd1123d507bb`
with producer `arkpedia/arkpedia@7c94fb8516030728586005b01e75620bfc9b4c3b`.
The latest route/harmless-wave continuation below supersedes earlier stage-input
pins and route-only timing claims. Historical runs predate the corrected
synthetic waits/teleports and are not current fidelity evidence.

## Controllers and integration

The miner controller remains in `server/sim/content/chapter16.js`; the other five
base-prefab controllers and their shared environment are in `chapter17.js`.

| Prefab | Implemented behavior | Integration/parity checks |
|---|---|---|
| `enemy_3010_mcreep` | Neutral targeting, independent Medic-range healing, fear damage, nine-tile shadow suppression, ordinary melee against enemies/structures | Healing/range, true damage, neutrality, elemental immunity, target-free Rock Wall damage |
| `enemy_10203_mumag` | Native speed-10 ordinary projectile; marker targeting; 15-second ChargeRift; DEF/channel locks | Marker taunt/deployment priority, flight/repeat timing, interruption, target removal, full cooldown after channel |
| `enemy_10206_muveg` | Delayed ordinary hit; sourceless retaliation; refreshed pollution enhancement | 0.7-second delay/current ATK, separate target lives, pre-mitigation counter, area selection/cap, damage classification |
| `enemy_10208_mucow` | Data-driven taunt and death summon | Seeded placement, occupied/blocked/high/unbuildable/existing-source exclusions, no summon on leak, no-valid-tile behavior |
| `enemy_10210_muwiz` | Native speed-8 splash projectile; threshold shield; forced restoration; LockDamage and final-flat ATK theft | Raw threshold/true damage, protected splash recipient, seven-hit channel, target/control interruption, source cap/target minimum, strongest theft with weaker fallback, cleanup |
| `enemy_10211_murad` | Hidden/revealed model, automatic SP/level/exit, eight swept rays, target-owned pollution, counter-reveal reward | Source-independent born rays/DOT, non-stacking shared pollution, five distance cases, source/target removal and redeployment, ground mode, reveal cancellation, SP restrictions, firewall notification |

Leak Markers run through `installChapter17Devices`, called by `StandardBattle`.
They gain natural SP, accept ChargeRift SP, retain full SP when placement is
impossible, and summon a canonical, harmless, non-counted stationary Leak Source.
A marker cycle identifier prevents a channel from carrying into the next charge
cycle after the marker has summoned. A missing canonical child record is refused.

The source's forced-shield action checks that no other enemy skill is affecting
before triggering GetShield. It ignores skill readiness/cooldown, but does not
replace an active LockDamage. This guard is tested directly against the retained
serialized action, rather than inferred from handbook shorthand.

Pollution is a single target-owned named buff (native DEFAULT override,
maxStackCnt=1, no independent source key). A later application replaces the
previous instance rather than adding another DOT clock. It survives source
removal and is cleared with its recipient's deployment life. ATK-theft reductions
instead use the native strongest-source rule with fallback when a source leaves;
the source retains its already stolen ATK when a target leaves.

`registerChapter17Firewall` connects counter completion to a registered boss
firewall: nearest remaining side, five-second exposure, three clicks, break
callback. Boss attacks, phase transitions and rebirth are separate controllers
and remain unsupported. This integration does not admit a boss stage.

## Admission boundaries

All six base prefabs now clear **candidate** support. The five new contracts
compare the entire retained native component set, action/projectile/environment
closure, ability lines and parameter signatures against a separate reviewed
contract snapshot. Missing/changed native evidence, extra parameters and absent
action closure are rejected. Extraction never rewrites the reviewed contract.
Variants need their own native evidence and review; they are not admitted by a
base-prefab match.

`16-2`, `16-3`, `16-4`, `16-5`, `16-6`, `16-7`, `16-8`, `17-2`, `17-3` and `17-4` are accepted by the experimental runtime candidate registry.
16-2 retains its 42 source spawns and four canonical records. 16-3 has 22 normal
hostile spawns plus unmanaged miner summons, using four canonical records. 16-4
has 17 normal hostiles and four canonical records. 17-2 has 28 normal hostiles
and two canonical records. 17-3 has 24 normal hostiles, one Leak Marker and four
canonical records. 17-4 has 31 normal hostiles, one Leak Marker and four
canonical records, plus source-triggered Rockbreaker children. 16-5 has 26 normal
hostiles, two independent tunnel actions and four canonical records. 16-6 retains
24 scheduled units (21 hostiles and three neutral miners), one tunnel and four
canonical records. 16-7 retains 36 scheduled units (26 hostiles and ten
source-marked harmless miners), seven canonical records and native Commander
orders. 16-8 retains 35 hostiles, one tunnel, four canonical records and the
normal ALL-enabled group0; the Six-Star replacement group1 remains excluded.
All ten require `?experimental=1`, remain `testOnly`, and verify the candidate support
snapshot checksum. No other Chapter 16/17 stage is admitted by this review.

### Device continuation

`extract-ch16-devices.py` now retains the facility, Hidden Tunnel and Rock Wall
prefab graphs and their transitive native template closure. It verifies the token
bundle and template holder against the existing CN inventory, and verifies the
character/skill/range table bytes before retaining their relevant rows. The
result is `data/candidates/arkpedia-ch16-device-source.json`; it supplies evidence,
not admission approval. Enemy records and stage geometry still come from the
canonical `arkpedia-data` flow.

The shadow environment now distinguishes persistent fields from temporary miner
escape. It combines overlapping live-source fields, ends fields with the source
deployment life, and restores shadow when an escape pulse expires. The facility's
21-tile `x-2` field and miner's nine-tile `x-4` escape range are checked against
the retained tables. Miner pulses now update this queryable state, with bounds
checks to prevent an off-map column from aliasing the preceding row. Facility and
Rock Wall structure/miner interaction and Hidden Tunnel branch summons/manual
commands are connected to StandardBattle. The separately reviewed 16-3 build
below exercises them together behind the test-only boundary.

The same extraction retains the complete miner and 10120 graphs, including
selector siblings omitted by the earlier component-only export, and the
`block_mcreep` action closure. 10120 engagement now locks both participants,
releases on range exit or either deployment's removal, and connects each side
to the existing ordinary melee attack pipeline. The acquisition selector includes
the miner's retained 0.1 body collider; the periodic range check separately adds
the native `range_radius_add` of 0.1. This corrects the earlier point-only
acquisition assumption. This matters because the
canonical table marks 10120's generic attack mode `NONE`, while its native
Default/Attack graph supplies a physical attack against marked neutrals.
An isolated integration scenario verifies their independent attack clocks and
damage; the old scenario accidentally installed the feature twice.

10120 candidate support additionally requires the exact reviewed device-source
checksum and parameter signature in `arkpedia-ch16-reviewed-engagement.json`.
The extractor does not rewrite that approval record. Wrapper counts alone or
changed range parameters no longer clear its support gate.

The extractor also retains native CircleCollider2D and Rigidbody2D components.
Both structure StopMcreep children use a radius of approximately 0.8; this is a
separate contact field from the facility's `x-2` shadow range. The physics-only
extension added 17 components while leaving every previously reviewed row,
template and table byte unchanged. The engagement checksum was reviewed for
that additive evidence change; its exact behavior/parameter checks remain.

The original global-buff bundle was then fetched from the same immutable CN
manifest and checksum-verified (`battle/prefabs/[uc]globalbuffs.ab`, SHA-256
`b6c62b7bcc2557d76bd6c04255d783673e0b5506bff71f2204ef017e0b31a9fa`).
The device extractor now retains `mainline16_enemy_target_free` and its action
closure: wait for the first 0.3-second tick, remove invisibility when blocked,
otherwise add/remove it according to the enemy's shadow tile. Existing reviewed
graphs/templates/tables stayed unchanged. The separate reviewed engagement
checksum was updated after that additive comparison, not by the extractor.

`chapter16-structures.js` attaches to the real stage units. The StopMcreep
physics trigger includes the miner body radius, releases on contact exit or
source removal, and handles overlapping owners. Both structures multiply
miner-sourced received damage by five after mitigation, before shields, without
mutating an area attack's shared DamageInfo. Miners use their native attack
selector radius even though the table compiler sets generic MELEE range to zero;
they can select the Rock Wall's TARGET_FREE passive. The facility additionally
owns its shadow field and native control immunities. Cold immunity now passes
through the existing status admission path alongside the other immunities.

Shadow blocks operator placement, backend deployment and manual token placement.
The native periodic invisibility contract applies to enemy-side units; a real
deployed operator blocking a canonical enemy is tested, as are source death,
miner escape, fear stopping escape refresh, and expiry restoring the field.
Every runtime fixture asserts that the battle recorded no swallowed AI/hook
errors. These checks establish controller integration and retained-source parity,
not independent captured-game frame parity or public stage admission.

### Canonical stage route repair

The existing canonical 16-3 export retained original conditional wave indices
10/14 after main-route deduplication and omitted its miner extra route. The
producer correction is draft Arkpedia PR #763 at `d350e087`; the compiler-produced
data preview is draft arkpedia-data PR #44, now at
`84f3c8334db1c505429bce848147b32ca6a1cc20`. Hosted data validation passed and
publication was skipped. The preview uses current dev's normal compiler, so its
generated page-prop/route changes are included; it is not a production release.

`arkpedia-ch16-stage.lock.json` pins all stage inputs, release manifest and route
receipt. `canonical-stage.mjs` uses the shared all-input checksum transport and
then verifies the release inventory and producer/upstream receipts. It retains
the result in `data/candidates/arkpedia-stage-16-3-source.json`, explicitly
`testOnly: true, admitted: false`. Conditional waves use main route 7; the miner
branch separately uses extra route 0 with exact reach offsets and traversal
settings. This source bundle remains unadmitted evidence; the separate reviewed
stage contract controls the experimental build. The enemy snapshot pin remains
unchanged.

The producer at `d350e087` now retains complete level bytes in
`data/simulator/raw/levels/16-3.json`, with an independent upstream receipt in
`stage-levels-source.json`. Its scheduled stage refresh is wired to the pinned
EN checkout, verifies HEAD and clean tracked input bytes, and verifies the full
selection before writing. Both normal content validators passed (838 pages,
8,125 public files, 9,851 source records), as did hosted preview validation.
The consumer verifies this receipt against both the release inventory and the
route receipt's original-level hash. No local fallback level is accepted.

The complete source is necessary: `options.moveMultiplier` is 0.5, and the
`raid` hidden group is enabled by an optional SIX_STAR rune. It is not an
unconditional normal-stage wave. Normal 16-3 has 22 hostile spawns; branch miners
are unmanaged/unharmful summons. The generic pristine-hidden-group helper must
not be used to admit this stage's optional raid enemies.

### Hidden Tunnel continuation

`chapter16-tunnel.js` implements the native summon, host counters, standby/advance
command and independent born buffs, with a required branch-spawn callback.
`chapter16-branch.js` validates the reviewed branch action and uses the complete
canonical extra route, spawn jitter and fractional checkpoint offsets.
StandardBattle installs the preplaced ally tunnel and exposes its manual command.
The UI shows SP, waiting and total miners, preserves keyboard focus and button
bounds, and resets the control on restart. Natural SP, Enter, touch activation,
phone landscape and restart are exercised by the opt-in browser test.

The original `sktok_spawnp` graph is separately retained by
`extract-ch16-tunnel-skill.py` from the checksum-pinned shared skill bundle.
Eight controller/source-parity tests verify natural SP, the first 15-second
summon, three waiting/five total limits, owner-filtered release, no recall on
returning to standby, scheduled retry after a failed summon, source removal,
and separate total/near finish actions. Removing a count manager does not
invent removal of its independent stop buff. These run on the shared battle
with canonical miner records and assert no swallowed hook/AI errors.
SP recovery modifiers/locks use the owner's ordinary stats without changing the
independent summon clock.

```sh
.cache/map-env/bin/python tools/arkpedia/extract-ch16-tunnel-skill.py --check
node --test test/arkpedia-ch16-tunnel.test.js
```

```sh
node tools/arkpedia/canonical-stage.mjs
node --test test/arkpedia-canonical-stage.test.js test/arkpedia-canonical-data.test.js
```

```sh
.cache/map-env/bin/python tools/arkpedia/extract-ch16-devices.py --check
node --test test/arkpedia-ch16-shadow.test.js
```

```sh
node tools/arkpedia/enemy-support.mjs --candidate-ch16
node tools/arkpedia/build-stage.mjs \
  --stage ../arkpedia-data/source/data/stages/16-2.json \
  --geometry ../arkpedia-data/source/data/stage-geometry/16-2.json \
  --candidate ch16 --out data/arkpedia-stage-16-2.json
node tools/arkpedia/stage-index.mjs
npm run test:arkpedia-ch16
```

## Reviewed test-only 16-3 build

`data/candidates/arkpedia-ch16-reviewed-stage.json` is a separate review record
binding the canonical level, native device and native tunnel-skill evidence by
SHA-256. The builder refuses changed evidence or stage/geometry bytes. It verifies
22 normal hostiles and the four-enemy dependency closure, excludes optional `raid`,
and preserves the source's 0.5 movement multiplier. The stage retains separate
canonical provenance for stage inputs (`84f3c833`) and enemy records (`79e81a8a`).
The catalogue contains 604 entries: **597 public, seven test-only**.

Integration tests release three naturally summoned miners, traverse their exact
fractional checkpoints, damage and destroy both facilities, and finish their
harmless branch route. Static structures and unmanaged miners do not hold the
battle open after its ordinary hostiles finish. Enemy spawn `tileR`/`tileC` fields
are not moving coordinates: miner healing/shadow queries, death-summon placement
and pollution queries now use current world positions. Moving-unit regressions
cover the range and death-location cases.

The flow field still uses integer tile anchors, then approaches the precise
fractional endpoint without adding an unwanted center visit. Existing integer
route behavior remains covered by the route regression suite. Full-stage tests
assert the absence of swallowed hook/AI errors and optional raid enemies.

```sh
node tools/arkpedia/build-stage.mjs --candidate ch16 \
  --stage .cache/arkpedia/canonical-stage-16-3/stage.json \
  --geometry .cache/arkpedia/canonical-stage-16-3/geometry.json \
  --conditional .cache/arkpedia/canonical-stage-16-3/conditional.json \
  --out data/arkpedia-stage-16-3.json
npm run test:arkpedia-ch16
RENDER_E2E=1 node --test test/arkpedia-ch16-ui.browser.test.js
```

The browser check rejects public access, then exercises the actual app with
natural SP rather than injected state. Screenshots were inspected on desktop and
844×390 phone landscape. These are gameplay/control checks; stage art and some
unit/device artwork use existing fallbacks. No captured-game rendering/frame
parity or public admission is claimed.

## Retained source and parity evidence

`arkpedia-ch16-native-abilities.json` retains the six original prefab graphs.
`arkpedia-ch16-action-source.json` retains 28 serialized buff templates, six
projectiles (including original transforms and 2D colliders), and the chapter
16/17 environment and boss-environment components. The bundles match the pinned
inventory/manifest. The separate `arkpedia-ch17-reviewed-contracts.json` is the
reviewed behavior contract, not a generated extraction approval.

```sh
.cache/map-env/bin/python tools/arkpedia/extract-ch16-actions.py --check
```

The tests independently read original serialized fields for projectile speeds,
lifetimes, collision radii, repeat intervals, delayed damage, theft formulas,
shield guards, summon options and firewall interaction settings. Runtime tests
then exercise those behaviors on the shared battle. These are source/behavior
parity checks, not a claim of independent frame-by-frame capture against a game
client or completed rendering parity.

Canonical tables supply stats/blackboards; serialized native actions supply
behavior. Gameplay observations were cross-checked against PRTS:
[miner](https://prts.wiki/w/矿工游击队),
[Trimortalis](https://prts.wiki/w/三生花),
[Fungi](https://prts.wiki/w/异种菌),
[Likho](https://prts.wiki/w/“里霍”),
[war caster](https://prts.wiki/w/乌萨斯战争术师),
[Leak Source](https://prts.wiki/w/泄漏源), and
[Leak Marker](https://prts.wiki/w/泄漏标记).

## Reviewed test-only 16-4 build

The complete level and corrected extra route are retained in canonical
`arkpedia-data@57ab0fc5df7ae27b04a0c84515301f1feb6cf7f2`, generated by producer
`05e86b366aed457aca1c7eb7b6694d896ceb801e`. Both content validators passed
(838 pages, 8,125 public files, 9,853 source records); hosted data validation
[40153143663](https://github.com/arkpedia/arkpedia-data/actions/runs/40153143663)
passed with publication/proposal skipped. All eight pinned inputs were fetched
and checksum-verified again before building this candidate. The original source
bundle remains `admitted: false`, `testOnly: true`; the separate reviewed build
is explicitly test-only and only resolves with `experimental=1`.

The normal stage has 17 hostiles, four canonical enemy dependencies, source
movement scale 0.5, two native facilities and the manually controlled Hidden
Tunnel. The miner branch preserves its separate extra-route index, jitter and
fractional checkpoints. `visitEveryCheckPoint: false` allows an early exit if its
navigation cursor reaches the goal before all checkpoints. Three seeded full-stage
runs clear with exactly 17 normal hostiles, working summoned miners and actual
crossbow attacks; no engine errors occur.

`arkpedia-ch16-reviewed-crossbow.json` is a separate **experimental** implementation
contract. Its direct-radius query deliberately uses world-position center distance
with inclusive 1.5/0.5 boundaries. This metric is an explicit candidate assumption:
the native action graph proves the radius keys, faction/mark filters, cadence and
buff lifecycle, but does **not** prove collider-edge behavior in the original game.
The weapon keeps the shared collision selector; original native frame/geometry
parity remains unverified and public admission remains closed. This distinction
replaces the earlier blanket hold on constructing any experimental 16-4 build;
it is not a claim that the unresolved native geometry has been verified.

Candidate support now binds both exact crossbow records, all retained indexed
components and the complete prefab/projectile/template graph. Changed evidence,
talent values or unexpected wrappers fail support. The default public support
snapshot is unchanged. Actual feature dispatch attaches the controller without
manual test attachment; shared-engine checks cover direct-radius boundaries,
player/miner interference, order changes, separate Attack/Combat clocks, live
projectile damage and ordinary blocked combat. Candidate extraction never rewrites
this review or grants public support.

`arkpedia-ch16-reviewed-stage-16-4.json` binds the source bundle, device/skill
evidence and crossbow review. The builder rejects changed input bytes, hostile
counts, missing dependencies and any unreviewed candidate stage code. Runtime
checks also reject a removed test-only flag or canonical-candidate marker.

```sh
node tools/arkpedia/canonical-stage.mjs --stage 16-4
.cache/map-env/bin/python tools/arkpedia/extract-ch16-crossbow.py --check
node tools/arkpedia/enemy-support.mjs --candidate-ch16 --check
node tools/arkpedia/build-stage.mjs --candidate ch16 \
  --stage .cache/arkpedia/canonical-stage-16-4/stage.json \
  --geometry .cache/arkpedia/canonical-stage-16-4/geometry.json \
  --conditional .cache/arkpedia/canonical-stage-16-4/conditional.json \
  --out data/arkpedia-stage-16-4.json
node --test test/arkpedia-ch16-crossbow.test.js test/arkpedia-stage-16-4-source.test.js test/arkpedia-stage-16-4.test.js
CH16_QA_STAGE=16-4 RENDER_E2E=1 node --test test/arkpedia-ch16-ui.browser.test.js
```

Current focused validation passes 153/153. Real-app Chrome QA for 16-4 passes
public rejection, natural tunnel SP, keyboard/touch activation, stable focus and
bounds, phone landscape and restart. Desktop and phone screenshots were viewed
from `/tmp/codex-ch16-4-ui`; the result has no unexpected page errors. Original
stage/unit artwork still uses existing fallbacks. The CI entrypoint passes
19,846 top-level tests (19,840 passed, six skipped, zero failed; 596 seconds).
A separate run passes 3,183 nested engine/render tests (3,177 passed, six skipped,
zero failed; 144 seconds). These are separate command results, not a claim that
the older `npm test` invocation was rerun on this integration.

### Traversal and crossbow source cross-check

The native crossbow listener's `ALLY` side means player-side units; nearby enemy
units do not suppress it. Its distinct `_attack` and `_combat` references require
separate cooldowns. Tests cover real block/release switches and direct selection
of player units despite target-free/camouflage/isolation. This matches the
[PRTS crossbowman mechanics](https://prts.wiki/w/集团军机动弩手), cross-checked
against the retained selector/ability fields; range-edge parity remains open.

The original experimental
[pathing analysis](https://www.bilibili.com/opus/900558138389823489) distinguishes
body and navigation-cursor coordinates. Branch spawn jitter now remains a fixed
body-to-cursor offset through checkpoints and the exit. Fields, contact and
blocking still query the body. Explicit false permits an early exit within the
reported 0.05 cursor radius; true requires the final checkpoint sequence. Existing
routes without these declarations keep their previous behavior. Tests exercise
both flags and shifted endpoints, while retaining full miner/facility integration.
These changes do not implement the client's complete steering/inertia solver or
claim captured-game frame parity.

### Independent engagement and ordinary target acquisition

The retained Army Infiltrator weapon selector has radius 1.0 and requires
`mark_neutral[effect]`; its separate engagement circle uses 0.9. Both circles
include the miner body at acquisition. The weapon now queries marked neutrals
independently, including one outside engagement range, and a movement lock no
longer forces either combatant's ordinary target. The literal neutral and army
self-mark buffs are applied as retained by the original prefab graphs.

Three regressions cover the different circles, independent soldier targeting
and a miner's higher-taunt opponent while the original movement lock persists.
The two soldier cases were also run against the prior implementation and failed
there. All 121 focused checks pass after this correction; the real-app natural
SP/keyboard/touch/restart test passes again, with desktop and phone screenshots
inspected. Public and candidate support snapshots remain unchanged. The full
23,055-test invocation above covers the preceding engine clock/navigation change;
these additional controller checks are recorded separately.

### Tightened engagement evidence gate

The indexed Infiltrator evidence is now separately hash-bound and compared to a
reviewed component snapshot. All 13 retained rows were checked byte-for-byte
against the previously approved complete graph before adding this binding.
Its timing index has zero enemy-ability wrappers and one active passive; the
older two-wrapper overclaim is removed. A new wrapper, changed indexed content,
or disagreement between the full graph and timing inventories fails admission.
This changes candidate proof metadata and counts, not public support policies.

### Commander continuation (unadmitted)

`chapter16-commander.js` implements a candidate global command aura and composes
its native miner engagement with independent Attack/Combat clocks. The marked
ground-unit filter, persistent hidden-owner aura, overlapping owners and
source-owned removal are tested, including the real crossbow listener changing
its radius under orders. Both commander variants' full graphs and 32 indexed
components are retained from the existing checksum-pinned bundles. Six tests
pass; neither variant is added to support. Native art/frame parity remains held.

```sh
.cache/map-env/bin/python tools/arkpedia/extract-ch16-commander.py --check
.cache/map-env/bin/python tools/arkpedia/extract-enemy-native-abilities.py \
  --prefab enemy_10125_uacomd --prefab enemy_10125_uacomd_2 \
  --output data/candidates/arkpedia-ch16-commander-native.json --check
node --test test/arkpedia-ch16-commander.test.js
```

### Light Artillery continuation (unadmitted)

`chapter16-artillery.js` adds a separate candidate for `enemy_10122_uacann`.
The complete native graph includes both the travelling shell and the separate
stationary burning-area projectile; retaining only the shell misses the latter's
1.5-radius collider and detach-on-exit/stop policy. Both variants and 24 indexed
components are retained from the existing checksum-pinned native bundles.

Eleven source and shared-engine tests cover physical shell impact, live attack
at impact, fixed Arts ticks independent of ATK, three-second lifetime, overlapping
areas, recipient exit/reentry, explicit collider edges, ground filtering,
camouflage, source-death rules, battle-end cleanup, and actual commander orders
changing miner priority. Born shells survive their source; the impact action's
`CheckUnitAlive` prevents a dead source from creating a new field. Already born
fields persist until their own lifetime ends. The periodic effect marker uses
the native 0.2-second cadence. No support entry or stage admission is added.
This is source-backed candidate behavior testing, not captured native frame parity.

Seven additional family-evidence tests bind the crossbow, commander and artillery
complete graphs to their native inventories and indexed component hashes. They
reject self-rehashed changes to indexed components and incomplete projectile or
buff-template action closure. These checks do not grant support/admission.

```sh
.cache/map-env/bin/python tools/arkpedia/extract-ch16-artillery.py --check
.cache/map-env/bin/python tools/arkpedia/extract-enemy-native-abilities.py \
  --prefab enemy_10122_uacann --prefab enemy_10122_uacann_2 \
  --output data/candidates/arkpedia-ch16-artillery-native.json --check
node --test test/arkpedia-ch16-artillery.test.js
```

### Next canonical stage-source batch

Source-only intakes for 16-5, 16-6, 16-7, 17-2, 17-3 and 17-4 now pin
`arkpedia-data@657f85cc032ae5da807135f536d3263c6b249ed7`, generated by
`arkpedia/arkpedia@e5a96b56e312c3e73a54865da57bc33172119a0b`. The normal
producer importer now regenerates complete levels, corrected geometry and route
receipts together. The compiler produced 838 pages, 8,125 public files and 9,867
source records; both validators passed. Hosted preview validation
[40159194457](https://github.com/arkpedia/arkpedia-data/actions/runs/40159194457)
passed with `publish` and `propose` skipped. The release audit found 27 changed
source files (14 newly retained), twelve related stage-detail payloads and no
page changes. Manifest SHA-256 is
`444019d654d0d666872c7fb0f9231df6d073410f9b42e2100f2c6d2722322ca5`.

The consumer fetched and checksum-verified all eight inputs per stage. Every
retained bundle remains `testOnly: true, admitted: false`. Seven checks cover
their provenance and separation from builder/catalogue admission. 17-2 now has
the separate experimental review below; 17-3 also has the marker review described
below, 17-4 has the Rockbreaker review, and 16-5 has its controller/branch
review. The other two remain unbuilt/unindexed. Pending families include
Shieldguard and Fortbreaker for the next chapter 16 maps, and the chapter 17
split-controller family. Existing consumer stage/enemy pins stay
immutable. `npm run test:arkpedia-ch16` includes the source-only intake checks.

### Experimental Chapter 17 reaction controllers and 17-2

`chapter17-pollution-reactions.js` implements F-009's immediate max-HP-ratio heal
and R-044's one-shot Arts mode. Both base/stronger prefab graphs, two projectile
graphs, four native templates and 42 indexed components are retained from the
existing checksum-pinned native bundles. `arkpedia-ch17-reviewed-reactions.json`
separately binds the exact records, native components, full action closure and
existing environment evidence. Changed records, missing evidence or unexpected
native wrappers cannot clear candidate support. The existing Trimortalis
`MuradPollut` feature keeps its previous controller and review.

Native `enemy_muinf_t` uses ordinary healing: current max HP and the canonical
`hp_ratio`, with healing modifiers, heal-free and clamping. It is a one-time
reaction per contact, not regeneration. The real Leak Source ring/beam collision
invokes this reaction in integration tests. R-044's native mode-1 switch and
`enemy_mubow_switch_back` restore are modeled separately from its born projectile:
physical/Arts damage type is fixed at emission, ATK is read at hit, and born shots
survive source death. Returning to normal resets a full Attack period at cast end.
No target retains the enhanced mode; repeated contacts do not queue extra shots.
Control, source death and battle end retire pending callbacks and owned effects.

Attack end uses the shared engine's documented `attackStand` clip/fallback model.
The original native animation duration is **not verified**. Controlled clip
fixtures test the distinction between cast end and projectile impact without
presenting their duration as native evidence. Captured game/frame/art parity
and public admission remain held.

The separate `arkpedia-ch17-reviewed-stage-17-2.json` binds canonical stage inputs
at `arkpedia-data@657f85cc032ae5da807135f536d3263c6b249ed7`, reaction review and
the native environment evidence. This normal map has no Leak Site device or
predefined units. It retains source movement scale 0.5 and exactly 28 hostiles:
21 F-009 and seven R-044, with no SIX_STAR modifiers applied. Three seeded runs
finish without engine errors; an additional real-stage combat run exercises both
families attacking a legally deployed Beagle. The data file and index entry are
test-only; public access, removed candidate flags and unreviewed stage codes fail.

Thirteen reaction/source/mutation checks and six stage checks pass. Real-app Chrome
QA passes desktop/phone rendering, public rejection, actual wave-clock playback,
pause/resume, control bounds and restart. Screenshots in `/tmp/codex-ch17-2-ui`
were viewed; no unexpected page errors occurred. Existing artwork fallbacks remain.

The native environment's `_unharmful: 1` summon now also sets `holdsBattle: false`,
separately from its uncounted display status. Previously, a surviving Leak Source
could keep an otherwise cleared battle open. The isolated regression fails on
the old implementation and passes after the correction; direct/preplaced enemy
spawns are not reclassified by this change. The focused controller/stage suite
passes 179/179. The existing support/records/report/sharding cohort passes
189 checks with one skip and zero failures (190 total).

```sh
.cache/map-env/bin/python tools/arkpedia/extract-ch17-infantry-bow.py --check
node tools/arkpedia/enemy-support.mjs --candidate-ch16 --check
node tools/arkpedia/build-stage.mjs --candidate ch16 \
  --stage .cache/arkpedia/canonical-stage-17-2/stage.json \
  --geometry .cache/arkpedia/canonical-stage-17-2/geometry.json \
  --conditional .cache/arkpedia/canonical-stage-17-2/conditional.json \
  --out data/arkpedia-stage-17-2.json
node --test test/arkpedia-ch17-pollution-reactions.test.js test/arkpedia-stage-17-2.test.js
RENDER_E2E=1 node --test test/arkpedia-ch17-ui.browser.test.js
```


### Experimental Leak Marker and 17-3

`extract-ch17-marker.py` retains the complete `trap_329_rift` and `sktok_rift`
prefab graphs and three native templates, plus checksum-verified character/skill
rows from the existing pinned CN inventory. The independent marker review binds
those bytes and the existing environment evidence. The marker has native defaults
of 0 initial SP, 55 SP cost and 1 SP/second. Its periodic request checks skill
availability and grants `trap_rift_s_flag` only after a successful environment
summon; the AUTO skill requires that flag. Failed selection retains full SP.
Successful summons respect the one-second repeat flag even if another controller
immediately refills SP. The isolated regression fails on the former implementation.

Root `_rewriteTileOptions: 0` disables the mode's serialized tile defaults.
The runtime preserves the original map's deployment/passability. The marker is an
invulnerable, nonwithdrawable enemy device; ChargeRift uses the same SP port.
Native skill-animation and subframe timing remain unverified; the shared fixed
simulation timestep applies. The simplified renderer still uses existing art
fallbacks; the marker currently has no dedicated scene mesh or SP display.
This is a test-only presentation limitation, not native marker-art parity.

The separate `arkpedia-ch17-reviewed-stage-17-3.json` binds canonical inputs at
`arkpedia-data@657f85cc032ae5da807135f536d3263c6b249ed7`, marker evidence,
reaction review, environment and native inventories. The normal map contains 17
F-009, two R-044 and five Heterogeneous Fungi, with one marker at row 2/column 3.
SIX_STAR modifiers are excluded. The test-only file/index require experimental
mode; the public catalogue remains 597.

The focused controller/source/stage suite passes 191/191, including five marker
evidence/behavior/mutation checks and seven stage checks. Public/candidate support
and the 602-entry index checks pass. The support/records/sharding checks pass
14 tests with one skip and no failures (15 total).
Three seeds exercise actual caster SP delivery and 13 harmless marker summons;
all 24 normal hostiles finish at 360.6 seconds while surviving harmless sources
do not hold the battle open. These route-only runs explicitly extend the test
clock to 600 seconds. **The shared runtime's default 300-second cap still times
out without a deployed squad**, which has a separate regression and is not
reported as a successful clear. Ordinary combat against a legally deployed guard
also runs without engine errors. Native captured frame parity and public
admission remain held.

Actual-app Chrome checks pass public rejection, desktop/phone playback,
pause/resume, control bounds and restart. Desktop/phone screenshots in
`/tmp/codex-ch17-3-ui` were viewed; no unexpected page errors occurred.

```sh
.cache/map-env/bin/python tools/arkpedia/extract-ch17-marker.py --check
node --test test/arkpedia-ch17-marker.test.js test/arkpedia-stage-17-3.test.js
RENDER_E2E=1 CH17_QA_STAGE=17-3 CH17_QA_OUT=/tmp/codex-ch17-3-ui node --test test/arkpedia-ch17-ui.browser.test.js
```


### Experimental Rockbreaker controller and 17-4

`extract-ch17-rockbreaker.py` retains both complete prefab graphs, three native
templates and 22 indexed components from the existing pinned bundles. The separate
animation extractor verifies `refs/arts/enm_art_26.ab` against the immutable CN
manifest and retains both original skeleton byte streams. Each SkeletonDataAsset
path ID and external serialized-file binding is checked against the native prefab.
Independent decoding verifies the Skill's exact 1.1666666269302368-second
`OnAttack` event and two-second duration for both variants.

`chapter17-rockbreaker.js` implements one child per first successful pollution
reaction. The native request interrupts the ordinary attack, clears palsy and
ignores readiness/cooldown. The cast stops movement/ordinary attacks until its
end. A new control epoch cancels pending release, including effects that expire
between ticks. Successful release gives both parent and child the permanent
split flag. The child keeps the variant's canonical full stats and the parent's
remaining route, including the unconsumed wait/current checkpoint. It is a
counted hostile and holds battle completion independently of the parent. Failed
spawning does not consume the one-time split. Death/battle end retire the owned
hook and schedules; born children survive their parent's death.

The independent `arkpedia-ch17-rockbreaker-contract.json` binds exact records,
all indexed native rows, full graph/template closure and original skeletons.
Candidate feature dispatch installs the controller on both bodies; absent family
proof, changed rows, extra wrappers and altered record signatures fail support.
Default public records/support are unchanged. The candidate uses a seeded square
centered on the current tile for the 0.5 random offset bound. Exact native spatial
collision/offset conventions and forced-cast behavior under preexisting/new
control remain explicit **candidate limitations**, not claims of captured parity.
Silence/ordinary-attack disarm do not remove the nonsilenceable pollution listener.

The separately reviewed canonical 17-4 contains 20 F-009, four Heterogeneous Fungi
and seven Rockbreakers, plus one marker at row 3/column 3. The same distinct enemy
and stage snapshots are retained. All three seeded stage runs clear at 202.5
seconds with zero engine errors, six/seven real-beam-triggered children and
correct total hostile counts of 37/38. A legally deployed guard exercises
ordinary combat alongside the split path. SIX_STAR modifiers are excluded.
17-4 is explicitly test-only and requires experimental mode; the catalogue is
604 entries, **597 public and seven test-only** after the separate 16-5 review
below. 16-6 and 16-7 remain unadmitted.

The focused controller/source/stage suite passes 217/217. Support, records,
coverage and sharding checks pass 15 tests with one skip and no failures (16 total).
Public/candidate support and the 603-entry index checks pass. Actual-app Chrome
desktop/phone checks pass public rejection, playback, pause/resume, bounds and
restart. Screenshots in `/tmp/codex-ch17-4-ui` were viewed.
The simplified art and marker-display limitations described above remain.

```sh
.cache/map-env/bin/python tools/arkpedia/extract-ch17-rockbreaker.py --check
.cache/map-env/bin/python tools/arkpedia/extract-ch17-rockbreaker-animation.py --check
node --test test/arkpedia-ch17-rockbreaker-source.test.js test/arkpedia-ch17-rockbreaker.test.js test/arkpedia-stage-17-4.test.js
RENDER_E2E=1 CH17_QA_STAGE=17-4 CH17_QA_OUT=/tmp/codex-ch17-4-ui node --test test/arkpedia-ch17-ui.browser.test.js
```


### Experimental Shieldguard, artillery and 16-5

`extract-ch16-shieldguard.py` retains both native prefab graphs, six templates and
30 indexed components. The independent Shieldguard review binds exact records
and component content. Its shared miner engagement now permits three links:
one nearest available miner per 0.3-second scan, exclusive ownership, 0.9-radius
acquisition including the miner body, 1.0-radius center release. Releasing one
link preserves the other movement locks. The weapon still selects only one
marked neutral per attack independently of movement ownership. Native Attack_B
and Combat Attack_A use separate cooldowns. Orders reduce physical/Arts damage
by 40% after mitigation, including sourceless damage; true damage and HP loss
remain unchanged. The 0.1-second visual listener is separate from immediate
incoming-damage checks. Silence does not disable those native passive effects.
Source death/battle end remove every owned link and visual instance.

The existing artillery candidate is now source-bound in ordinary feature
dispatch for both variants. Its separate review retains the complete projectile
and action closure. Existing shell/burn, source-death, overlapping areas,
recipient exit/reentry and real commander-priority tests still pass. Changed
records, absent full-family proof and altered components cannot clear either
family's candidate support. Original captured animation/collider frame parity
remains held; shared engine attack timing and recipient body radii apply.

16-5 also exposed a preexisting Patrol Captain implementation gap: named-target
priority alone could not perform its native ranged attack on marked neutral
units. The retained full prefab/projectile graph and nine indexed components
show radius 1.2000000476837158, a single marked-neutral ground target, speed 10,
five-second projectile life and separate blocker Combat. The corrected controller
uses those selectors and independent Attack/Combat clocks. Born shots survive
source death and use current ATK at impact. The unchanged public record equals
the canonical record byte-for-byte as a parsed entry; no enemy overlay or new
public admission is used. Other patrol-family records keep their prior behavior.
Original Attack_01/Attack_02 animation events remain unverified.

The canonical level has two tunnel instances overriding `talent@action_index`
to 0 and 1. Branch installation now validates both original miner actions and
extra routes, including the source's empty-checkpoint object form. Each tunnel
uses its own retained skill override; unknown blackboard keys/action indices
are rejected before accepting a battle. Existing one-action tunnel/branch tests
remain valid. Commands consume only the selected owner's SP and release only
its queue, with separate native total/waiting caps.

The separate `arkpedia-ch16-reviewed-stage-16-5.json` binds the canonical stage
snapshot at `arkpedia-data@657f85cc032ae5da807135f536d3263c6b249ed7`, device/skill
evidence and all three controller reviews. It contains 23 Patrol Captains, two
Light Artillery and one Shieldguard, plus unmanaged miner branches. Three seeds
clear at 195.83 seconds with 26 counted hostiles and both original extra routes;
actual Patrol Captain/artillery attacks hit the miners. Tests verify each
branch's source position/owner, separate queue release, caps and rejection of
unknown overrides. Native branch miners remain uncounted and harmless.

The full local CI-entrypoint suite passes **23,189 tests: 23,176 passed, zero
failed/cancelled, 13 skipped** (729.8 seconds), with localhost networking enabled
for HTTP/WebSocket tests. The focused suite passes 245/245. A normalized shared-damage-packet regression
failed before the per-recipient reduction fix and passes afterward: an ordered
Shieldguard cannot reduce damage for another recipient or compound the packet
multiplier. Incoming modifier ownership is retired on death/battle end. Public/candidate support and the 604-entry
index checks pass. Actual-app Chrome checks pass public rejection, natural SP,
keyboard/touch activation, independent owner queues, distinct Upper/Lower
Tunnel labels, all command bounds on phone, stable focus, and restart. Desktop/phone screenshots in
`/tmp/codex-ch16-5-ui` were viewed. All seven new stages remain explicitly
test-only; all 597 public stage entries and public enemy data artifacts are
unchanged. No production pointer, merge, publication or deployment is advanced.

```sh
.cache/map-env/bin/python tools/arkpedia/extract-ch16-shieldguard.py --check
.cache/map-env/bin/python tools/arkpedia/extract-ch16-patrol.py --check
node --test test/arkpedia-ch16-shieldguard.test.js test/arkpedia-ch16-artillery.test.js test/arkpedia-ch16-patrol.test.js test/arkpedia-stage-16-5.test.js
RENDER_E2E=1 CH16_QA_STAGE=16-5 CH16_QA_OUT=/tmp/codex-ch16-5-ui node --test test/arkpedia-ch16-ui.browser.test.js
```

### Experimental Fortbreaker and 16-6

Base Fortbreaker (`enemy_10123_uareap`) now has a candidate controller.
The `_2` graph and shared weapon subset are retained and tested, but its
canonical record additionally requires `AttackParam` and `KillBonusAura`, which
remain unsupported. The support gate rejects `_2`; this checkpoint does not
admit it or claim complete behavior for that record.
The retained native prefab/projectile/template closure, indexed components and
original skeleton bytes are bound by an independent review. The native Skill
OnAttack event starts three rockets, or six when orders are present at cast
start, at 0.2-second intervals. Rounds reselect ground targets, prioritizing
previously unselected deployments. Each born rocket retains its launch target
position and impacts after the native 0.6-second delay within radius 1.1.
Born impacts survive source/target death and use live attack. The native final
trace flag includes the still-valid original deployment even after it moves
outside the static area; that receipt never transfers to a redeployment. Control interrupts
unborn rounds. The normal homing weapon and blocker Combat retain independent
cooldowns, while movement can engage three miners and block volume is three.
Shared ordinary-attack animation and collider-edge models remain candidate
limits; decoded native events are not captured game-frame parity.

The separate 16-6 review binds canonical `arkpedia-data@657f85cc…` stage inputs
and the Fortbreaker, Patrol Captain, device and engagement evidence. All 24
scheduled source units remain: 21 counted hostiles and three neutral miners.
The source's `raid` hidden group remains excluded. Scheduled miners keep their
ordinary battle lifetime; only native tunnel children use the already reviewed
harmless lifetime. Three route-only seeds clear at 286.8–288.57 seconds with
live Fortbreaker volleys and no simulator errors. This is route/device
integration evidence, not an operator strategy or captured native parity claim.
The catalogue is now 605 entries: 597 public and eight explicitly test-only.

Validation in this checkpoint: the focused controller/stage tests pass, both portable Fortbreaker
extractors reproduce retained bytes with `--check`, default public support is
unchanged, and candidate support/index checks pass. Real-app 16-6 verification passes desktop keyboard, phone touch and restart
with natural SP. The first run reproduced an attack event crashing the fallback
actor and freezing the animation loop. Supplying the common actor attack method
fixes that failure; the exact same UI test passes and both screenshots were
viewed (`/tmp/codex-ch16-6-ui`).

Hosted CI inspection also found Windows shards returning without executing the
test runner: a Unix-only main-module URL check did not match Windows paths.
The runner now uses platform URL conversion, and a subprocess test exercises
the actual CLI entry point. Earlier Windows green statuses are not unit-suite
evidence. Node 22 Ubuntu reported 180-second file-level timeouts in the long
seeded full-match suites; those files now run separately with a bounded
ten-minute deadline, retaining every seed and assertion. Other files retain
the original three-minute deadline. Fresh hosted verification remains pending.


### Commander, native route timing and canonical harmless wave flags

Both Commander variants now clear exact candidate support with one native aura
claim, without also attaching the generic Infiltrator engagement controller.
Tests cover source ownership, overlapping providers, recipient deployment lives,
source disappearance/silence, one-miner movement engagement and real six-round
Fortbreaker volleys. The separate 16-7 review binds the complete canonical level,
all seven enemy dependencies and each native family/device contract. Its two
excluded groups are exactly `raid6A`/`raid6B`, enabled only by source SIX_STAR
options. The builder now verifies every excluded hidden group against those
native options; 17-4's existing SIX_STAR `hidden1` exclusion is recorded explicitly.

An integration audit caught the synthetic path generator dropping native waits
and treating APPEAR as walking. It now retains start/checkpoint waits (including
deduplicated checkpoint anchors), MOVE offsets and teleport breaks, and refuses
unsupported timing types. All affected test-only paths were regenerated; public
stage files and all 597 public entries are unchanged. The retained 75-second
Commander wait now keeps the aura active for Fortbreaker's delayed arrival.
Three source-wave seeds exercise six-round volleys while ordered, then ordinary
three-round volleys after the Commander leaves, clearing at 277.87–289.97 seconds
within the unchanged default cap. Earlier 16-7 timeout observations used the
broken generated paths and are superseded by this source-corrected run.

The same audit found native `isUnharmfulAndAlwaysCountAsKilled` flags missing from
geometry. The normal canonical producer now retains an explicit per-spawn
`unharmful` field. Producer and data validators pass at 838 pages, 8,125 public
files and 9,927 source records; preview `245d7c60…` binds producer `7c94fb85…`
and the unchanged upstream `db6f9ef8…`. Its manifest SHA-256 is
`278c6e912597450ecea9582dbb9b89301d89451b6542eab6efab530093d2a60c`.
The consumer fetched and checksum-verified all ten retained source bundles,
including an unadmitted 16-8. No source overlay or substitute repository is used.
All nine admitted test-only builds were rebuilt normally from these inputs;
16-2 now also binds its complete raw level and native movement scale.

The scheduled harmless receipt crosses the adapter and spawn queue into only
that unit's deployment. It does not globally classify miners, direct spawns or
preplaced units. Tests compare exported flags to complete native actions for
every admitted candidate and prove an unmarked spawn of the same enemy still
holds battle. 16-2 can finish while source-marked miners remain alive after all 34 hostiles
resolve; all eight scheduled miners retain their individual receipt. 16-6/16-7 retain all scheduled units while respecting
their individual harmless flags. Native tunnel children retain their separate
reviewed summon flag. Continuously releasing tunnel miners can sustain combat;
16-5's clear scenario explicitly returns both tunnels to standby at 120 seconds,
then clears at 196.27–244.6 seconds across three seeds. This is a deliberate
player command sequence, not an engine time-limit exemption.

Current focused validation passes 297/297. The preceding actual CI-entrypoint
run passed two groups totaling 23,150 tests (23,137 passed, 13 skipped, no
failures/cancellations); it predates the final trace-hit correction and this
route/harmless-wave/Commander continuation. The final trace fix had a separate
268-test pass. A new full run is required for the current continuation. All nine
new stages remain explicitly test-only; captured native frame/render parity,
stronger Fortbreaker extra talents, bosses and later stages remain unfinished.

Real-app 16-7 QA passes natural SP, desktop keyboard, phone touch and restart;
both current screenshots were viewed at `/tmp/codex-ch16-7-ui`. Canonical preview
hosted validation `40169147140` passed; publish and propose jobs were skipped.

The repaired Windows runner completed its seeded match tests, then exposed a
second launcher issue: passing every absolute filename exceeded the Windows
process command limit before the ordinary suite could start. The runner now
uses bounded relative-path batches, preserves every selected file exactly once,
reports launch errors and runs all batches before reporting failure. Partition,
actual CLI-entry and launch-budget regressions pass. The Windows limit is
specified by [CreateProcessW](https://learn.microsoft.com/en-us/windows/desktop/api/processthreadsapi/nf-processthreadsapi-createprocessw).
Fresh hosted verification of the batched runner remains pending.

Checkpoint validation, 2026-10-25: commit `98219c33ac05f0033dfd5ece981548b260fbf470`
passed the actual batched CI entry point locally (`SP_E2E=0 SP_REAL_E2E=0
RENDER_E2E=0 node tools/run-tests.mjs`): 23,181 tests, 23,168 passed,
13 skipped, zero failures/cancellations across all eight Node groups. This
covers Commander, all nine test-only stages, canonical harmless-spawn flags,
source checkpoint waits/teleports and the Windows argument-budget repair.
The separate 297-test focused suite and viewed desktop/phone 16-7 command,
natural-SP and restart checks passed. This is candidate validation; public
admission and captured native frame/render parity remain held.

### Abnormal Originium Slug and normal-play 16-8

Both `enemy_10126_rkbomb` variants have an exact-record controller contract.
The native root BlockMcreep link persists across modes. Mode 0 owns a taunt
buff, 50% Physical/Arts reduction for non-miner sources, and fixed sourceless
200 Arts retaliation against valid attackers. Only marked miner Physical hits
consume the snapshot pool (10% of initial maximum HP); miner Arts/True bypass
both pool and reduction. Pool exhaustion removes the owned shield mechanics,
switches permanently to mode 1 and forces the one-second `Trans` clip despite
silence/readiness. The clip is stun immune; other action control interrupts its
owned lock, including brief control removed before the next tick. Both modes
retain independent Attack/Combat clocks. Death and battle end clean up hooks,
modifiers and pending tasks. Original attack events are retained but ordinary
shared melee timing/collider and incoming native callback parity remain held.
No death explosion is inferred from the art's unused event marker.

16-8's canonical normal ALL rune enables `group0` (five slugs). Its independently
reviewed integration includes that group, excludes optional Six-Star `group1`,
and retains 35 hostile spawns: 20 Patrol Captains, 12 slugs and three Shieldguards.
The compiler validates the full group partition, source runes, conditions and
wave/route references before adding any entries. Neither branch nor random
conditions are silently flattened. Both root and index entries remain test-only.

Three seeded route-only fixtures exercise live mode changes and canonical
miner summons, clearing at 369.17 / 403.57 / 314.10 seconds with an explicit
600-second fixture clock. The normal 300-second limit remains unchanged and has
a separate timeout assertion. Actual-app desktop/phone natural SP, keyboard,
touch, focus/bounds and restart checks passed; screenshots were viewed.
All ten builds reproduced byte-for-byte through the normal builder. Public
catalogue entries remain byte-equivalent. 16-9 was independently verified from
`arkpedia-data@245d7c6` manifest, stage identity, route and level receipts, then
fetched through the checksum loader; it remains source-only and fails admission.

Hosted checkpoint `98219c33` passed all four Ubuntu Node 22/24 shards and both
Windows Node 24 shards. Windows Node 22 shard 1 completed the seeded full-match
files successfully but timed out the aggregate `arkpedia-stage-smoke.test.js`
file at 180 seconds. Its individual stage startup checks share that file-wide
deadline. The runner now isolates this full-catalogue sweep with the existing
bounded ten-minute aggregate-file budget, preserving every stage and assertion.
The remaining ordinary files retain their 180-second deadline. A fresh hosted
run is required before claiming this repair verified on Windows Node 22.

The final 16-8 focused cohort passed 328 tests with two opt-in browser skips
(330 total), and the separate real-app browser invocation passed. The slug's
17 direct/source/registration tests also cover real operator blocking and
independent Attack/Combat mode clocks. Six test-runner partition/launch checks
passed after the aggregate smoke deadline adjustment. Full and hosted results
for this continuation must be recorded separately when they complete.
