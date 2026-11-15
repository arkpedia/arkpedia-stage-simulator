# Sarkaz Witherer corruption

Original `PollutedDie` components for both Witherers, their shared projectile,
and `projectile_on_killed` / `polluted_area` templates are retained in the native
enemy evidence. Admission checks the complete talent signature, fixed projectile
circle, selector, lifetime, Silence predicate and damage classification.

The pool's actual radius is 1.7, from its non-scalable circle. The database's
`projectile_range: 2` is not consumed by that selector. Killed, unsilenced
Witherers create an eight-second pool; leaks and silenced deaths do not.

Corruption now shares one exposure buff across Witherers and existing Wither Tank
pools. It waits one second after a unit enters, removes the buff on leaving, and
keeps one pulse cadence through overlaps. Damage is source-owned True periodic
damage, not environmental damage, and grants no defensive SP. Root-tile height
chooses the low/high value even for airborne units. The source selector reaches
hidden-from-targeting allies but excludes traps/devices. Destroyed sources retain
attribution while their projectile lives.

Global enemy talent multipliers apply only to matching blackboard keys in the
complete stage enemy/child closure, and each matching key must be explicitly
declared by its implemented feature. Absent keys remain no-ops: 11-5 includes
Rot Eater parameters without a Rot Eater. 11-2 scales Witherer corruption ×4;
11-3 scales it ×2. None rewrites the global enemy catalogue.

Tests cover death versus leak/Silence, the 1.7 boundary, entry/exit clocks, overlap,
airborne and target-free recipients, defensive SP, source attribution and actual
stage multipliers. Existing regular and legacy Witherer/Wither Tank tests pass.
Native animation/frame timing and heterogeneous overlapping pool precedence are
not certified. The local overlap policy retains the first covering source until
it leaves/expires, preserving cadence if another source still covers the unit.
