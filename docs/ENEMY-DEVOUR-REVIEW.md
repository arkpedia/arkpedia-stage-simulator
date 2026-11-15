# Wither Devourer and Wither Maw

Both original enemy_1271_nhkodo bodies now use one reusable first-blocker
Devour implementation. The original Attack_A animation releases at 25/30
seconds. The captured blocker must still be alive, deployed, ground-level,
linked to this enemy, and on the same deployment life. Devices, traps and the
original DEVOUR_IMMU tag are excluded. Control and losing the blocker interrupt
an unfinished cast; silence does not suppress this wrapper.

Devour uses the core InstantKill path, preserving rebirth handlers. Ordinary
summons die normally. Operator cards acquire an owner-held deployment lock;
manual placement and skill-driven redeployment both respect it, and the shelf
shows LOCK with the Devoured reason. Source death or exit releases the card and
makes it immediately ready, while retaining normal cost increases and squad
removal rules. Multiple independent card owners cannot release each other's
locks. This card service does not hide a live operator or keep its tile occupied.

At release, the original switch_mode_no_restore action restarts the combat FSM.
The enemy permanently gains +700 DEF and -30% movement speed, switches to its
B body clips, and cannot Devour again. Ordinary attacks on either side of the
switch reuse the shared physical melee sequence and original 25/30 hit marker.
The wrapper's reset-main-cooldown behavior starts an ordinary interval on cast
finish. Captured blocker selection, simulation-tick ordering, additive stat
buckets, core rebirth dispatch and card-ready projection are local mappings;
native compiled ordering, particles/audio and client-frame parity are not
certified.

Admission checks both bodies, passive stat modifiers, trigger selector/tag
validator, cast payload, card/deck creation and finish actions, mode switching,
rebirth flags and original skeleton event bindings. Seven focused cases cover
both variants, source exit, overlapping card owners, summon behavior, immunity,
control, Slow Down, rebirth, source mutation rejection and an original 11-14
manual/skill redeployment transaction. The combined suite passes 250 tests.
All 925 loadable stages pass ten-second runtime smoke checks. Both original
bodies pass twenty clips on desktop and mobile; the desktop gallery was viewed.
Enemy support is 694 of 2,163, with 925 of 3,892 combat stages loadable.

Behavior reference, including immediate card readiness after source departure:
https://arknights.wiki.gg/wiki/Sarkaz_Wither_Devourer
