# Tiacauh Shredders and shared stump destruction

Both `enemy_1097_cclmbjk` variants now use one controller. Their native ordinary
selector reaches 1.3 tiles and selects one ground ally. Damage is Physical and
melee, released at the original skeleton's `OnAttack` event (43/30 seconds).
Four releases fill the attack-recovery SP pool. With a valid stump within 1.8
tiles, a separate silenceable cast selects one random eligible tile and
destroys it at the same model event. Stun, displacement and other action
interruptions cancel an unreleased cast; Slow Down stretches its animation.
Silence preserves a full charge until the skill can start.

`StageScenery` owns the terrain operation. It recognizes native wooden-wall
tiles and Giant Mushrooms, including stumps cleared by workers. Destruction
kills allied occupants through the ordinary death/rebirth pipeline and changes
the tile to undeployable, flying-only terrain. The broken-stump state prevents
repeat selection. Mushroom death removes its existing cover aura. Workers
continue to leave the original deployable terrain intact.

Admission checks the retained native attack, selectors, collider radii, skill
wrapper, InstantKill action, broken-stump mode and animation bindings. All are
from the pinned CN source; source mutations fail admission. The two original
bodies are in shared asset commit `8798bd65eccce4ccc977aded7ad1bfadfa59849a`,
with no model copies in the simulator. Their bytes differ, so neither aliases
the other.

This capability admits RI-6, RI-EX-3, RI-EX-5 and RI-EX-7, including the three
EX challenge variants. RI-EX-6 Challenge was independently admitted by the
named token-count rune. The library reached 814 loadable stages.

Validation: combat/terrain and source-mutation tests; all supported enemies
spawned and ran their features; 814/814 ten-second stage smoke checks;
desktop/touch RI-6 destruction and accessible tile labels; both models and all
14 clips decoded and rendered on desktop and touch. Receipts are in
`data/arkpedia-shredder-review.json`.

Limits: this is not native frame or pixel parity. Tile selection uses tile
centers and the simulator's seeded random selection. Native skill arbitration
and frame-phase ordering are not independently certified. Broken-stump height
is retained as 0.4, while the renderer marks the original tile surface with a
fallback cross; native destruction effects and lowered geometry remain open.
