# Hovering state and mode-local talents

The old regular-stage hovering handler wrote `enemy.flying`, which targeting,
blocking and displacement never read. Dublinn Flying Soldiers and Squad Leaders
now use the existing shared `float`, `unblockable` and `noDisplace` state. They
retain their ground route. Accepted stun, freeze, sleep or levitation disables
hovering immediately, including controls shorter than one simulation tick.
The source mode switch is permanent and supplies a half-second fall stun.
The grounded form uses ordinary melee combat. Silence, a single Cold effect,
rooting and rejected controls do not cause that switch.

Lost Hovercraft uses the same transition with its own source parameters: no
attacks while hovering, no additional fall stun, and an additive 0.35 movement
speed talent only in the grounded mode. Its speed is therefore 0.35 before the
transition and 0.70 afterward. Repeated controls cannot stack that talent.
Its native kill and objective counters reuse the stage outcome controller.

The extractor retains mode ancestry for these three prefabs. The support
builder verifies it against the pinned native timing index before admission.
The hovercraft speed component must be a descendant of the original ground
mode and not the air mode. This prevents a same-named talent from being applied
globally simply because its blackboard appears in the enemy database.

The source contracts check the hover flags, control sensitivity, mode reference,
one-shot recovery wrapper, empty recovery actions, ground combat, speed modifier,
visual-only mode effects and result counters. Tests exercise all three Hovercraft
database levels, actual airborne targeting and blocking, short controls, rejected
controls, permanent grounding, one-time speed changes and falsified ancestry.
Desktop/touch controlled fixtures check the Hovercraft state and result account.

These changes do not certify native animation or frame timing. Dublinn's
airborne projectile presentation and the native Change animation timing remain
separate fidelity work. No extra artwork is copied for the mode transitions.
