# Tiacauh Brave and Champion

Both original records carry the same `duel` values: -70% DEF for the enemy and
its blocker, -1 enemy taunt, and zero damage from sources other than the actual
blocker. The retained checker requires at least one blocker and owns a
nonstacking blocker buff. The self buff uses the `enemy_cchmpn_t` template:
`CheckBlocked(MODIFIER_SOURCE)`, `IfNot`, then unfiltered `DamageScale`.
A blocker's summoned unit does not satisfy that source check.

`blockedDuel` is a shared feature factory. It updates on block/unblock, status,
incoming damage and simulation ticks. Each enemy owns its self modifier and
its link to the blocker. Multiple dueling enemies share one blocker DEF
penalty; removing one link preserves the others. Death, withdrawal and stun
release links through the engine's existing block ownership events.

The native self buff is silenceable; the blocker modifier is not. Both pinned
enemy records are silence-immune, so ordinary silence is refused. A forced
silence test exercises the underlying native flag distinction without changing
that normal immunity. Unfiltered source exclusion covers Physical, Arts, True
and sourceless damage. The blocker itself can still deal damage normally.

Tests cover actual blocker identity, defense/taunt restoration, overlapping
duels, source death, blocker death and replacement, stun release, silence
immunity and changed-source refusal. The implementation maps the serialized
native graph to the common event system; compiled-client frame parity remains
unverified.
