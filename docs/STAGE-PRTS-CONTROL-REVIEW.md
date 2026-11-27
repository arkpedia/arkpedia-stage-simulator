# Chapter 15, the PRTS control system and the Intrusive Call

Every chapter 15 stage names the stage system `env_v060_mainline15_prtsCtrl` through its `env_system_new` rune. The system is compiled game code that acts through one enemy, the Intrusive Call `enemy_10072_mpprhd` (PRTS 侵入式调用).

Published so far: 15-4 (the system is idle there); 15-9 and 15-15 (the Intrusive Call carries ordinary enemies); 15-10, 15-17 and 15-18 (the Weakening Node); then 15-5, 15-6, 15-8, 15-12, 15-13, 15-14, H15-1 and H15-2 (the static forms). 1,197 stages available; main story 463 of 564.

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

Two kinds of grabbed enemy are deployed as something else (`prtsGrabTarget`):
- **A Weakening Node enemy** only stands for the device the hand deploys; the program is marked `prts.nodes`.
- **A drink machine, echo or crystal dropped on a highland tile** becomes its static form; the program carries each form's numbers in `prts.statics`.

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

## The static forms

PRTS: a drink machine, echo or crystal the hand drops on high ground becomes a level-1 device of the same name, with basically the same attributes and abilities, taunt -1 and weight 0.

`shared/arkpedia/stage-prts-static-forms.js` (`prtsStaticFormReviewed`) reviews each of the six pairs:
- **Numbers:** the device's level-1 HP, ATK, DEF, RES and attack interval equal the enemy's; its attack radius equals the enemy's range; taunt -1, weight 0.
- **Prefab:** enemy side, default category (operators can attack it), firing its family's projectile.

In the battle the grabbed enemy keeps its own unit and behaviour (its attack, the echo's tile denial on death, the crystal's DP halt) and becomes fixed:
- **It never moves** and cannot be pushed or blocked.
- **Its numbers** are the device's. A stage rule that names the device id scales them (H15-1: HP ×1.6, ATK and DEF ×1.3); enemy rules do not.
- **It need not be defeated:** it is not counted and does not hold the battle.
- **Its tile** takes no deployment while it stands.

## A tile bug found on the way

`server/sim/arkpedia.js` gave each tile type one character, and the tenth type got the same character as the fifth. In a stage with ten or more tile types every tile of the fifth type was read as the tenth: in H15-1 the ranged walls became teleport exits, in 14-17 and 15-5 the roads did. 81 published stages have ten or more tile types. Each type now has its own character.

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
- **Static review:** all six pairs pass; another device ATK or taunt is refused; an ordinary enemy has no static form.
- **15-5:** eight Cold Drink Machines are fixed on high ground with the device's numbers (3,000 HP, 350 ATK, taunt -1, weight 0), uncounted. One shoots an operator beside it with Physical damage every 4 s, can be attacked, does not move, and blocks deployment on its tile. The run ends cleared with 48 targets, as PRTS lists, and the machines still standing.
- **H15-1:** a static Active Sarkaz Caster Crystal has 16,000 HP, 780 ATK and 1,560 DEF.
- **The other static stages** (15-6, 15-8, 15-12, 15-13, 15-14, H15-2) run to the end without errors or failed deploys.
- **Tile types:** in H15-1, 14-17 and 15-5 every battle tile matches its geometry type.

A headless run of 15-15 deploys both Prototype Auto Meal Distributors and ends without errors. The existing enemy test stages still run the Intrusive Call alone (it only hovers).

## Six-star variants (the base conditions)

Chapter 15 gives 16 stages a six-star variant (PRTS 险地). Its level holds two layers:
- **`runes` with the six-star mask:** the base conditions (PRTS "险地作战 Lv.0"). They are always on.
- **`optionalRunes`:** four hypotheses (PRTS 沙盘推演: level 1 and level 2, two choices each). The player may add one of each level. PRTS: a run started at Lv.0 uses the base conditions alone.

The simulator publishes the base conditions and does not offer the hypotheses.

**`rune_alias`.** A base rule may carry `rune_alias` (for example `sixstar_basic_attribute`). It is the name by which a hypothesis's `add_other_rune_blackb` rule adds to that rule's numbers (ATK +0.1, DEF +0.1, HP +0.2). Alone it changes nothing, so `stage-rules.js` drops it (`withoutSixStarAlias`). Only `sixstar_basic_attribute` and `sixstar_basic_attribute_trap` on active six-star rules are accepted.

**What the base conditions are** (the level, checked against each stage's PRTS 险地 page and the stage table's condition text):
- **Every stage:** 1 life point; enemies at 110% ATK, 110% DEF and 120% HP.
- **The six drink machine, echo and crystal devices** (the fixed forms): 120% HP, 110% ATK and DEF, where the level names them.
- **Per stage:**

