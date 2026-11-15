# Chimera and shared Originium pollution

`arkpedia-originium-pollution.js` owns shared membership, per-family pulse
clocks, source removal and the single additive SP-recovery penalty. Tiles,
Chimeras and storms reuse it. Native buff templates compare current damage
values before each pulse, with different tie rules and branch order. Those
comparisons are retained explicitly rather than replacing them with an assumed
universal maximum. Damage is sourceless True environmental damage and grants no
on-damage SP. Multiple sources of one family use one clock and the strongest
current value; source departure falls back to surviving sources.

The two Chimera prefabs share one factory in the regular and legacy catalogue.
The retained root, modes, attacks, passive bonuses, selector geometry, validator,
transformation wrapper and sibling cast-buff component establish:

- Pollution is checked every 0.5 seconds. The transformation remains active
  after leaving its trigger and changes Physical melee attacks to Arts.
- The cast locks movement and attacks. Its finishing buff switches mode and
  removes the lock, including on interruption. The original Skill clip lasts
  56/30 seconds; its OnAttack event is at 35/30 seconds. The exact source
  skeleton receipt is `data/arkpedia-chimera-animation.json`.
- The transformed bonus is flat ATK addition. H14-1's original elite override
  supplies +400 ATK and 100 aura damage; ordinary records supply zero and 50.
- The 1.2-radius aura affects other eligible ground units on both sides. The
  original validator excludes traps and unselectable opponents. Nearby Chimeras
  can therefore trigger each other. The aura ends when its source leaves.

Storms consume pollution tiles once per second and gain the declared radius and
damage increments per consumed tile. Radius approaches its new target by 0.0083
every 0.03 seconds. Entering Caustic Originium Slugs are consumed once, strengthen
that storm and suppress their pollution creation. Empty ground does not grow a
storm. Original storm damage is True environmental damage, not Arts damage.
The siege core marker suspends consumption and radius growth; the siege device
itself still requires separate implementation/admission.

Evidence comes from the pinned native component and buff-template corpus and
the [PRTS Chimera description](https://prts.wiki/w/孽罪奇美拉). The predicate
checks the mode attacks, flat bonus type, shape, selectors, cast hooks and
environmental templates. Tests cover transformation, interruption, overlaps,
source departure, target eligibility, chained activation, stage values, tile
consumption, radius interpolation and per-source Slug consumption.

Remaining fidelity work includes native ordinary-attack frame alignment, exact
compiled-controller cast scheduling, mode-specific presentation, and the
Caustic Slug's normal death-created tile implementation. The old legacy
`infection` terrain remains a compatibility trigger for its catalogue scenario;
regular stages use their actual current pollution tile set.

Storm body restrictions and two-second pursuit of the newest Beacon are now
reviewed alongside Withered Altar death spawns. See
`STAGE-WITHERED-ALTAR-REVIEW.md` for source contracts and pathfinding limits.
