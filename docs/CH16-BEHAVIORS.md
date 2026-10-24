# Chapter 16 behavior takeover

The data source remains `arkpedia/arkpedia-data` at
`79e81a8a872b2ecc592647d81a864ccbf1f8ca06`. No new source repository is involved.
The consumer compiles the whole checksum-verified snapshot (1,901 enemies /
2,125 records), then derives candidate support from that complete catalogue.
The old public enemy catalogue and its support files remain unchanged.

## Experimental 16-2

`data/arkpedia-stage-16-2.json` contains all 42 source spawns and four canonical
enemy records. It carries its canonical/upstream commit provenance. The builder
checks that candidate support names the exact canonical snapshot bytes.
The runtime only accepts the candidate registry for test-only 16-2; the stage
selector additionally requires `?experimental=1&stage=16-2`.
The public catalogue still contains 597 stages.

The miner controller handles independent healing from every deployed Medic in
range, injured-only fear damage, nine-tile shadow suppression refresh, neutral
selection and elemental-gauge immunity. Ordinary operators cannot target or
block miners, while enemy ranged attacks can select them at their -1 taunt.
The source 16-2 map has neither special shadow tiles nor devices. Other maps
still need their own device and shadow-system integrations, including miner
attacks against obstructing rock walls; they are not admitted by this change.

```sh
node tools/arkpedia/enemy-support.mjs --candidate-ch16
node tools/arkpedia/build-stage.mjs \
  --stage ../arkpedia-data/source/data/stages/16-2.json \
  --geometry ../arkpedia-data/source/data/stage-geometry/16-2.json \
  --candidate ch16 --out data/arkpedia-stage-16-2.json
node tools/arkpedia/stage-index.mjs
```

## Other five controller candidates

`server/sim/content/chapter16.js` also contains initial, executable candidates
for ChargeRift, ReverseDamage/MuradPollut, DeadSummon, shield/LockDamage/StealAtk,
and Leak Source rays/reveal/SP/exit. Focused tests exercise their core mechanics.
These five **remain unsupported**, with explicit failing coverage predicates.
They are not frame-parity claims or completed public-admission reviews.

Outstanding integration/parity work includes actual Leak Marker device SP,
channel projectile interruption and target priority, shared ATK-theft override
ownership across casters, Leak Source DOT ownership after source removal and
across overlapping sources, counter-reveal cancellation on a different operator
life, and boss firewall effects. Variants also require their own retained native
evidence and coverage; base-prefab evidence cannot admit them automatically.
A feature entry must not clear these gates merely because a factory exists.

## Reproducible action evidence

`data/candidates/arkpedia-ch16-action-source.json` retains 28 serialized native
buff templates, four projectile prefabs, and the chapter 16/17 environment
components. The template/projectile bundles match the original pinned inventory.
The small environment bundle was fetched from that same manifest, and checked
against its manifest size and MD5; the retained receipt adds its SHA-256.

```sh
.cache/map-env/bin/python tools/arkpedia/extract-ch16-actions.py --check
```

Canonical enemy tables supply stats and blackboards. Native serialized actions
supply the mechanics. Gameplay observations were cross-checked against PRTS:
[miner](https://prts.wiki/w/矿工游击队),
[Trimortalis](https://prts.wiki/w/三生花),
[ChargeRift family](https://prts.wiki/w/血色异种菌),
[war caster](https://prts.wiki/w/乌萨斯战争术师), and
[Leak Source](https://prts.wiki/w/泄漏源).
