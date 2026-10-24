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
| `enemy_3010_mcreep` | Neutral targeting, independent Medic-range healing, fear damage, nine-tile shadow suppression | Healing/range, true damage, neutrality, elemental immunity |
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

Only `16-2` is currently accepted by the experimental runtime candidate registry.
Its 42 source spawns and four canonical records carry canonical/upstream commit
provenance; the builder verifies the support snapshot checksum. Catalogue loading
requires `?experimental=1&stage=16-2`, and the stage remains `testOnly`.
There are no special shadow tiles or devices on this source map. Other chapter 16
maps still require their own shadow/device review, including miner attacks on
obstructing rock walls. Their admission is outside this five-controller change.

```sh
node tools/arkpedia/enemy-support.mjs --candidate-ch16
node tools/arkpedia/build-stage.mjs \
  --stage ../arkpedia-data/source/data/stages/16-2.json \
  --geometry ../arkpedia-data/source/data/stage-geometry/16-2.json \
  --candidate ch16 --out data/arkpedia-stage-16-2.json
node tools/arkpedia/stage-index.mjs
npm run test:arkpedia-ch16
```

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