| Stage | Extra base condition | Built |
|---|---|---|
| 15-4 | Enemy move speed 130% | yes |
| 15-5 | Every Cold Drink Machine is a Hot Drink Machine | yes |
| 15-9 | Tiles (3,7) (2,6) (3,4) (4,5) cannot be deployed on | yes |
| 15-10 | Enemy DEF 130% on top | yes |
| 15-12, 15-15 | Every Translation Base α is a β | yes |
| 15-13 | Ally units' ATK 90% | yes |
| 15-17 | Enemy ATK 130% on top | yes |
| 15-18 | Ally units' DEF 80% | yes |
| 15-3 | Enemy move speed 130% | yes |
| 15-11 | DP recovery interval 150% | yes |
| 15-6, 15-7 | The Prototype Auto Meal Distributor's summon cooldown 80% | yes |
| 15-8 | Crystal DEF 150%, fixed crystal 130% | yes |
| 15-14 | Originium crystal bursts (`env_030_random_tile_selector`) | no |
| 15-20 | (the boss) | no |

**Three readings**
- **15-9's tiles** are written with a Caster selector. The stage table says "4 positions on the field cannot hold ally units", and PRTS names no class. The selector is read as unused.
- **`side=ALLY`** (15-13, 15-18): the rule reaches ally units and skips an enemy-side fixed device. Those rules also list RES and attack speed at exactly 1.
- **"130% on top"** (15-10 DEF, 15-17 ATK): the two enemy rules multiply (1.1 x 1.3 = 1.43), as the simulator reads every pair of enemy attribute rules [not checked in game]. PRTS's "额外提升至130%" could also mean 130% in total.

**A fix found on the way.** The wave compiler keyed a fixed form by the enemy the level names. Six-star 15-5 replaces that enemy, so its Hot Drink Machines were carried to high ground and left as walking enemies. The form now belongs to the enemy that actually spawns (`stage-waves.mjs`).

**Checked** (`test/arkpedia-prts-control.test.js`)
- **15-4:** 1 life point; a Carefree Cargo Helper has 2,400 HP, 330 ATK, 220 DEF and 130% speed; 30 enemies, cleared. 15-14's six-star variant, whose burst rule has another name, stays blocked.
- **15-5:** eight Hot Drink Machines are fixed with 4,560 HP, 440 ATK and 264 DEF (the device rule once, not the enemy rule on top); 48 enemies, cleared.
- **15-9:** the four tiles are in the battle's forbidden set; the normal stage has none.
- **15-13, 15-18:** Myrtle has 90% ATK or 80% DEF against the normal stage; a fixed Sarkaz echo keeps the device numbers (8,400 HP, 495 ATK, 1,210 DEF).
- **The others** (15-10, 15-12, 15-15, 15-17, 15-18) run to the end with 1 life point, no errors and no failed deploys.
- **Counts:** 15-4 (30), 15-5 (48), 15-12 (28) and 15-17 (40) match PRTS. 15-9, 15-10, 15-13, 15-15 and 15-18 add the enemies their Distributors summon, as the normal stages do.
- **In the browser:** six-star 15-9 opens with "1 life", its condition line and the four tiles crossed out; no console errors. The stage list shows the normal and six-star stage under the same name.


## Drink machines the level places itself (15-3, 15-7, 15-11)

These levels hold Cold or Hot Drink Machine devices (`trap_229_mpcata`, `trap_230_mpcatab`) as hidden instances, and a wave action at 0 s switches each on by its alias. PRTS lists them as a level-1 stage device that "attacks ally units within 2.5 of itself with Physical damage".

- **Device families** `Cold Drink Machine` and `Hot Drink Machine` (`stage-devices.js`): hidden, switched on by their own alias, level 1, no skill.
- **Build time:** each instance carries the reviewed fixed-form numbers (`staticForm`, from `stage-prts-static-forms.js`), and the paired enemy's record joins the stage.
- **Battle:** when the action runs, `placePrtsStatic` puts the paired enemy on the tile as the fixed form the hand's high-ground drops use: device numbers, taunt -1, uncounted, never holding the battle, its tile closed to deployment.
- **A machine in a hidden group no base rule enables** is left out (15-3's second machine, group `sixstar`; 15-11's three on the left, group `five_star`).
- **The hidden card** each level also lists (count 0) is never revealed and is ignored.

Publishes 15-3, 15-7, 15-11 and the six-star 15-3 (move speed 130%) and 15-11 (DP recovery interval 150%).

**Checked**
- **15-3:** one machine on 3,8 from the first tick with 3,000 HP, 350 ATK, 240 DEF; it is not one of the 26 enemies and is still there when the stage clears.
- **15-7:** three machines on 4,4, 6,1 and 6,4. **15-11:** three Hot Drink Machines on 3,9, 4,9 and 5,9 with 3,800 HP and 400 ATK. Both run to the end without errors.
- **Six-star 15-3:** the machine has 3,600 HP, 385 ATK and 264 DEF. **Six-star 15-11** runs to the end with a 1.5 s DP interval.

