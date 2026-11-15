# Leithanian and Mudrock enemy families

The normal and elite Whisperer, Blood Shaman, Matterllurgist and Zealot records
share four controllers. Admission checks their original prefab components,
selectors, projectile settings and buff templates against the pinned native
source. Unsupported changes fail admission. Models remain in the existing
shared asset bundles; the new animation receipt contains only clocks and hashes.

Whisperers use ordinary ground-only Arts projectiles and a separate capture
channel. After the original five-second initial cooldown they select the nearest
non-enemy-controlled Gramophone in attack range, regardless of their blocker.
The original Skill_Begin event starts a homing link that drains two SP on contact
and each subsequent second, for at most 25 seconds. Empty SP ends the channel.
The 15-second cooldown runs during casting. The link uses the shared projectile
lifecycle, including target validity, expiry and external removal. Recovery
retains the native minimum post-delay. Actual interruption releases its movement
and attack locks; the source records' stun and silence immunity still applies.
The skeleton receipt is reproducible with `tools/arkpedia/whisperer-animations.mjs`.

Blood Shamans lose 400 HP per second through the existing periodic-damage
controller. A killed Shaman emits a source-independent payload after the original
1.3-second projectile lifetime. It caches ATK, hits ground allies within radius
1.5 plus their collider, ignores camouflage, and deals 200% or 250% ATK as Arts
splash damage. A separate trap-targeted payload immediately seizes nearby
Gramophones. Leaking emits neither payload. Seizure and SP drain use the device
controller's common API instead of changing its permanent faction.

Matterllurgists prioritize the original charging marker on operators and summons.
Normal variants select one target and elites select two. Both use the same
physical homing-projectile controller. Gramophones maintain the marker over the
union of charging ranges while retaining independent SP clocks per device.

Zealots reuse the typed layered-barrier implementation: three Arts-only layers,
2000 HP per normal layer or 3334 per elite layer, with +50% maximum HP and
+50 ASPD until the final layer breaks. Shared HP recalculation preserves the
current HP fraction when that bonus ends. Physical and True damage bypass these
layers. The bonuses remain through silence.

Tests cover both variants, charging-priority cleanup, two-target attacks, barrier
overflow and HP scaling, delayed death effects, capture, native immunities,
interruption, protected SP and projectile expiry/removal. Original compiled-client
frame ordering, beam/mesh effects and full visual parity remain unverified.
Stage route sweeps and mobile startup receipts are separate from playable clears.

Mudrock's two database levels now compose the same layered barrier and a shared
priority-based cast controller. Shield refresh replaces all three layers at the
original Skill_2 release event (17-second or 15-second cooldown). The initial
barrier totals 16500 or 20001. HP and ASPD bonuses do not accumulate on refresh.
Occupy selects the nearest eligible Gramophone globally and seizes it at the
original Skill_1 release event, on a separate 35-second cooldown. Higher-priority
refresh wins when both casts are ready. Both casts grant temporary stun and
displacement immunity; native sleep immunity applies throughout her life.
Each ordinary attack adds 60% ATK before its damage, capped at six permanent
stacks. The original skill clocks come from one existing shared art bundle and
are reproducible with `tools/arkpedia/mudrock-animations.mjs`. The six ordinary
attack modes share damage behavior; their native effect/pose changes are not a
full visual-parity claim.

Stage configuration now permits explicit per-skill blackboard multipliers and
initial-cooldown overrides only when the implemented feature declares them.
TW-EX5 challenge doubles elite Whisperer SP drain and scales attack range;
TW-TR1 begins its capture cooldown at zero. TW-EX4 challenge applies a final
0.6 character ATK multiplier through the shared character-rule pipeline.
Catalogue records remain immutable across these stage variants.
