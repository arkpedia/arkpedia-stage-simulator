# Chapter 15, the PRTS control system and the Intrusive Call

Every chapter 15 stage names the stage system `env_v060_mainline15_prtsCtrl` through its `env_system_new` rune. The system is compiled game code that acts through one enemy, the Intrusive Call `enemy_10072_mpprhd` (PRTS 侵入式调用).

Published so far: 15-4 (the system is idle there), 15-9 and 15-15 (the Intrusive Call carries ordinary enemies), then 15-10, 15-17 and 15-18 (the Weakening Node). 1,189 stages available; main story 457 of 564. Stages where it places a drink machine, echo or crystal as a fixed device stay blocked.

## The system

`tools/arkpedia/extract-stage-environments.py` retains its prefab. `shared/arkpedia/stage-prts-control.js` (`prtsControlNativeReviewed`) reviews what the prefab names:
- **Its actor:** the Intrusive Call.
- **Its tile:** `tile_mpprts_enemy_born`, where enemies are grabbed from.
- **Eight enemy-to-device pairs** it places: both drink machines, both monstrosity echoes, both caster crystals, and the Weakening Node twice.
- **No numbers:** the rune carries only the system's name and compiles to `prtsControl: true`.

A level without the Intrusive Call and without a drag tile leaves the system idle (`prtsControlInert`: 15-4, its six-star variant and 15-19). Any other level needs exactly one drag tile.

## Grab orders

PRTS describes the rule; the level data fits it in every stage checked (15-5, 15-9, 15-10, 15-15, 15-17, TR-26):
- **One hand.** The first spawn action for the Intrusive Call is the hand itself.
- **Every later spawn action for it is a grab order** for the spawn action right after it, in the same fragment and hidden group. The hand grabs that enemy at the drag tile when the enemy's own spawn time comes.
- **The drop point** is the start of the grabbed enemy's own route. From there the enemy follows its route.
- **Not counted:** a grabbed enemy is not in the target total and does not hold the battle before it is deployed.

`tools/arkpedia/stage-waves.mjs` compiles this as a contract. The hand's spawn is marked `prtsHand`; a later hand action spawns nothing and marks the next spawn `prtsGrab`. It refuses:
- a grab order not directly followed by its enemy;
- a grabbed squad (count above 1) or random spawn;
- a drink machine, echo or crystal dropped on a highland tile. Those become fixed devices, which are not modelled yet (`prtsGrabTarget`).

A grabbed Weakening Node enemy is accepted: it only stands for the device the hand deploys (below), and the program is marked `prts.nodes`.

## The Intrusive Call

`shared/arkpedia/enemy-intrusive-call-features.js` (`intrusiveCallNative`) reviews its prefab, templates and skeleton clocks (`data/arkpedia-intrusive-call-animations.json`, from `tools/arkpedia/intrusive-call-animations.mjs`). Runtime: `server/sim/content/arkpedia-stage-prts-control.js` (kind `intrusiveCall`, `b.stagePrts`).
- **The hand:** flying, invincible, cannot be selected or blocked, not counted, does not hold the battle.
- **One order at a time, in spawn order:**
  1. It flies to the drag tile at its move speed (1.4).
  2. Grab_Begin (1.17 s).
  3. It flies to the enemy's position.
  4. Grab_End (1.67 s). The enemy is deployed at the clip's event, 0.33 s in.
  5. It flies back to where it appeared.
- **A failed deploy:** at that event, a lowland tile holding an operator or a summon, or a highland tile holding any placed unit, makes the deploy fail. The enemy is removed and the hand plays Angry (1.93 s). A flying enemy always deploys.
- **While carried** the enemy is hidden and cannot be hit.
- **The drop tile** is marked on the map from the moment the order starts until the deploy.

## The Weakening Node

