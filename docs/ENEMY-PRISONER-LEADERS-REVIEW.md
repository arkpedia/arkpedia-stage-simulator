# Caster Prisoners and Recidivists

The four original records use the same native prisoner controller as Sniper
Prisoners. A shared source contract validates confinement counters and warning
listeners. Their original .05-second warning precedes the next before-attack
liberation. Ordinary mode changes retain the current cast; forced liberation
and reconfinement cancel an unfinished cast and restart the ordinary interval.

Caster Prisoners start disarmed, with -50 ASPD and +300 DEF. The source database
replaces serialized confinement attributes; the extra local DEF passive applies
once. Liberation removes confinement and enables two-target Arts projectiles,
with prison-tag priority and ground targeting. The ordinary sequence helper
captures each target's deployment separately while retaining one attack receipt,
ID and cooldown. The source Attack marker is 17/30 seconds; projectile speed and
lifetime are ten. Emitted shots share the existing projectile transport.

The global ASPD aura reuses OwnedStageAura: independent owners contribute one
named effect, the strongest contribution wins, and removal immediately falls
back to another owner. Normal/elite contributions are +30/+50. Same-side
selection respects hidden, sleeping and isolated recipients; opponent-only
TARGET_FREE does not exclude them. Recipient silence removes the silenceable
buff. Source disappearance alone does not detach it, while source death or map
exit does. Strongest-owner precedence is an explicit local projection of the
non-stacking aura; compiled-client override ordering is not certified.

Each Recidivist's first liberation frees other eligible prisoners, using their
shared liberate callback. Its once guard belongs to that source and is set
before cascading callbacks, preventing recursion. Reconfinement does not restore
the guard; a new Recidivist can release the field independently. Source attacks
use the grey/orange/red body clips, with a one-second release marker. Liberation
exchanges the confinement modifiers for +50% ATK.

Native admission checks modes, selectors, database buffs, source action nodes,
source-owned once guards, aura options, transport and original skeleton clocks.
Fixed-tick ordering, ordinary core receipts, stat buckets, cancellation and
snapshot fallback are local mappings. Original animation speed caps under
extreme ASPD, compiled-client ordering, particles/audio and frame/pixel parity
remain outside this review. Existing Imprisonment Devices keep their labelled
fallback body until native mesh/Animation rendering is implemented.

Twelve focused tests pass. The combined regression run passes 81 tests, followed
by the focused exit-cleanup test. Original MB-5, MB-6 and MB-7 resolve their full
wave schedules under controlled kills. All 949 available stages pass ten-second
constructor/runtime smoke checks. The four original bodies pass 56 clip checks
on desktop and touch, and the desktop gallery was inspected. The shared asset
repository validates 3,778 models. No stage-specific enemy implementations or
duplicate art copies were added.

Admission reaches 701 of 2,163 enemies and 949 of 3,892 combat stages: fourteen
more stages become available from these four reusable enemy definitions.
