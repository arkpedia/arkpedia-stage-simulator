# Chapter 16/17 behavior implementation

The data source remains `arkpedia/arkpedia-data` at
`79e81a8a872b2ecc592647d81a864ccbf1f8ca06`. The consumer compiles the complete
checksum-verified snapshot (1,901 enemies / 2,125 records), then derives candidate
support. The public enemy catalogue/support files and 597 public stages are
unchanged. Nothing here promotes a stage or changes a production pointer.

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

`16-2` and `16-3` are accepted by the experimental runtime candidate registry.
16-2 retains its 42 source spawns and four canonical records. 16-3 has 22 normal
hostile spawns plus unmanaged miner summons, using four canonical records. Both
require `?experimental=1`, remain `testOnly`, and verify the candidate support
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
The catalogue contains 599 entries: **597 public, two test-only**.

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

## 16-4 continuation (unadmitted)

The next complete level and corrected extra route are retained in canonical
`arkpedia-data@57ab0fc5df7ae27b04a0c84515301f1feb6cf7f2`, generated by producer
`05e86b366aed457aca1c7eb7b6694d896ceb801e`. Both content validators passed
(838 pages, 8,125 public files, 9,853 source records); hosted data validation
[40153143663](https://github.com/arkpedia/arkpedia-data/actions/runs/40153143663)
passed with publication/proposal skipped. The simulator fetched all eight pinned
inputs and verified the release, original-level and producer receipts. The source
bundle remains `admitted: false`, `testOnly: true`; no 16-4 stage is indexed.
The level has 17 normal hostiles and movement multiplier 0.5. Its branch's
`visitEveryCheckPoint: false` differs from 16-3 and is intentionally refused by
that reviewed consumer until the traversal contract is resolved.

`extract-ch16-crossbow.py` retains both Mobile Crossbowman prefab graphs, its
speed-10/lifetime-10 projectile and native action templates. A separate targeted
extraction retains 22 timing-index-verified components. The candidate controller
in `chapter16-crossbow.js` is tested through shared attack/projectile dispatch:
ranged 2.5× damage, nearby enemy/native-marked-miner interference, commander's
smaller radius, marker cleanup and unscaled blocked combat. Native selectors,
listener cadence and non-silenceability are separately asserted. Range queries
currently use world-position centers; collider-edge parity is still unreviewed.
**The controller has no support-registry entry.** Retaining/exercising it does
not approve this prefab or 16-4; stage traversal and full-stage integration are
also still outstanding. The combined focused suite now passes 114/114; the
16-4/crossbow intake adds nine checks after the separately recorded 16-3 full run.

```sh
node tools/arkpedia/canonical-stage.mjs --stage 16-4
.cache/map-env/bin/python tools/arkpedia/extract-ch16-crossbow.py --check
.cache/map-env/bin/python tools/arkpedia/extract-enemy-native-abilities.py \
  --prefab enemy_10121_uasnip --prefab enemy_10121_uasnip_2 \
  --output data/candidates/arkpedia-ch16-crossbow-native.json --check
node --test test/arkpedia-ch16-crossbow.test.js test/arkpedia-stage-16-4-source.test.js
```
