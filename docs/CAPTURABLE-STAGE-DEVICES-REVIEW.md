# Capturable stage devices

Gelato Stops use the original `trap_057_wpnsts` record, two native modes and
both original skill variants. A stage stores only position and its verified
level/rank/skill index. Skill 1 starts allied; skill 2 explicitly switches to
enemy mode. Both share one source record, range, controller and rendered unit.
The original skill's `switch_mode_no_restore` action establishes the second
variant; a missing/default mode index alone does not establish its side.

The station has 25,000 HP, zero DEF/RES, taunt -1, zero deployment slots and
75 HP/second regeneration. It cannot be healed by other units. Native status
definitions establish displacement and elemental immunity; the source also
rejects Stun, Freeze, Silence, Cold, Disarm and Sleep. Environment immunity
checks the explicit damage classification, not merely a missing source.

The 13-tile diamond supplies one SP every two seconds to its faction's eligible
units. Recipient clocks start on entry, end on exit, and do not stack across
overlapping stations. Operator recovery uses the ordinary SkillRuntime account,
including active-skill and blocked-recovery rules. Enemy recovery uses the same
bounded ammunition account as the Pathfinder families. Tokens and traps are
excluded by the native profession mask. Later enemy SP skills must connect to
the shared account before admission; a bespoke cooldown is not refillable SP.

At a lethal HP-set attempt, the station deals 1,000 Arts damage and independently
applies five-second Stun to eligible nearby units on its former side. It changes
targeting side immediately, spends 20 seconds rebooting, then returns at full
HP. Reboot pauses its aura and regeneration. Captures retain the same tile and
unit; they grant no kills, wave progress, life change or deployment transaction.
The common `changeDeviceSide` operation updates both rosters and target buckets.
Enemy-held devices do not hold an otherwise completed battle open.

The passive inspector displays faction and reboot time, and the fallback actor
changes faction color with an orange reboot gauge. GA-4's browser interaction
receipt checks a real tile click, hidden activation button, induced capture,
countdown, color and full-HP recovery. The four initial stages also retain
complete-wave receipts with raised life, not playable-clear claims.

Native device/skill components, action templates and numeric status definitions
are retained and checksum checked by `extract-device-native-source.py`.
Behavior tests cover repeated capture, immediate selection changes, blast
evasion versus independent Stun, overlapping refill, active-skill locks,
ammunition capacity, immunity and removal bookkeeping. These checks do not
prove exact Unity event ordering, animation-frame parity or native visuals.
Original device skeletons/effects and hidden scheduled activations remain work.

GA-EX3's normal and challenge modes share four positions but select different
original predefined aliases. The compiler resolves `level_predefines_enable`
against the pinned original instances before validation, then retains exactly
one active station and its skill index at each position. It rejects unknown
aliases, duplicate active occupancy, missing source instances and scheduled
activation, including schedules for currently hidden devices. Inactive initial
instances do not create duplicate units, map blockers or assets.
