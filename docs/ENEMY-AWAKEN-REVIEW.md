# Awaken: shared components in progress

Awaken is still blocked. Its independent damage-sharing talent and the scheduler
operation needed for its phase transition are implemented. Full boss admission
still requires the phase/attack/teleport composition; this work does not add an
available enemy or stage.

## Damage sharing

The source aura selects other grounded, selectable allied enemies carrying
`lypa[driver_mark]`. Its reverse source bindings name the recipients of
`DamageSplitToBuffKeySources`. The lower-priority damage template excludes
`INSTANT_KILL_LIKE_DAMAGE` and retains one half of incoming damage. The shared
runtime transfers the other half, equally, through the existing HP-loss path
after mitigation. Recipient DEF/RES is not applied again. Loss keeps the original
credit and sourceless classification; a dying recipient's unused share is not
redistributed. With no eligible recipient the boss takes full damage.

`instantKillLike` now survives damage normalization as a classification flag.
The source-reviewed Logos and Makoto execution packets set it. It does not
bypass shields, fatal hooks, or invulnerability; their previously documented
native cancellation-mask limitation remains. HP loss and cancelled hits do not
enter this sharing hook.

Both database levels pass component tests, including disappearance, loss of the
marker, air targets, source attribution, execution exclusion, and mutated-source
refusal. The gate approves only `talent:DamageSplit`; full enemy support remains
null. Native aura refresh timing, overlapping aura ownership and lower-priority
ordering against other rare damage modifiers are not client-frame certified.

## Source retained for the remaining fight

The original prefab hierarchy is in `arkpedia-enemy-native-abilities.json`,
including all four directional projectile prefabs. The `enm_art_17` skeleton's
exact clips and events are in `arkpedia-awaken-animations.json`; the body is
extracted in the local artwork cache and has not yet been published.

- Both forms have a rooted, unblockable passive and no ordinary attack.
- First defeat has a ten-second rebirth. Its end releases the current wave with
  source tracking, fills marked dormant armor SP, and enters the second form.
- The second form's ATK modifier is +25%.
- Blink targets the next route checkpoint; Move_Start and Move_End each take
  0.5 seconds. A one-second buff end forces the active form's Aoe skill.
- Aoe prepares for three seconds, then uses Skill_2_End. Its damage event is at
  float32 43/30 seconds in that clip, whose duration is float32 63/30 seconds.
  The native component splits the physical damage among grounded targets. Its
  second-form auxiliary component splits a fifteen-second stun among eligible
  ranged-tile targets.
- Journey has a five-second initial and repeat cooldown. The left ability owns
  Skill_1 (OnAttack at float32 2/3 seconds); its parallel siblings wait on attack
  events with a separate fixed 1.067-second duration. Their animation-event
  subscription and interruption composition still need explicit handling.
- Each directional projectile moves at 3 tiles/s, lives six seconds, uses a
  radius-0.5 collider, and stops after its first grounded target. Up/down collider
  children have a local y offset of -1; muzzle and world-space transform mapping
  must be resolved before treating them like generic center-origin shots.

The source parameter mapping is corroborated by
[PRTS's Awaken entry](https://prts.wiki/w/“唤醒”). Serialized parameters and exact
Spine clocks do not provide compiled method bodies. Original particles, native
frame ordering, and the remaining boss controller stay separate work.
