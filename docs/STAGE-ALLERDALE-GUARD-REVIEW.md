# Allerdale's Guard

`trap_087_allady` (PRTS 阿勒黛的卫护) is the chapter-11 supply card in 24 published stages (11-5 through 11-20 and their adverse variants, and H11-4 adverse). In 11-19 it is also placed as hidden instances.

## What changed (2026-11-24)

The card used to put a 1,000 barrier on the 3×3 around itself the moment it was deployed. That barrier never expired, and the card then stayed on the field. The pinned prefab says otherwise, so the card now:

- asks for a facing;
- after its 1 s `Start`, attacks the ally on its own tile or on the tile it faces (range `1-1`; own side, nearest first);
- shields that ally and the 3×3 around it;
- leaves when its cast ends.

With nobody there it stands idle.

## Native evidence

`shared/arkpedia/stage-allerdale.js` (`alladyNativeReviewed`) pins:

- **Default mode (skill index 0, the card).**
  - The mode's attack plays `Skill`: 2.17 s, with OnAttack at 1.2 s.
  - It puts `trap_allady_t[stay]` on the target. Its template is `trap_allady_protected`, with one trigger 1 s later.
  - The trigger runs `CreateBuffInRange` over `x-4` (3×3, allies) around that target. The buff is `allady_shield` (`trap_allady_shield`): `BlockDamage` of any attack, up to `dynamic` 1,000, lasting `shield_duration` (10 s).
  - When the cast ends, `trap_allady_killself` (`_runActionOnEvent` 3) removes the Guard.
  - The barrier therefore lands 1 + 1.2 + 1 = 3.2 s after deployment. The Guard leaves at 1 + 2.17 = 3.17 s.
- **S2 mode (skill index 1, `sktok_allady_2`).**
  - `switch_mode_restart_fsm` to mode 1, which fires `projectile_trap_allady` at `tile_end`.
  - The projectile only selects Steam Knight S (`_filterID enemy_1534_stmkgt2`) and deals the Guard's ATK, which is 0 at level 1. The shield seen on the protection point has no effect, so this mode is implemented as an appearance that leaves 3 s after its cast.
- **Other pins.**
  - The `1-1` range: own tile and the one ahead.
  - `sktok_allady` blackboard: `dynamic` 1,000, `shield_duration` 10.
  - The clock (`data/arkpedia-allady-animations.json`): `Start` 1 s, `Skill` 2.17 s with OnAttack at 1.2 s.

The compiled family is `alladyDefinition`, with variants level 1, skill level 1, skill index 0/1. The runtime is `server/sim/content/arkpedia-stage-allerdale.js`; the card and the placed instances share it.

## Verification

`test/arkpedia-tokens.test.js`:
- **Facing an operator.** No barrier on the Guard; none on the operator at 3.1 s; the Guard gone at 3.3 s; the operator shielded (1,000) at 3.3 s; the shield still there at 13 s and gone by 13.4 s.
- **Facing nobody.** The Guard stays idle.

In the browser, 11-5's card now shows the facing picker. The library rebuild changed exactly the 24 stages with the card (the `chooseFacing` flag); the legacy 11-5 smoke files carry the same flag.

## Boundaries

- **Unconfirmed in game.** The 3×3 centred on the faced ally and the 10 s duration come from the prefab and templates, not from a game check.
- **Unmodelled.** The SP skill `sktok_allady` (SP 5, 3 s pre-delay, same selector) is never reached: the mode's attack fires first and the Guard leaves.
