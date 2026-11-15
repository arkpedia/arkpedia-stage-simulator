# Sarkaz Maze Returner

The original enemy_2064_skzwdd uses ordinary physical melee outside a Mark of
Epoch and a two-strike Skill animation while touching the shared Epoch field.
Its unsilenceable passive first checks after .3 seconds, then polls at the same
interval. Overlapping emitters provide one contact rather than extra strikes.
The field's public membership query also checks the recipient deployment life.

The reusable ordinary melee sequence keeps the core attack counter, attack ID,
SP receipt and cooldown. It locks one target deployment and resolves the original
OnAttack markers: 20/30 seconds for Attack, and 20/30 plus 44/30 for Skill.
Each strike deals current ATK as normal physical melee damage. No skill damage
classification, damage splitting, or replacement-target selection is added.
The original .3-second passive can switch combat modes during an attack;
detaching its combat component cancels unfinished strikes without restarting
the ordinary cooldown. Control and source death also cancel the sequence.

Original clips run at their retained speed with source Slow Down applied to the
sequence clock. Starting the clip from the local core ordinary-attack receipt,
field membership in place of the global parent buff key, and stable simulation
tick ordering are explicit local mappings. Native compiled method ordering,
particles/audio and client frame/pixel parity are not certified.

Admission checks both mode components, repeat settings, passive template,
parent field key, mode-switch actions, original skeleton binding and marker
clocks. Mutated field keys, restart behavior, repeat count and damage splitting
are rejected. Six focused tests and 239 combined regressions pass. All 919
compiled stages pass ten-second runtime smoke checks. The original body passes
six clip checks on desktop and mobile; its desktop gallery was inspected.
Enemy admission reaches 692 of 2,163. No additional stage is made loadable by
this component alone because its stages still depend on other missing elements.
