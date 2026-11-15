# Steam Tank bombardment

Both Steam Tank variants now share the existing timed-cast controller and a
reusable sampling projectile. Cannon waits ten seconds initially, then uses a
25-second cooldown from cast start. It selects the eligible unit with highest
maximum HP inside the enemy's record range. At the original Skill OnAttack
event, 121/30 seconds into the ten-second clip, it places one fixed bombardment
area at that recipient's current position. An invalid recipient falls back to
its captured input position. Later audio events do not fire extra projectiles.

The original x-4 nine-cell footprint samples the eligible occupant with highest
current HP percentage every .5 seconds, waiting the first period. At most ten
accepted selections occur within the carrier's six-second lifespan. Each owns
a .2-second delayed Arts hit for .55 source ATK, using the normal attack type,
no apply way, normal damage modifiers and source credit. Recipient removal or a
different deployment cancels that receipt. Source death stops new selections;
already accepted delayed receipts can complete. Ordinary attacks remain
speed-four physical homing shots with a twenty-second maximum lifespan.

Cast-owned protection maps native unbalance immunity and stun, freeze, sleep,
silence and levitation immunity to the shared controller. Slow Down affects the
cast clock independently of cooldown. Finishing restores the previous attack
restriction and removes only this cast's movement/protection state.

Admission retains and checks both source records, the wrapper, protection buff,
lock selector and original trigger geometry, the single delayed damage template,
bounded projectile and highest-percentage selector, original x-4 cells, animator
binding and skeleton events. The Global pinned damage template uses an older
schema than the CN inspection table; the gate checks fields actually serialized
in that retained Global version.

Range projection follows the existing enemy engine's record radius plus the
shared ally body radius. Fixed destination timing, root-tile occupancy, stable
deployment-order tie breaks, projectile expiry-before-sampling, pending payload
ownership across source death and simultaneous-source delayed hits are explicit
local mappings. Compiled C# methods, native particle/audio playback and exact
Unity-frame parity are not certified. The initial native preparation note is a
historical checkpoint; this review describes the implemented adapter.

The initial combined suite passes 208 tests. Focused checks cover target rules,
bounded pulses, ordinary attacks, source invalidation, replacement deployments,
stationary footprint, cast protection and Slow Down. Both original models decode
all twelve clips on desktop and mobile; the desktop gallery was inspected.
Compilation admits 918 of 3,892 stages, with 690 of 2,163 enemies supported.
