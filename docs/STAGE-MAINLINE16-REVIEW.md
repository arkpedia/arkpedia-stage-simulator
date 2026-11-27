# Chapter 16: Toxic Pollution, its devices, the Miner Guerrilla and the Army Infiltrator

Every chapter 16 level names two things: the pollution system `env_v066_mainline16_ctrl` and the global buff `mainline16_enemy_target_free`. Every level also has Miner Guerrillas (`enemy_3010_mcreep`, PRTS 矿工游击队).

Built so far:
- **First batch:** the Miner Guerrilla, and the system where a level gives it nothing to do. Published 16-2 and its six-star variant, and CG-3 and its Challenge (1,224 available; main story 486 of 564).
- **Second batch:** the pollution itself, the Heavily Polluted Facility, the Rock Wall, the Hidden Tunnel and the Army Infiltrator. Publishes 16-3 and its six-star variant (1,226 available; main story 488 of 564).

## Toxic Pollution (PRTS 高危污染)

`shared/arkpedia/stage-mainline16.js` reviews both prefabs; runtime `server/sim/content/arkpedia-stage-mainline16.js`.
- **The system** keeps a state for each tile, polluted or clear, and draws it. Its own rules (which tile counts, the deploy ban) are compiled game code.
- **The buff** checks every enemy-side unit each 0.3 s. On a polluted tile and not blocked, it is hidden: it cannot be targeted. Blocked, or off such a tile, it is shown again. This is the simulator's existing hidden state (隐匿).
- **It covers the devices too.** The buff takes every enemy-side unit of the default category, which a Heavily Polluted Facility is. So a facility cannot be targeted until something clears its tile.
- **A tile is polluted** while a living Heavily Polluted Facility covers it, unless a Miner Guerrilla cleared it in the last 3 s or an ally unit stands on it.
- **Nothing can be deployed** on a polluted tile (the stage text and PRTS).

A level is accepted only when everything in it that touches the pollution is built (`mainline16Supported`):
- only the three devices below, none of them hidden (16-13 switches facilities on by wave action; not built);
- no supplied card;
- only these enemies: both Patrol Captains, the Ursus Mangler, the Ursus Assault Crossbowman, the Miner Guerrilla and the Army Infiltrator;
- only ordinary tiles.

Every other chapter 16 level is refused ("Unsupported chapter 16 pollution sources").

## The three devices

`shared/arkpedia/stage-mainline16-devices.js` reviews each from its pinned prefab, templates and record.

**Heavily Polluted Facility** `trap_271_fowstn` (PRTS 严重污染设施; enemy side; 30,000 HP, 300 DEF, 50 RES)
- Pollutes the 21 tiles around it (5×5 without the corners) for as long as it stands.
- Operators can attack it once its tile is clear. Immune to Stun, Cold, Freeze, Silence, Levitate and Sleep.
- Its tile stays walkable: the Miner Guerrillas' routes run through it.

**Rock Wall** `trap_272_nomstn` (PRTS 阻道岩壁; enemy side; 8,000 HP, 300 DEF, 20 RES)
- Cannot be targeted. Only a Miner Guerrilla's attack reaches it.
- It holds its tile. All 52 in the chapter stand on raised tiles, so a destroyed one frees a ranged tile.

**Both**
- A Miner Guerrilla inside a circle of radius 0.8 cannot move while the device stands.
- Damage from a Miner Guerrilla is ×5: 500 ATK against 300 DEF gives 1,000 a hit.

**Hidden Tunnel** `trap_270_spawnp` (PRTS 隐蔽矿道; ally side; nothing can attack it)
- Every 15 s it gathers one Miner Guerrilla at the start of its own route (its action of the level branch `mcreep_route`). Not with 3 already waiting, and not with 5 of its own alive.
- It starts gathering: a new Miner Guerrilla waits where it appears.
- **Skill** (15 SP at 1 SP/s from 0; the player uses it from the device panel): every Miner Guerrilla it holds sets out, and new ones set out at once. Used again it gathers again, and charges from 0. One that has set out never waits again.

## Army Infiltrator

`enemy_10120_uaghst` (PRTS 集团军潜行兵). 5,000 HP, 400 ATK, 200 DEF, speed 1.0, attack interval 2 s. Review: `shared/arkpedia/enemy-army-features.js`; runtime: `server/sim/content/arkpedia-enemy-army.js`.
- **Cannot be blocked.**
- **Attacks only neutral ground units** within 1 tile (here: Miner Guerrillas), for Physical damage of its ATK. It never attacks an operator.
- **Engages one Miner Guerrilla:** every 0.3 s, if it holds none, the nearest free one whose body its 0.9 circle touches is held (centres up to 1.0 apart). Both stand still and fight. The hold ends when their centres are more than 1.1 apart, or either is gone.

