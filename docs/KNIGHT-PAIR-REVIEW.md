# Corrupted and Withered Knights

The two retained native prefabs share one controller with separate melee and
ranged paths. Both levels of each original record pass the same native gate.
The controller reuses common projectile transport, damage/status accounting,
area selection, scheduler and death events; stages carry only original records
and configurations. Original skeleton clocks share one art bundle, and the
clock generator retains event times and hashes without copying artwork.

Corrupted Knight hits its blocker and applies independent Physical splash to
the surrounding four ground tiles. The primary target is excluded from splash;
camouflage does not protect splash recipients, while air and untargetable units
are excluded. ChargeAttack requires a living blocker, has a 22-second cooldown
and uses the source's four-second duration. The local duration-animation mapping
places the Skill_End clip at the end of that duration and releases damage on
its OnAttack marker, about 2.967 seconds after cast start. It deals 3×ATK before
DEF to the locked target and independently to the four surrounding tiles. Stun
cancels an unreleased cast. This mapping retains the exact clips and event but
is not compiled client-frame verification.

Withered Knight's ordinary attacks launch two Arts projectiles. Its skill
selects up to three targets at cast start and releases homing arrows on the
one-second Skill marker. The source projectiles travel at ten tiles per second
with a five-second lifetime. Their arrival attaches a harmless delayed buff;
after 2.5 seconds, each surviving recipient receives 1.6×current source ATK Arts
damage and independent four-neighbour splash at its current position. The
original template explicitly checks that the source is alive. Source death,
recipient removal or removal of the attached buff prevents detonation. Arrows
already released survive source removal, but their payload still obeys that
source-alive check. Buff removal and direct damage follow the original action
order. Each primary and splash receipt retains its own damage modifiers.

Each knight watches the exact opposite native prefab. Its death grants one
permanent +80% ATK, +100 ASPD and +150% movement-speed buff. Same-kind deaths,
escapes and repeated deaths do not stack the buff. Newer spawns do not
retroactively inherit a death that occurred before their registration. The
original presence-controller disappearance ordering is not verified; the local
contract follows the published partner-death behavior.

The native gate checks the selectors, target counts, opposite identities,
projectile lifecycle, animation bindings, damage templates, parameter schemas
and rage modifiers. Focused battle tests cover missed primaries with independent
splash, finite charge timing and interruption, real projectile travel, delayed
payloads, recipient movement/removal, source death and nonstacking partner rage.
Newly unlocked stages remain in the developer catalogue. Ordinary attack windup,
cast cooldown ordering, interruption boundaries and native visuals are not a
claim of exact Unity playback. Published behavior is corroborated by PRTS's
[Corrupted Knight](https://prts.wiki/w/%E8%85%90%E8%B4%A5%E9%AA%91%E5%A3%AB) and
[Withered Knight](https://prts.wiki/w/%E5%87%8B%E9%9B%B6%E9%AA%91%E5%A3%AB) entries.
