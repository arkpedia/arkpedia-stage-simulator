# Sniper Prisoner and Elite Sniper Prisoner

Both original Sniper Prisoner records now use their confined, warning and
liberated modes. Their source selector prioritizes the prison tag within range,
after blocker priority and before ordinary taunt. It respects camouflage,
target-free and ground-motion restrictions rather than matching translated
Imprisonment Device names.

The native confinement counter decrements before attacks, ignoring a Palsy
interruption. Its penultimate stack enters the warning mode; the original
.15-second warning installs a listener that liberates the next attack. The
source's no-restart/no-interrupt mode switches are represented by retaining the
current cast's original damage type while changing subsequent casts. Four
captured casts remain physical; later casts use Arts projectiles. Liberation
removes the -50 ASPD confinement modifier and applies +50% ATK. The shared
projectile transport uses speed five, lifespan five, current source ATK while
alive and release-cached ATK after source departure.

Ordinary melee and ranged casts now use the same source-marker sequence helper.
The core still owns one attack receipt, attack ID, cooldown and SP transaction.
Original Attack/Attack2/Attack3 clips release at 28/30 seconds. Control cancels
an unreleased shot; an emitted projectile survives the source and cannot hit a
replacement deployment. Source Slow Down stretches the sequence clock.
Warning/liberated body clips follow the retained original animator replacements.

The controller exposes the shared prisoner liberate callback for existing
field-wide liberation and a confine callback for the forthcoming Imprisonment
Device. Reapplying confinement to an already-confined enemy preserves its
attack count. Reconfining a liberated enemy restores the original attack count
and ASPD modifier. Original Imprisonment Devices themselves remain a separate
unimplemented stage capability; no device is silently discarded.

Admission checks all three attacks/selectors, original counter and warning
nodes, buff-database ASPD definitions, damage types, native projectile transport,
animator replacements and skeleton event clocks. Core attack-receipt timing,
preserving the current cast across mode switches, damage snapshot fallback and
fixed-tick ordering are explicit local mappings. Native compiled ordering,
particles/audio and original-client frame/pixel parity are not certified.

Seven focused cases pass, including original MB-1's complete schedule under
controlled kills. The combined suite passes 281 tests; all 927 compiled stages
pass ten-second runtime smoke checks. Both original bodies pass thirty clip
checks on desktop and mobile, and the desktop gallery was inspected. The elite
body explicitly aliases the byte-identical model already stored for
enemy_5038_dqiprr_2, while retaining its own native source receipts.

Enemy admission reaches 697 of 2,163. There are 927 loadable combat stages out
of 3,892; the remaining Mansfield stages still require devices and other enemies.
