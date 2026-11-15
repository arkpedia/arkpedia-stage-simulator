# Agents, Duck Lord, mortar shells and Sarkaz Lancers

These families use the existing feature dispatcher and shared engine systems.
Their native components and referenced buff templates are retained by
`extract-enemy-native-abilities.py`; the generated support report identifies the
source hashes. Predicates reject altered parameter shapes and native behavior.

Agent and Agent Leader apply a nonstacking -1 Block debuff for 5/10 seconds after
a connected attack. Reapplication retains the longer remaining duration, even
across attackers. Silence prevents new applications; an existing debuff survives
its source's death. The shared buff system recomputes blocking capacity.

Duck Lord's first damage switches it permanently to the native running mode:
one additive +400% movement modifier, no ordinary attack, and no blockability.
Repeated hits cannot stack the bonus. Existing slow/control effects compose with
the modifier, and all three database levels use the same implementation.

Mortar Gunner and Mortar Gunner Leader use the shared projectile transport. The
original `projectile_mortar` travels at speed 4, lasts up to 10 seconds, survives
its source and hits a 3-by-3 rectangular collider around its locked target. The
runtime tests collider/circle intersections, so diagonal boundary cases are not
approximated as a radius. Splash ignores camouflage and respects area selection;
the still-live locked primary target is included. One deferred ordinary attack
produces one physical packet per affected unit, with no immediate duplicate hit.
Live-source damage reads current ATK; a dead source uses its launch snapshot.

Sarkaz Lancer and Sarkaz Lancer Leader share a charge factory with the legacy
enemy kits. While unblocked, they add 50% movement every 0.5 seconds, up to 25
stacks, including during route waits. Native 0.1-second checks reset the charge
on stun/bind. The first connected ordinary attack adds a separate physical
packet equal to current movement speed times 600/800 and clears the charge.
Movement slows affect that packet; ATK multipliers do not. Remaining blocked
prevents recharge. This corrects the previous legacy ATK-multiplier shortcut.

Focused tests cover source-shape refusal, repeated applications, silence,
control, source/target death, moving projectile targets, range geometry, charge
caps and database-level reuse. These are behavior implementations, not evidence
of full Unity controller, animation or client-frame parity.

## Blocking capacity, kill-log helpers and Crying Thief

Bully and Bulldozer's original root `_blockVolume=3` consumes three free blocking
slots. Capacity three is insufficient when another enemy already occupies one
slot. Death, stun and capacity loss use the ordinary unblock bookkeeping. The
native `Passsive` component and root volume are both retained; a changed volume
fails admission. See `test/arkpedia-native-auxiliaries.test.js`.

Mudrock Colossus and Hexed Colossus have kill-log-only native helpers. The
auxiliary classifier recognizes the retained simple buff script and exact
empty or `log_killed` action graphs, with no attribute modifiers or extra
blackboard parameters. It never fills a coverage gap already partly claimed by
legacy count-based native claims: that could count one component twice. New
selectors, action nodes or modifiers remain blockers.

Crying Thief's ordinary melee attack applies the original four-second stun,
including when its damage is dodged. The native buff is resistance-aware and
not silenceable. Stun removes the victim's blocking ability, so the thief can
become invisible immediately after hitting its blocker. Tests check this
transition, resistance, silence, and the original native signature. This uses
the existing ordinary attack status helper rather than a separate enemy loop.
