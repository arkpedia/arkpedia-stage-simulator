# Withered Altar, Beacon and Storm pursuit

The pinned `trap_161_lrcage` prefab is in the shared token-1 bundle. Its passive
skill has no separate prefab or blackboard. Character levels interpolate from
2000 to 5000 HP; the card costs 5 DP and has a 30-second deployment cooldown.
It creates an enemy-side character on a ground deployment tile, occupies no
operator slot, does not rewrite the tile or block routes, and cannot retreat.
Operators can damage it. Native immunities cover stun, cold, freeze, levitation,
silence and sleep. The shared status catalogue now recognizes explicit cold and
disarm immunity in addition to the existing immunity fields.

On lethal removal, `trap_stormcoord[summon_and_suicide]` creates one
`enemy_1421_lrchld` at the Altar's position, with a 9999-second route wait and no
life/kill-counter contribution. Supply-spawned enemies are explicit registry
dependencies: both preflight and compilation require their supported records,
even if they do not appear in the stage's scheduled waves. Occupancy and the
inspector use the common supply account; withdrawal permission is declarative.

The Beacon's retained native body has no attack, cannot move on its own or be
blocked, but can be pushed and pulled. Its damage modifier floors HP at 100% of
maximum HP; it remains targetable and is not marked invulnerable. Native status
immunities and the `immune_shu_blink` marker are retained. It cannot exit through
the goal. Persistent non-counting props explicitly opt out of holding victory
open; this is separate from ordinary enemies' kill-counter participation.

The Active Originium Storm now includes its previously omitted body and pursuit:
invulnerability, healing/block restrictions, no ordinary attacks, cold/disarm
immunity and the teleport marker. Every two seconds the native TraceStorm
selector picks the newest living Beacon and snapshots its tile. Movement reuses
the ordinary ground route planner and current speed, including obstacles; the
Storm cannot exit and does not hold victory open. The existing shared pollution
controller continues to own damage, SP penalties, consumption and radius growth.
SE-6's zero-capacity SP record is explicitly admitted for this passive controller,
without adding a skill. Identical original immunity assertions are accepted;
changed immunity overrides remain blocked.

Sources: [Withered Altar](https://prts.wiki/w/枯朽祭坛),
[Beacon](https://prts.wiki/w/信标), [Active Originium Storm](https://prts.wiki/w/活性源石风暴),
retained native prefabs, templates and pinned original level files. The normal
and Adverse Chapter 14 variants use their own original level mappings; shared
immutable evidence still stores each level once.

Limits: native VFX, the Beacon's visual-marker transfer, push-distance medal log
and exact TraceStorm arrival/pathfinding parity are not certified. The retained
controller's 0.3 selector tolerance is checked by admission; runtime routes use
the common tile-centre arrival convention. Altar Keeper pickup and siege-device
behavior remain separate dependencies. All newly added stages are developer-only.

Validation covers source mutation refusal, level stats, side/occupancy, payment,
retreat refusal, immunities, death-spawn ownership, HP floors, displacement,
victory, Storm pursuit and existing pollution interactions. Browser checks cover
card placement, HP inspection, the hidden retreat action, Beacon release and
Storm retargeting. Wave receipts count every scheduled spawn; these controlled
checks are not full playable clears or native visual-fidelity approvals.
