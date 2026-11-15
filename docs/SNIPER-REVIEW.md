# Sniper and Sniper Leader

`enemy_1047_sagent` and `enemy_1047_sagent_2` recover one SP per ordinary attack,
hold two SP and replace their next eligible attack with a separate stun shot.
The regular feature uses one shared `chargedStatusProjectile` factory. Silence
prevents spending SP while ordinary attacks continue charging to the cap.

The retained `StunAttack` wrapper is silenceable, is not cast like an ordinary
attack, resets the main attack cooldown at cast end and has no stun immunity.
Its cast uses the fixed `Skill` animation and `projectile_sagent_s1`, applies
100% ATK physical skill damage, and carries one resistance-aware stun buff.
The two original skeletons retained in `data/arkpedia-sniper-source.json` share
an OnAttack event at 25/30 seconds and a 50/30-second clip. One set of clocks is
stored with both source receipts. Attack speed does not shorten this cast;
native slowdown stretches it. Control interrupts the cast and consumes spent
SP; a projectile already released continues independently.

The projectile travels at speed 10 with a five-second lifetime. Damage and the
5/15-second stun resolve on impact; there is no immediate extra normal hit.
The shared targeting path retains range/taunt/blocker selection and rejects
flying targets. A shot survives source death using its launch ATK snapshot,
and retirement of its target does not transfer the shot to another unit.

Tests distinguish charge, casting, flight, damage and stun; check status
resistance, silence, interruption, source/target death and slowdown; and reject
altered native projectile evidence. PRTS Sniper/Leader revisions 436076/436077
corroborate attack recovery, ground-only targeting and the stun durations.
This does not certify compiled native FSM transitions, interrupt refund behavior
or client-frame parity beyond the retained animation event clocks.
