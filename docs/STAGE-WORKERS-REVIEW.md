# Mushroom-clearing supply

Temporary Rhodes Island Employees (`trap_016_peon`) now use one source-gated
supply definition and a common attack receipt. The original prefab selects one
allied device tagged `tree`, in its facing range. It releases a Physical attack
with 13 base ATK after a fixed 0.566-second windup, on a one-second attack clock.
The nine-second withdrawal talent is independent of silence and stun. Attack
interruption, damage modifiers and death cleanup use existing engine behavior.

A card costs 5 DP, consumes one stock, starts a five-second cooldown, and can be
placed on an empty melee or ranged tile with a chosen facing. It occupies no
operator slot. Retreat cancels pending attacks and returns neither DP nor stock.
Both original skill-level encodings (0 and 1) are accepted only with skill index
-1; this token has no skill.

Mushrooms already occupy original ranged wooden-wall tiles. Killing one removes
its cover aura and frees occupancy, exposing that existing tile without editing
shared geometry, making new art copies, or adding stage-specific scripts.

Source: pinned original character table, `trap_016_peon` prefab and recursively
retained buff templates in the shared device sources. Reference:
https://prts.wiki/w/罗德岛临时雇员 . Original model/animation extraction, native
frame parity and targeting ties between artificially overlapping trees are not
certified. The current single-target controller uses source instance order for
such ties; ordinary map geometry gives a worker one adjacent target.

Tests cover placement cost/stock/cooldown, strike timing, direction, interruption,
withdrawal under control effects, cover removal, ranged deployment on the freed
tile, and compilation of the six previously singly-blocked layouts. Other stage
blockers remain enforced independently.

FA-5 Challenge's original `global_token_cnt_add` rune subtracts all six Employee
cards, matching its description that Employees cannot be deployed. This shares
the existing initial-stock compiler, retains a disabled zero-stock account, and
rejects missing targets, operator selectors and fractional/negative resulting
stock. Normal FA-5 keeps its six cards.

Validation checkpoint: 17 worker/mine/scenery tests and 18 worker/stock/rule tests;
805/805 compiled stages pass the ten-second runtime smoke. Desktop and touch
browser checks use the actual card, tile and facing controls, then verify eight
strikes, removal of the mushroom, automatic withdrawal, stock and the freed
ranged tile. The touch screenshot was inspected. Receipts are retained in
`data/arkpedia-stage-workers-review.json`.
