# Chapter 16: the Miner Guerrilla, and the pollution system where a level leaves it idle

Every chapter 16 level names two things: the pollution system `env_v066_mainline16_ctrl` and the global buff `mainline16_enemy_target_free`. Every level also has Miner Guerrillas (`enemy_3010_mcreep`, PRTS 矿工游击队). This batch builds the Miner Guerrilla and accepts the system only where it has nothing to do.

It publishes 16-2 and its six-star variant (main story 486 of 564), and CG-3 and its Challenge, an event stage that was waiting only for the Miner Guerrilla (1,224 available).

## The pollution system

`shared/arkpedia/stage-mainline16.js` reviews both prefabs:
- **The system** keeps a state for each tile, polluted or clear, and draws it.
- **The buff** checks every enemy each 0.3 s. On a polluted tile and not blocked, the enemy is invisible (it cannot be targeted). Blocked, or off such a tile, it is visible again.

Tiles are polluted by the chapter's devices and enemies, none of which is built yet. So the rule is accepted only for a level with:
- no device and no supplied card;
- only enemies known to pollute nothing: both Patrol Captains, the Ursus beast and the Miner Guerrilla;
- only ordinary tiles.

16-2 is the one such level. Every other chapter 16 level is refused ("Unsupported chapter 16 pollution sources").

## Miner Guerrilla

3,000 HP, 500 ATK, 150 DEF, speed 0.7, attack interval 3 s. Review: `shared/arkpedia/enemy-miner-guerrilla-features.js`; runtime: `server/sim/content/arkpedia-enemy-miner-guerrilla.js`.
- **A neutral unit.** It opposes the enemy side. Enemies that select your units select it too. Operators never select it and cannot block it. Taunt −1.
- **Not a target to defeat.** It is not counted, holds neither a wave nor the battle, and leaves at its exit without costing life.
- **Attack:** one ground enemy within 1 tile, Physical damage of its ATK. It stands for the 1.53 s swing; the hit lands 0.57 s in. It can strike a unit that cannot normally be targeted (the wiki: this lets it attack a Rock Wall).
- **Healed by Medics:** once a second, each deployed Medic whose attack range covers its tile heals it for half that Medic's ATK, if it is not at full HP. Medics count separately.
- **Fear:** while feared it takes 200 true damage each second and does not attack.
- **Clearing pollution:** every 0.3 s, unless feared, it clears its tile and the eight around it for 3 s. The numbers are carried in its parameters; with no pollution built this does nothing yet.

The skeleton of this enemy is a JSON file, not the binary kind the clip extractor read. `tools/arkpedia/enemy-animation.mjs` now reads both.

## Where the sources are silent or disagree

| Point | Reading | Why |
|---|---|---|
| Fear damage at exactly full HP | It takes the damage | PRTS says 200 a second while feared. The template carries a check on a full-HP ratio whose sense is not clear. [inference] |
| Does it stop walking to attack? | Yes, for the swing | As the reviewed neutral fighter of chapter 8 does. [inference] |
| Does it attack while feared? | No | A feared unit does not act. [inference] |
| Six-star 16-2's Miner Guerrilla | 60% HP (1,800) | The level's rule. |

## Checked

`test/arkpedia-stage-16-2.test.js`:
- **Reviews:** the Miner Guerrilla and the system pass; a heal scale of 0 and another tile status are refused. A level with a Heavily Polluted Facility or a chapter 16 soldier is not idle. 16-3, 16-9 and TR-27 stay blocked.
- **16-2:** eight Miner Guerrillas appear as neutral units (uncounted, taunt −1, cannot be blocked, 3,000 HP, 500 ATK). Some leave at their exit and no life is lost for it. 34 counted enemies, as PRTS lists; no errors.
- **Attack:** 500 Physical on an enemy half a tile away, 3 s apart.
- **Medic:** three heals of half her ATK in 3 s; none once she is withdrawn.
- **Fear:** 600 HP lost in 3 s, and the loss stops with the fear.
- **Six-star 16-2** (1 life point, 1,800 HP) **and CG-3 with its Challenge** run to the end without errors, with their Miner Guerrillas.

## Not checked

- In game, and in the browser.
- **CG-3 against a wiki page.** It became available because its only missing piece was this unit; its own numbers were not compared.
- **Enemies attacking the Miner Guerrillas.** The Patrol Captains' shots at neutral units were built for chapter 8 and were not re-tested here.
- **Everything about pollution itself.** That is the next piece: the Heavily Polluted Facility, the Rock Wall, the Hidden Tunnel and the chapter's soldiers.
