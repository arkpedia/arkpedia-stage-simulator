# Gramophones

The trap_014_tower controller retains three original skill ranks: neutral at
50 SP, enemy-controlled at 0 SP, or ally-controlled at 100 SP. Instances retain
their original rank and level. A checksum-verified native skin binding resolves
Actived and Switch to the one-second capture_01 and capture_02 animation clips;
tools/arkpedia/gramophone-animations.py reproduces that receipt.

Control mode is separate from faction. The device always remains enemy-side,
as in the original prefab, and does not count as a wave enemy or consume a
deployment slot. It is invulnerable, cannot retreat, and its tile blocks ground
movement and deployment. Native three-dimensional tile height and skin rendering
remain outside this controller.

Each operator or summon in the five-cell charging range supplies one SP per
second on its own recipient clock, ignoring target-free states. Ordinary stage
traps do not charge it. Leaving range resets that recipient's clock. Every
0.1 seconds the device checks for full or empty SP, changes mode immediately,
cancels its pending cast and waits through the one-second transition. Intermediate
SP retains the current mode. The bounded modifySp method is the common interface
for Whisperer drain and Blood Shaman capture. The controller also maintains the
original charging marker for Matterllurgist target priority. Unsupported enemy
families remain gated. Display colors follow control mode without changing faction.

Controlled modes attack in the original x-2 range, preferring higher taunt then
higher maximum HP. The 0.55-second release follows ASPD; the 1.5-second interval
uses shared attack stats. A homing projectile travels at ten tiles per second and
applies five percent of the recipient's maximum HP as ranged Arts attack damage
through the shared RES, dodge, shield and damage pipelines. Released projectiles
survive mode changes. Each five-second healing trigger selects the lowest-HP-ratio
wounded friendly recipient and restores ten percent maximum HP after 0.55 seconds.
Healing uses the shared healing restrictions and modifiers.

Target restrictions remain relative to the permanent enemy faction: allied
camouflage and target-free states prevent both attacks and healing; enemy
target-free states do not, but enemy isolation does. Airborne recipients remain
eligible. Target life identity prevents pending casts from following redeploys.
Equal-priority targets use oldest deployment as a deterministic local policy.

Tests cover all three ranks, source changes, individual charging clocks, summons,
capture/recapture timing, fixed faction, ATK-independent percentage damage, taunt,
RES, healing, camouflage, isolation and released projectile lifetime. Compiled
client event ordering, native mesh/effect/audio playback, skin-specific capture
timings and exact zero-damage base-hit callbacks are not claimed. This controller
currently uses the shared marker, projectile visual and inspector.
