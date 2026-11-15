# Sarkaz Wither Tanks

Both variants share one attack account and the original body clips. Unblocked
attacks select ground bodies on low-ground tiles; blocked attacks ram only the
blocker for double ATK. The account starts with two SP. An ordinary attack adds
one SP, capped at two; a charged ranged attack spends two without charging itself.
Melee attacks preserve a ready ranged charge. The source readiness marker uses
the same account.

Ranged damage uses the existing homing physical projectile: speed four, maximum
lifespan twenty seconds, independent of source death. A charged ranged attack
also emits a separate pollution carrier. The carrier moves toward its captured
target, stops at arrival and retains the last destination if the target leaves.
Its lifespan is ten seconds from emission. Interception or expiry removes only
its pollution field. Moving fields share the pollution system's nonstacking
recipient clock with Twigs and death pools.

The carrier follows the source's profession mask excluding traps/devices, while
ignoring ordinary target-free and camouflage. It can expose ground and airborne
operators. Low-ground recipients take 50 True damage per second, high-ground
recipients 25. Contact waits one second before its first pulse. The source record
supplies the 2.2 field radius and ten-second lifetime; these blackboard operands
are mapped to the shared field and projectile lifetime rather than the prefab's
default 1.7 collider and twenty-second timing values.

Admission checks both records, their initial/max SP and skill operands, melee
and ranged abilities, low-ground selectors, the grouped charged ability,
projectile controllers, pollution template and original skeleton events. Source
Attack/Attack2 clips have one-second durations and release markers at .5 and
11/30 seconds. The existing enemy engine uses these as stance clocks. Its first
attack windup, charged skill/FSM arbitration, parabolic projectile height, native
contact/refresh ordering and exact client frames remain explicit local mappings.
No native particle or audio parity is claimed.

Six focused tests cover cadence, blockers, terrain and flight, source death,
interception, profession filtering and admission mutations. The initial combined
suite passed 216 tests. A controlled 11-9 run resolves its complete wave schedule
and clears without runtime errors. Both original models decode all twelve clips
on desktop and mobile; the desktop gallery was inspected. Other chapter maps
remain blocked by unrelated enemies or conditional programs.

Mechanic cross-checks:
- https://arknights.wiki.gg/wiki/Sarkaz_Wither_Tank
- https://arknights.wiki.gg/wiki/Advanced_Sarkaz_Wither_Tank
