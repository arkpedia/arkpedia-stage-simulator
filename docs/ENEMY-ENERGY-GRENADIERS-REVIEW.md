# Blacksteel Grenadiers

Both Grenadier variants reuse the energy meter with capacity 30, initial energy 25, five-second decay and twenty-second overload. Their ordinary body now composes a shared blocking/projectile sequence: the blocker receives a full-ATK Combat hit; an unblocked ground input receives a half-ATK grenade on the native Attack marker. The blast uses the original 3x3 collision box, including ordinary flying collateral even though flyers cannot be selected as the initial input.

The new sequence shares captured-target, animation-clock and release machinery with Redmark. Entering block during a ranged windup does not turn that captured grenade into a melee hit. Blocked input remains the blocker despite a higher-taunt ranged unit. Death cancels pending casts while released grenades retain their cached packet. The existing area transport supplies box/collider overlap, projectile lifetime and ordinary damage handling; no actor-ID branch is added.

The native projectile proof retains its parabolic movement, speed five, lifetime ten, range reference, unit-motion options, root transform and box size. Admission rejects a different input filter, scale, target-motion scope, box geometry or foreign range reference. The visual transport remains the shared renderer; original particle and exact trajectory/frame parity are not certified.

Energy decay and finish-clearing now also honor the native eligibility-marker guards. If the marker is removed, decay and finish-clearing skip their guarded action. A completed overload does not restart itself every frame at retained full energy; a later explicit update can start another. A rejected overload attachment retains its retry path. These guards apply to the earlier Gangster/Thief/Defender component too.

The 103 focused regressions pass. Forty-two meter/marker follow-ups and 36 selected-runtime/preflight checks pass, including rejection of a malformed later grenade component before meter attachment. Desktop/touch fixtures verify full blocker damage, half grenade damage, flying collateral and selected loading of only energy/projectile modules. Both original bodies decode twelve clips and render in both galleries. The broad suite retains 1,801 passes, three skips and the same two known Chimera failures.

Combat admission reaches 746 of 2,163 enemies, covering 811 database levels with 204 runtime kinds. Existing 970 published stage graphs remain pinned until the stages phase. No original energy-battery controller or original-stage clear is claimed by these fixtures.
