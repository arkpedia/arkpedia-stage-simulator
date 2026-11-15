# Vector Breakthrough side-stage deadlines

A shared `strife_mode_feature` environment now compiles the source's single-wave
kill-all objective. It reads `duration_of_each_wave` from either the numeric or
single-integer string encoding, requires `must_kill_them_all_one_wave = 1`, and
retains the source duration. No stage ID appears in the compiler or runtime.

The native prefab uses a specialized controller, not an empty generic buff:
its script is `257254889598074357`, with no attached unit/deck buffs or initial
blackboard overrides. The pinned `arkpedia-environment-native-source.json`
retains it from `battle/prefabs/[uc]globalbuffs.ab`. Public native declarations
for [StrifeModeGlobalBuff](https://github.com/AdoreJc/ArknightsDB/blob/95ce0f0823f233389fa97e0d7fc9d1759e58464e/source/dump/Torappu/Battle/StrifeModeGlobalBuff.md)
identify per-wave durations, a remaining-time account, the kill-all flag and
`_FinishCurWaveBecauseTimeUp`. They do not provide executable method bodies.
[PRTS's Vector Breakthrough guide](https://prts.wiki/w/%E7%9F%A2%E9%87%8F%E7%AA%81%E7%A0%B4/2024)
explains that a side-stage control point requires defeating all its stationed
enemies before the time limit. The original levels provide the 180-second value.

Admission currently requires one immediate wave, zero pre/post delay, no
independent wave timeout, and default environment targeting. Existing levels
can contain several fragments inside that one wave. Multiple duration values,
multi-wave programs, alternate objectives, targeting overrides and extra-data
mode remain blocked. This does not implement the main mode's timed multi-wave
transitions, progression, garrisoning or tactical equipment.

The environment installs a deadline measured in battle simulation time. The
common battle end check resolves ordinary clearance first, then expires the
objective. A last enemy killed during the final processed tick can therefore
clear the stage. Pending wave actions and enemy-owned work still prevent early
clearance. Expiry ends with reason `deadline`, without inventing enemy deaths,
escapes or their associated rewards. Generic engine timeout accounting is
unchanged. These are explicit simulator tick-boundary semantics, not a claim
of native sub-frame ordering.

The HUD reads the same deadline account, displays the remaining time, and
freezes while paused. The result says "Time expired" and reports unresolved
enemies. A restart constructs a fresh deadline. The stage's source squad,
terrain, enemy definitions and wave program still load through shared components.

At this checkpoint, 67 environment, objective, HUD, scheduler and battle-core
checks pass. Source compilation automatically unlocks 19 compatible side
stages; stages with other unsupported enemies or devices remain blocked.

All 882 available stages passed the 10-second constructor/runtime smoke check.
Four desktop/touch browser cases loaded original levels, checked the 3:00 and
2:59 displays, reached expiry with diagnostic enemy holds, and restarted with
a fresh deadline. Countdown and expired-result touch screenshots were visually
reviewed. This is objective/HUD validation, not a playable-clear certificate.
The final strict native-option mutation checks also pass.

The checkpoint receipt is `data/arkpedia-stage-strife-deadline-review.json`.
