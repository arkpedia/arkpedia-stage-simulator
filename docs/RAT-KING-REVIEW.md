# Rat King

Both database levels share the layered barrier, homing projectile and prioritized
timed-cast helpers. The three Arts-only shield layers each absorb 4,667 or 7,334
post-mitigation damage. Their total is 14,001 or 22,002. The initial +3,000 flat
DEF remains until the last layer breaks; overflow continues to HP in the same
packet. The native common ability adds Sleep immunity to the table immunities.

Ordinary attacks select ground units and release homing Arts projectiles at
speed ten. The retained 70/30-second Attack clip has a 41/30-second release.
This supplies the shared attack windup/recovery mapping, not verified first-hit
Unity timing. Below half HP, outgoing damage is multiplied by 1.5 or 1.7; healing
above the threshold removes that benefit. This modifier also affects sand skills.

Singing Sands selects the highest maximum-HP eligible ground character globally,
independent of blocking priority. At release, the selector is sampled again.
Its native 70/30-second Skill_1 clip releases at 59/30 seconds. The projectile's
two original 7×1 and 1×7 colliders select the cross, including flying characters
and camouflage. Each target receives fixed Physical splash damage with no
on-damage SP. Sand Tomb selects the lowest maximum-HP eligible ground character;
its 40/30-second Skill_2 clip releases at 20/30 seconds. Cooldowns and priority
come from the selected level. Slow Down scales cast progress, not cooldowns.

Sand Tomb creates a fixed 3×3 projectile field for fifteen seconds. Its immediate
first pulse and one-second repeats can hit flying characters. Each pulse applies
the fixed Arts damage and an independently lasting fifteen-second final ATK
multiplier of 0.3. Existing debuffs are neither stacked nor refreshed; leaving
the field does not clear them. Resist does not shorten this native non-resistable
effect. The field survives the source's death and keeps its original location
when the selected unit moves or retreats. Retired sources use the launch damage
multiplier; other outgoing modifier snapshots are not yet native-frame certified.

After its initial one-second activation, Mark tracks the current ground HP
extrema using source-owned visible buff records. The exact native arrow artwork
and selection-effect timing are not reproduced. Equal-HP ties use the ordinary
simulator target order; compiled native tie ordering remains unverified.

CB-10 has an original replacement skill list: Sand Tomb first, initial cooldown
65 seconds; Singing Sands second, 1,200 damage; no Mark skill. The compiler now
allows an explicitly reviewed subset/order by skill identity, followed by the
existing per-parameter checks. Unknown skills, duplicate entries, other subsets,
and priority changes remain refused. The base catalogue record stays unchanged.

The native gate checks both modes, wrapper/selector contracts, shield templates,
debuff override mode, projectile geometry, field cadence and exact skeleton
bindings. Shared range-controller references and their collider siblings are
retained once by the extractor. Animation verification uses the generic reader:

```sh
node tools/arkpedia/enemy-animation.mjs --enemy enemy_1509_mousek \
  --bundle refs/arts/enm_art_16.ab --skeleton-data 5285406911944445765 \
  --out data/arkpedia-ratking-animations.json --check
```

Tests exercise actual shield overflow, HP targeting, airborne collateral,
camouflage, field persistence, non-refreshing debuffs, priorities, Slow Down,
source death and original override rejection. Browser startup and wave receipts
do not establish a playable clear, exact visuals or compiled callback parity.
The retained original source and [PRTS Rat King](https://prts.wiki/w/“鼠王”)
provide the reviewed behavior and distinguish it from remaining fidelity work.