## Miner Guerrilla

3,000 HP, 500 ATK, 150 DEF, speed 0.7, attack interval 3 s. Review: `shared/arkpedia/enemy-miner-guerrilla-features.js`; runtime: `server/sim/content/arkpedia-enemy-miner-guerrilla.js`.
- **A neutral unit.** It opposes the enemy side. Enemies that select your units select it too. Operators never select it and cannot block it. Taunt −1.
- **Not a target to defeat.** It is not counted, holds neither a wave nor the battle, and leaves at its exit without costing life.
- **Attack:** one ground enemy within 1 tile, Physical damage of its ATK. It stands for the 1.53 s swing; the hit lands 0.57 s in. It can strike a unit that cannot normally be targeted (the wiki: this lets it attack a Rock Wall).
- **Healed by Medics:** once a second, each deployed Medic whose attack range covers its tile heals it for half that Medic's ATK, if it is not at full HP. Medics count separately.
- **Fear:** while feared it takes 200 true damage each second and does not attack.
- **Clearing pollution:** every 0.3 s, unless feared, it clears its tile and the eight around it for 3 s.
- **Against the devices:** it strikes a Heavily Polluted Facility or a Rock Wall that its attack circle touches (1.0 plus the device's 0.25 body), at ×5 damage.

The skeleton of this enemy is a JSON file, not the binary kind the clip extractor read. `tools/arkpedia/enemy-animation.mjs` now reads both.

## Where the sources are silent or disagree

| Point | Reading | Why |
|---|---|---|
| Fear damage at exactly full HP | It takes the damage | PRTS says 200 a second while feared. The template carries a check on a full-HP ratio whose sense is not clear. [inference] |
| Does a Miner Guerrilla stop walking to attack? | Yes, for the swing | As the reviewed neutral fighter of chapter 8 does. [inference] |
| Does it attack while feared? | No | A feared unit does not act. [inference] |
| Six-star 16-2's Miner Guerrilla | 60% HP (1,800) | The level's rule. |
| ×5 before or after DEF | After: 1,000 a hit | The template scales the damage a unit takes, as the simulator's other "damage taken" scales do. 8,000 and 30,000 HP are then exactly 8 and 30 hits. Before DEF it would be 2,200. [inference] |
| How close a Miner Guerrilla must be to be stopped | 0.9: the 0.8 circle touching its 0.1 body | The simulator reads every such circle as touching the target's collider. A Miner Guerrilla walking the next row (1.0 away) is not stopped; it still strikes while it passes. [inference] |
| How far a Miner Guerrilla reaches a device | 1.25: its 1.0 circle touching the device's 0.25 body | Same rule. TR-27's routes pass every Rock Wall at exactly 1.0, and its script says the miners clear them. [inference] |
| How far an Army Infiltrator's circles reach a Miner Guerrilla | 1.0 to engage, 1.1 to let go: 0.9 and 1.0 touching its 0.1 body | Same rule. [inference] |
| How far a Miner Guerrilla reaches an enemy | 1.1: its 1.0 circle touching a 0.1 body | Same rule; the first batch used 1.0. This also applies in 16-2 and CG-3. An engaged Miner Guerrilla must be able to strike the soldier holding it. [inference] |
| Two facilities covering the same tile | The tile stays polluted until both are gone | The system's bookkeeping is compiled code. 16-3's two facilities share three tiles. [inference] |
| An operator on a polluted tile | That one tile is clear while the operator stands there | PRTS: pollution "can be dispelled for a while by Miner Guerrillas or by units the player deploys on it". How far and how long is not stated. [inference] |
| Who the hide buff covers | Every enemy-side unit, the facility included | Its target options: enemy side, default category, ground and air. |
| The Hidden Tunnel's switch back | Any time while sending out; it then charges from 0 | The skill has no duration and switches the mode; PRTS says the modes switch "by triggering the skill". When it may be triggered again is not stated. [inference] |
| The Hidden Tunnel as a target | Nothing attacks it | An obstacle-category ally trap with taunt −1; its 3,000 HP are not used. [simplification] |
| The Hidden Tunnel's tile | Not made fly-only | The prefab rewrites it. 16-3's tunnel is off every route; 16-7 and 16-11 put tunnels on road tiles and need it. [not built] |
| 16-3's four `raid` Infiltrators | Not in the stage | No base rule switches that hidden group on; PRTS counts 22 enemies without them. |

## Checked

`test/arkpedia-stage-16-2.test.js`:
- **Reviews:** the Miner Guerrilla and the system pass; a heal scale of 0 and another tile status are refused. A level with a Heavily Polluted Facility or a chapter 16 soldier is not idle. 16-3, 16-9 and TR-27 stay blocked.
- **16-2:** eight Miner Guerrillas appear as neutral units (uncounted, taunt −1, cannot be blocked, 3,000 HP, 500 ATK). Some leave at their exit and no life is lost for it. 34 counted enemies, as PRTS lists; no errors.
- **Attack:** 500 Physical on an enemy half a tile away, 3 s apart.
- **Medic:** three heals of half her ATK in 3 s; none once she is withdrawn.
- **Fear:** 600 HP lost in 3 s, and the loss stops with the fear.
- **Six-star 16-2** (1 life point, 1,800 HP) **and CG-3 with its Challenge** run to the end without errors, with their Miner Guerrillas.

`test/arkpedia-stage-16-3.test.js`:
- **Reviews:** the three devices and the Army Infiltrator pass. Another stop circle, a facility that rewrites its tile, a facility that does not lift its pollution, a tunnel skill that does not switch, another interval and another damage scale are refused. A level with a hidden facility, a card, an unbuilt soldier or another device is refused; 16-4, 16-13, 16-18 and TR-27 stay blocked.
- **16-3 opens** with one tunnel, two facilities and two walls; 39 tiles are polluted (two 21-tile areas sharing three). A deploy on a polluted tile is refused ("Toxic Pollution covers this tile."); the tile next to the area is free.
- **Hiding:** an enemy on a polluted tile cannot be targeted, and neither can the facility; one outside can. A Miner Guerrilla's clearing shows both within 0.3 s, and they are hidden again 3 s later. A blocked enemy is shown. A tile with an operator on it reads clear while its neighbour stays polluted.
- **Hidden Tunnel:** the first Miner Guerrilla appears at 15 s on 3,1 and waits; three wait by 45 s and no fourth comes. The skill is refused before 15 SP. Used, all three set out; the tunnel never has more than five alive. Used again it gathers and charges from 0.
- **Devices and miners:** a Miner Guerrilla beside a facility is stopped and hits it for 1,000 every 3 s. A destroyed facility frees the miner and lifts its pollution except on the tiles the other facility covers; a deploy there is accepted. From the facility's tile it strikes the wall one tile away for 1,000.
- **Army Infiltrator:** with two Miner Guerrillas in reach it holds one; both stand. It hits for 250 (400 ATK against 150 DEF) and never hits the operator beside it. Its death frees the miner.
- **Whole runs:** 16-3 with no input ends with 22 counted enemies and no errors. Six-star 16-3 has 1 life point and Infiltrators at 6,000 HP, 440 ATK and 220 DEF; with the miners sent out it runs to the end without errors.
- **In the browser:** 16-3 opens with the polluted tiles tinted purple and the five devices as markers. The tunnel's panel shows its SP and counts. A real click on "Send out" switched it to "Sending out" with the button reading "Gather"; the miner walked off and the tiles around it lost their tint. No console errors.

## Not checked

- In game.
- **The readings in the table above.**
- **CG-3 against a wiki page.** It became available because its only missing piece was the Miner Guerrilla; its own numbers were not compared.
- **Enemies attacking the Miner Guerrillas** beyond the Army Infiltrator. The Patrol Captains' and crossbowmen's shots at neutral units were built for chapter 8 and were not re-tested here.
- **A run won with a squad.** The whole-stage runs have no operators or are driven by the test.
- **No art:** the devices and the Miner Guerrillas draw as markers, pollution as a purple tint, and a hidden enemy is not drawn differently by this work.
- **In the browser:** a deploy refused by pollution, an operator attacking a cleared facility, and a facility being destroyed were tested headless only.

## Left in chapter 16

- A facility switched on by a wave action (16-13).
- The other soldiers: Army Phantom, Army Shieldguard, Army Mobile Crossbowman, Army Light Artillery, Army Frontline Commander and the Fortbreaker; the Abnormal Originium Slug and Abnormal Manglerbeast; the 'Core of Stupor'; the bosses (Rampaging Abnormal Manglerbeast in 16-12, Yurodstvo in 16-16).
- The Hidden Tunnel's fly-only tile, for tunnels on road tiles (16-7, 16-11).
- 16-9 and 16-18 (stage-local Miner Guerrilla variants, placed operators, dialogue).
