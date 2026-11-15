# Security Service danger component

`legion_mode_enemy_boost` now has a reusable source compiler and runtime. It
reads the retained DynamicGlobalBuff controller, its initial blackboard,
attribute modifiers and healing template. It accepts the source's initial
level, per-wave caps, HP/ATK/DEF/movement/attack-speed increments and explicit
trap blacklist. Unknown parameters, including `danger_grade`, remain blocked.

The pinned controller supplies the 50-second initial delay and interval, a
maximum of 50 levels and a pause during wave post-delay. The native defaults
increase HP by 25% and ATK/DEF by approximately 5% per level. The small floating
point difference in the serialized ATK/DEF values is retained. Regional
variants replace those increments, rather than layering an additional copy.

The [PRTS mode guide](https://prts.wiki/w/%E4%BF%9D%E5%85%A8%E6%B4%BE%E9%A9%BB)
and [Terra Wiki mode guide](https://arknights.wiki.gg/wiki/Stationary_Security_Service)
corroborate the timer, additive growth and inter-wave pause. Public
[DynamicGlobalBuff declarations](https://github.com/AdoreJc/ArknightsDB/blob/95ce0f0823f233389fa97e0d7fc9d1759e58464e/source/dump/Torappu/Battle/DynamicGlobalBuff.md)
identify the refresh clock, stack cap, wave-start callback and post-delay
account. These declarations do not contain executable method bodies.

The runtime consumes the existing wave scheduler. Simulation ticks advance
one clock; post-delay and a finished program stop it. Periodic rises at a wave
cap are discarded, so moving to the next wave cannot apply accumulated levels
in a burst. This is the simulator's explicit cap-boundary policy; native
sub-frame timing and the precise refresh phase after a prolonged cap are not
certified. Wave-limit lists with a different length from the source program
remain blocked until their indexing is reviewed.

A single persistent buff adds percentage attributes to existing enemies and
new spawns. Changes preserve the engine's HP ratio and do not heal injured
enemies to full. Hostile devices are excluded. The new additive `aspdPct`
primitive uses `(base + flat) * (1 + percentage sum) * final multipliers`, so
percentage attack speed is not approximated as a flat bonus or confused with a
final multiplier. `stageDangerChanged` exposes each actual level increase for
future source-owned mechanics.

Eight focused tests and 80 combined stat, buff, operator-runtime, environment,
scheduler, deadline and core regressions pass. Of 226 source stages requiring
this controller, 204 now compile their environment components; seven still
need night-map behavior, thirteen have unreviewed wave-limit mappings, and two
use `danger_grade`. Security Service's mode gate remains: tactical equipment,
relief, waiting/reserve/rest zones and permit-based calls are not yet implemented.
This component does not advertise those stages as complete or loadable.

All 882 already-loadable stages also passed the 10-second runtime smoke check.
The source and validation checkpoint is recorded in
`data/arkpedia-stage-danger-review.json`.