## TR-26, and what its script says about the hand

TR-26's last grab is a squad: one hand action followed by two Confused Maintenance Helpers 3 s apart. PRTS counts both among the grabbed ("3 Helpers and 3 Cold Drink Machines are grabbed"; 10 counted enemies), so every enemy of a grabbed action is held and carried in turn. A grabbed random spawn is still refused.

**The flight speed.** The tutorial's script is a clock. Its text at 48 s says the deploy can be stopped "by deploying our own operators at those locations in advance", and at 49 s it places Amiya on 2,7, the tile of the machine spawned at 35 s.
- **At move speed x 0.5** (the game's rule; the level's `moveMultiplier`), with one order ending before the next starts, that machine arrives at 50.0 s. Amiya is there and the deploy fails.
- **At the battle's walking scale (0.65)**, which the hand used before, it arrived at 44.6 s and Amiya's own deploy failed.
- **The other lines fit 0.5 too:** the Helper is on the field (24.8 s) before "how did this maintenance helper get here?" (28 s); the node lands at 67.0 s before "PRTS threw something in front of me" (71 s) and is charged about when "Charging complete" appears (99 s).

The hand now flies at move speed x 0.5 in every stage. This also supports the earlier inference that one order ends, with the flight back, before the next starts.

**A fixed form holds its tile.** PRTS: a highland target is taken by a character unit of any kind and either side. A fixed machine already on the tile now makes a second drop there fail (TR-26 sends a third machine to 2,6).

**Checked:** TR-26's grabs compile as six orders, the last with two enemies; the hand's log reads 24.8 s (Helper), 35.7 s (fixed machine), 50.1 s (failed, Amiya on 2,7), 67.0 s (node); the stage clears with 10 counted enemies and no errors. A fixed form's tile reads as occupied.

## More six-star rules (15-6, 15-7, 15-8)

- **`enemy_skill_cd_mul`** (15-6, 15-7): the Prototype Auto Meal Distributor's Spawn recharges in 4 s instead of 5 s. Its first delay (3 s) is unchanged [PRTS: "the periodic cooldown falls to 80%"]. Reviewed for that enemy and skill only (`applyStageEnemySkillPeriod`).
- **15-8:** the Sarkaz Caster Crystal has 150% DEF on top of the base (1,650); its fixed form 130% on top (1,430). The device rule also carries a stray `enemy=trap_233_mpmage`; it is accepted as a note naming one of the rule's own targets. As written, the rule covers all six fixed devices; 15-8 fixes only crystals.
- **Checked:** the Distributor's record (5 s and 3 s; 4 s and 3 s in six-star) and more summoned enemies in six-star 15-6; six-star 15-7 and 15-8 run to the end with 1 life point and no errors; the crystal's two DEF values.

## H15-3

- **Seven Active Sarkaz Caster Crystals** (`trap_234_mpmageb`) are placed by the level and switched on at 0 s, like the drink machines (device family `Active Sarkaz Caster Crystal`).
- **A misspelt rule.** The level gives enemies 130% ATK and DEF and 160% HP, and writes the matching device rule as `char_attribute_mulkkk`. No rule of that name exists, so it is read as having no effect [inference]: the crystals keep 10,000 HP, 600 ATK and 1,200 DEF. H15-1 spells the same rule correctly and its crystal has 16,000 HP. PRTS says only that stage bonuses apply to the device "unless stated otherwise".
- **Checked:** the seven tiles (all high ground), the crystal's numbers, 32 counted enemies as PRTS lists, cleared without errors.

## Not checked

- In game.
- **In the browser** only the start of 15-9 was seen: the stage opens, the hand is drawn with its own art on 5,1, the counter reads 0/120, no console errors. The preview pane ran too slowly to reach the first grab at 3 s, so the drop-tile marker was not seen on screen.
- **Inferences**
  - **Order of work:** one order ends before the next starts, and each ends with the flight back. The game data names the sub-steps (to the drag tile, to the origin) but not their scheduling.
  - **A failed deploy removes the enemy.** PRTS says only that the deploy fails.
  - **A carried enemy cannot be hit.**
  - **The idle system:** that it does nothing without its actor and tile.
- **More inferences (the node):** after Click the hand flies back to where it appeared; a hand that is called while busy finishes its current order first; the hand's cast does not touch flying ally units (the game data says ground only) or devices.
- **H15-3's crystals:** 10,000 or 16,000 HP depends on whether the game honours the misspelt rule.
- **More inferences (the static forms):** "basically the same abilities" is read as the enemy's own behaviour unchanged; statuses a device would resist still apply.
- **Not modelled:** the six-star hypotheses (`optionalRunes`); a grabbed random spawn; the boss stages' follow order (15-20, H15-4).
- **Art:** the hand is drawn with its model; its grab animations are not played.
- With no player input the enemies leak in all three stages.