`shared/arkpedia/stage-weakening-node.js` (`weakeningNodeNativeReviewed`) reviews `trap_227_mpweak` (PRTS 弱化节点(装置)) from its prefab, `sktok_mpweak_1`, their templates and the record. Runtime: `server/sim/content/arkpedia-stage-weakening-nodes.js` (`b.stageWeakeningNodes`).
- **The device:** ally side, 10,000 HP, taunt -1; nothing can attack it. Its range is its own tile and the eight around it.
- **Where it comes from:** placed by the level (15-18), or deployed by the hand in place of a grabbed Weakening Node enemy (15-10, 15-17). The enemy itself never fights. An occupied tile fails that deploy like any other.
- **Charge:** 30 SP at 1 SP/s from 0.
- **PRTS's cast:** a charged node calls the hand. That order goes before the waiting grab orders. The hand flies to the node and plays Click (1.43 s); 0.47 s in, the node weakens the ground ally units in range (DEF ×0.5, RES ×0.5) for 20 s.
- **The player's cast:** while the node is charged the player may activate it from its panel for 10 DP. Every enemy in range then has DEF ×0.5 and RES ×0.5 for 30 s. The hand finds the node already active and plays Angry.
- **In range only:** a unit keeps the penalty while it stays in range. After either cast the node charges again from 0.

## Checked

`test/arkpedia-prts-control.test.js`:
- **System review:** it passes, and refuses another actor, another drag tile or a missing device pair. The rune refuses an extra parameter. The idle check is true only without the actor and the tile.
- **15-4:** compiled with the rule and without the Intrusive Call; a headless run spawns all 30 enemies with no errors.
- **Compile:** 15-9 has one hand, a drag tile on 5,4 and five grabbed enemies at their own times; 15-15 has two. 15-10, 15-6 and TR-26 stay blocked.
- **15-9, one order:**
  - The enemy is held at 3 s: uncounted, hidden, untargetable.
  - The hand reaches the drag tile, grabs for 1.17 s, carries it to 5,5 and deploys it 0.33 s after arriving.
  - It then returns to 5,1.
  - The run ends cleared with five deploys, no failures and the hand still alive.
- **Failure:** a unit on the drop tile loses the enemy and the hand is angry for 1.93 s. A unit on a flying enemy's highland tile does not stop that deploy.
- **Node review:** it passes, and refuses a cheaper cast, a longer PRTS cast and a stronger penalty.
- **15-10, PRTS's cast:** the hand deploys a node on 5,7 and the node enemy never appears. 30 s later the node is charged and the hand is called. An operator beside it then has half her DEF and RES for 20 s, and the node starts again from 0.
- **15-10, the player's cast:** refused while charging and without 10 DP. Cast with 30 DP it leaves 20, halves an enemy's DEF and RES in range for 30 s, and the arriving hand is angry.
- **15-17 and 15-18** run to the end without errors: nodes carried in 15-17, placed by the level in 15-18.

A headless run of 15-15 deploys both Prototype Auto Meal Distributors and ends without errors. The existing enemy test stages still run the Intrusive Call alone (it only hovers).

## Not checked

- In game.
- **In the browser** only the start of 15-9 was seen: the stage opens, the hand is drawn with its own art on 5,1, the counter reads 0/120, no console errors. The preview pane ran too slowly to reach the first grab at 3 s, so the drop-tile marker was not seen on screen.
- **Inferences**
  - **Order of work:** one order ends before the next starts, and each ends with the flight back. The game data names the sub-steps (to the drag tile, to the origin) but not their scheduling.
  - **A failed deploy removes the enemy.** PRTS says only that the deploy fails.
  - **A carried enemy cannot be hit.**
  - **Flight speed** uses the simulator's ordinary speed scale.
  - **The idle system:** that it does nothing without its actor and tile.
- **More inferences (the node):** after Click the hand flies back to where it appeared; a hand that is called while busy finishes its current order first; the hand's cast does not touch flying ally units (the game data says ground only) or devices.
- **Not modelled:** the static device forms; the boss stages' follow order (15-20, H15-4).
- **Art:** the hand is drawn with its model; its grab animations are not played.
- With no player input the enemies leak in all three stages.
