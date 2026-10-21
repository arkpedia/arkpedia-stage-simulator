# Deployable tokens: implementation plan

60 remaining stages fail only because `stage-geometry.suppliedUnits.deployable_tokens` is non-empty. The stage expects the player to place a limited device (Roadblock, Allerdale's Guard, …), so pre-placing it would change the fight. This is the largest single stage bucket after conditional spawns.

## Data already present

`stage-geometry/<slug>.json` → `suppliedUnits.deployable_tokens`, for example:

```json
{ "id": "roadblock", "count": 5, "name": "Roadblock", "description": "..." }
```

The count and display name are reviewed; the placement legality is the normal ground-tile rule plus the token's own block/attack profile.

## Engine API

Add a small token layer to `StandardBattle`:

- `battle.tokenDeck` — the per-stage inventory (`{ id, count, left, cooldown }`), copied from the stage, never from the caller.
- `battle.placeToken(id, r, c)` — validates: stage token, count > 0, ground tile, not occupied, within deployment rules; creates a normal unit with `side: 'ally'`, `token: true`, the reviewed stats/block and no skill bar; decrements `left`.
- `battle.retreatToken(unit)` — removes only owned tokens, refunds nothing by default (the stage count is a budget, not a cooldown).
- Token units participate in blocking, damage, healing and death exactly like operators; they are excluded from the operator roster, DP cost and deployment limit.
- A token that dies or is retreated does not come back unless the stage explicitly says so.

## UI

- A token strip next to the operator cards: icon, name, `left / count`.
- Selecting a token enters the same tile-placement mode as an operator, but validates the token rules and does not spend DP.
- Placement count updates immediately; no drag needed for the first version.
- Keyboard: the strip is reachable with Tab; Enter selects, Escape cancels.

## Tests

1. Inventory comes from the stage, not the request.
2. A token can be placed on a legal ground tile; the count drops.
3. Illegal tile/occupied/zero count are refused with a named reason.
4. The token blocks and takes damage; its death is reported.
5. A token is not an operator: no DP, no deployment slot, no skill.
6. Every token stage in the catalogue has a reviewed inventory and no unknown token id.

## Rollout

1. Implement the engine and the simplest token stage (a tutorial or 4-4-style map).
2. Add one token UI and a screenshot/fixture.
3. Enable the remaining token stages in small batches, keeping `testOnly` until the smoke test passes.
4. Update `stageAdapter` to stop refusing `deployable_tokens` and the coverage bucket to report `tokens: 0`.

Do not mark a token stage public until its inventory, placement rules and at least one clear/fail path are covered by tests.
