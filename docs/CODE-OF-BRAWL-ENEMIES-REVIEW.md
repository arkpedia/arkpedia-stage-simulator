# Marksman, Fanatic and Greytail

Source: pinned CN `battle/enm_pfb_4.ab`, shared projectile bundle and pinned
Global buff templates, retained by `extract-enemy-native-abilities.py`.
The shared feature registry verifies the retained component fields before
admitting either base or elite variant. Changed native predicates remain blocked.

Marksman attacks release three homing Physical projectiles, each with its own
DEF mitigation and a shared attack identity. The original additional-release
interval is .01 seconds, quantized to simulation ticks. Released projectiles
survive source death; subsequent releases require the original source life to
remain able to act. A building-tag target takes priority before taunt, with
ordinary blocker priority preserved.

Fanatic uses the same tag selector and direct Physical damage. Its silenceable
`filtertag_enhance` passive scales damage against buildings before DEF, using
the selected record's 1.5/1.8 coefficient. Silence does not disable selection or
normal attacks. Display names do not determine building identity.

Greytail starts with three independently depleted, Arts-only barriers. Each has
the record's `shield.dynamic` capacity: 2000 base, 3334 elite. Absorption runs
after RES through the common shield pipeline; Physical and True damage bypass
these barriers. Overflow can cross all three original layers in one packet.
The flat DEF bonus persists through the first two breaks. The final break
removes it and adds the native final movement scaler, 1 + 2, permanently.
Neither passive is silenceable. Death or buff cleanup is not a barrier break.

Tests cover damage mitigation, interruption, source/attack identity, tag priority,
Silence, layer overflow, unrelated movement modifiers and changed evidence.
Developer stages receive separate browser and full wave-schedule receipts.
Those receipts do not certify a playable clear: wave sweeps use raised life.

Remaining limits: these families inherit the shared ordinary enemy attack clock;
their native attack animation events and controller timing are not certified.
In particular, Fanatic's retained 1.134 pre-delay is not a new frame-accurate
attack controller. Shared shield feedback does not reproduce every original
barrier-layer visual. This review does not implement the Command Terminal device
or other Code of Brawl enemies merely because they share an event.
