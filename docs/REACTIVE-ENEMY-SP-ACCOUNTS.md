# Reactive enemy SP accounts

`reactiveEnemySpAccount({cost, initial = 0, rate = 0, perHit = 1,
cancelDamage = false})` composes the existing `SkillRuntime` with accepted
incoming HP-damage attempts. It is a reusable compiled-plan component loaded
only for selected definitions that request it.

The account clamps SP normally, honors SP-cost and recovery modifiers, retains
time recovery during stun, and respects `noSp` for both time and explicit hit
grants. Initial SP uses the ordinary deployment reset. It never automatically
casts: a linked-object or stage controller can read `unit.skill.ready` and
perform its own source-defined operation. Routed enemies tick the account
once through feature dispatch; placed tokens/devices are refused because the
common engine already ticks their skill accounts.

The new `targetDamageModifier` hook runs after hit protection, accuracy, dodge
and the observational `beforeTargetModifier` receipt, before mitigation and
shields. Setting `context.cancel` rejects only the current recipient's damage.
It does not modify a normalized DamageInfo shared with other area recipients.
Fixed, unmodified True damage and hit-count bodies enter the same accepted
phase. Element gauges and direct HP loss retain their separate pipelines.
Replacement of the target's deployment life or newly applied protection is
rechecked before damage continues. Consumers should use the context's cancel
field rather than changing the shared damage packet.

With `cancelDamage: true`, an accepted hit grants explicit SP and preserves HP
and barriers. A packet marked `noSp` still grants this explicitly configured SP;
that flag suppresses ordinary defensive recovery, while the target's `noSp`
status blocks every grant through SkillRuntime. Misses, existing protection
and earlier hit cancellation do not reach this hook. Each body's listener is
owned by that body and released through normal removed-owner cleanup.

Dream Tile is the motivating source: its `enemy_hlslp[end_sleep]` template
cancels incoming damage and grants one SP; variants have time-based 40-SP or
hit-based 7/15/40-SP accounts. This primitive does not register those enemies.
Their same-tile host binding, healing grants, stage sleep state, wake-up
restoration and helper removal must be implemented together. Native inspection
is cached at `.cache/arkpedia/dream-tile-native-inspection.json`.

Tests cover recipient-local cancellation, existing hook order, both damage
pipelines, shield preservation, replacement-life handling, initial SP, bounded
time recovery, stun/noSp behavior, independent owners and listener cleanup.
