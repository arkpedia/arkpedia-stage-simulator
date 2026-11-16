# Funlive caster

`enemy_5021_tmagfd` now retains its native five-second `tmagfd_npc_effect` attachment and uses the original Tidal Caster animation/projectile binding. Its canonical ATK remains zero. An external ATK grant exposes the actual Arts packet on the target tile and four orthogonal neighbors; diagonal tiles are excluded. The native elemental ratio is zero, so no Corrosion payload is invented.

The existing on-demand projectile-mode carrier now also accepts an optional finite parent lifetime and validated tile offsets. A single mode with the exact empty native program represents this ordinary projectile actor. Marker expiry neither restarts nor cancels its attack. Death/leakage remove the owned parent attachment. The tile transport shares projectile lifetime, cached damage, captured target and ordinary damage handling with existing projectile carriers. There is no enemy-ID branch in the runtime.

The actor's native skeleton pointer resolves to `enemy_1161_tidmag`. Its original skeleton/atlas/texture bytes match the published body, so the shared asset manifest uses an explicit alias. The actor keeps separate stats, native binding, source receipts and animation roles while downloading the same files. The clock receipt names the actual source skeleton identity.

Eighty-three focused regressions pass, including earlier projectile families and selected runtime loading. Fifty-six additional transport checks pass, including source death after release, native delays and source movement. Desktop/touch fixtures verify the five-second marker, zero baseline ATK, Arts damage under an external grant, continued attacks after expiry, leak cleanup and selected-module loading. The shared original body decodes five clips and renders in both galleries. Native particle delivery, exact compiled callback ordering and original Funlive scenario controllers remain outside this fixture.

Combat admission reaches 738 of 2,163 enemies (803 database levels) with 202 runtime kinds. The 970 published stage graphs remain pinned until the stages phase.
