# Stage Turrets

The original trap_007_ballis device, sktok_ballis skill and projectile_ballis
projectile are retained from checksum-verified shared bundles. Each stage keeps
its original level and direction. Older numeric Direction values are normalized
to the same UP/RIGHT/DOWN/LEFT enum; viewer names and positions alone are not
enough to admit a Turret. Hidden scheduled activation remains blocked pending
its own controller.

The device is invulnerable, occupies no deployment slots, cannot be retreated,
and makes its tile nondeployable and impassable to ground movement. Its trap
category is excluded from ordinary character targeting. It belongs to the enemy
side for damage accounting but is not a counted wave enemy or a leaking unit.
Level interpolation gives 100 ATK per level, from 100 through 3000.

Its automatic skill charges five SP, then releases after the retained 0.167-second
pre-delay. Local SP recovery pauses during that cast. Each straight bolt uses the
existing projectile system at ten tiles per second, with a sixty-second upper
lifetime and cleanup at the map boundary. Walls do not stop it. A swept circle
test orders contacts by first intersection, so fast shots cannot skip a unit
between ticks. The retained projectile radius is 0.5 and uses the simulator's
shared 0.25 ally collider. Equal contacts use deployment order as a local tie
policy. Camouflaged or untargetable allies are excluded; ground and air recipients
are eligible. One collision ends the bolt, including a dodged hit. Released
bolts survive source removal. Damage is a Physical skill packet through the
shared DEF, dodge, shield and damage-accounting pipeline.

The inspector shows charging SP and the original firing direction. Tests cover
source gates, level interpolation, numeric directions, pre-delay, first contact,
wall traversal, camouflage, air, dodge and source removal. Shared device tests
cover interaction with existing manual devices, coils and capturable stations.
The native device uses skin/effect objects rather than an ordinary skeleton;
the current display remains a fallback marker and shared projectile visual.
Compiled cast ordering, collider parity, native effects/audio and original
client frame parity are not claimed.
