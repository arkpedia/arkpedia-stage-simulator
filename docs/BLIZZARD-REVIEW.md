# Blizzard source review (not admitted)

The pinned character/skill tables and original `trap_050_blizzard`,
`sktok_blizzard`, and `sktok_blizzard_2` prefabs are retained in the shared device
source files. Their recursively referenced buff templates are retained once.
Blizzard remains blocked by stage preflight while its runtime is unfinished.

Original levels use multiple hidden instances at the same coordinate, distinguished
by alias, and activate them through `ACTIVATE_PREDEFINED` wave actions. Their
skill overrides include duration and sometimes delay. Ordinary Blizzard and the
second freezing mode select different skills. A correct implementation must
preserve alias identity, source activation times, direction, and bounded skill
overrides; static coordinate matching cannot represent these instances.

The original ally/enemy holders have a two-second first trigger and ten-second
interval. Target attachment and the active wrapper have their own lifetimes and
selection rules. These must be reconciled with the global wind sequence before
admission; a single periodic global Cold timer is insufficient. The second mode
has an additional 4.95-second Cold path. Original templates distinguish e2c/c2e
Cold, and directional knockback uses the shared displacement system.

PRTS corroboration: https://prts.wiki/w/暴风雪 . The invisible controller is an
allied device. Enemy stealth/invulnerability and ally isolation matter. Cold,
Freeze, status resistance, directional push, new deployments, reactivation and
expiration need controlled tests. Original snow/wind effects and compiled native
state-machine timing remain separate work.

The generated library now retains source-checked wave/fragment programs and
clear gates (`STAGE-WAVES-REVIEW.md`). The legacy adapter still plays a flattened
timeline. Blizzard activation must join the shared action scheduler when its
instance and Cold/Freeze lifecycle is implemented; independent guessed global
timestamps would still drift when a wave or fragment waits for enemies.
