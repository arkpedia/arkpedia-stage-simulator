# Armorless Union Cleanup Squads

Long-range Physical shooters (range 10, attack interval 5):
- **Cleanup Squad** (`enemy_1183_mlasrt`): 6,500 HP, 700 ATK, 200 DEF, 40 RES.
- **Cleanup Squad Leader** (`enemy_1183_mlasrt_2`): 8,000 HP, 800 ATK.
- **Lazurite, Roy** (`enemy_1183_mlasrt_3`): 9,000 HP, 800 ATK at level 0; 15,000 HP, 1,000 ATK, 300 DEF at level 1.

The Leader alone blocked VEC-SP03 "Covering Fire", and Roy (level 1) alone blocked AW-S-1 "Sheathe".

All three are admitted from their pinned CN prefabs. `shared/arkpedia/enemy-cleanup-squad-features.js` holds the contract. It pins:
- every level's record (stats, ability texts, the EpDamage talent, the PowerAttack skill, the SP row);
- every component reachable from the retained abilities. The variants differ only in their skeleton, and Roy's kill-log passive (`log_killed`) adds no combat effect;
- both projectiles;
- the Attack (1.5 s, release at 1.17 s) and Skill (2 s, release at 1.5 s) clips from `refs/arts/enm_art_8.ab`.

The runtime is `server/sim/content/arkpedia-enemy-cleanup-squad.js`, kind `cleanupSquad`.

**Feature keys.** `skill:PowerAttack` is also the Cannoneer's and the Porcelain Caster's key. `enemy-wine-features.js` dispatches `covers`, `ability` and `explains` to this contract for the Squads.

## Shots

- **Ordinary shot.** One target in range. The speed-10 `projectile_enemy_mlasrt` (lifetime 10) deals ATK Physical.
- **PowerAttack.** SP rises by 1 per attack (INCREASE_WHEN_ATTACK), up to 3. Once SP reaches 3, the next attack spends it: the Skill clip fires the speed-10 `projectile_enemy_mlasrt_s` for `atk_scale` (1.5) × ATK. So every fourth shot is a power shot.
  - **Silence.** A silenced Squad keeps its SP and fires ordinary shots; it powers the next attack once free.
  - **Clip.** A walking Squad stands for the clip of its next shot (`attackAnim` switches to the Skill clip while a power shot is due).
- **Corrosion.** Every attack hit, ordinary or power, adds `EpDamage.attack@ep_damage_ratio` (0.35) × ATK Corrosion. Both casts carry `_elementDamageType` 2.
  - The runtime applies it itself. `talent:EpDamage` in `enemy-features.js` is a covers-only entry: a later key overrides the elementOnHit family entry of the same name, so no other supported enemy gets this Corrosion line yet.

## Verification

`test/arkpedia-cleanup-squad.test.js`:
- **Admission.** Every variant and level is admitted, and the Cannoneer keeps its own PowerAttack. Each of these is refused:
  - another SP cost;
  - another scale;
  - a slower power projectile.
- **Shots.** For each variant:
  - three ordinary shots at ATK, then a power shot at 1.5 × ATK;
  - Corrosion of 0.35 × ATK on each hit;
  - the Skill clip is the next clip once SP is full, and the Attack clip again afterwards.
- **Silence.** A silenced shot is ordinary, and the next free shot is the power shot.
- **Compiled stages.**
  - AW-S-1: Roy is at 15,000 HP and 1,000 ATK, with his SP account installed. The stage fields a fixed squad, so Myrtle cannot deploy there.
  - VEC-SP03: the Leader is at 8,000 HP and 800 ATK, and hits a deployed Myrtle with Physical and Corrosion.
  - No battle errors.

The library rebuild published AW-S-1 and VEC-SP03 (1,032 available); no other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, and the browser review passed.

## Boundaries

- **Skill cooldown.** PowerAttack's 1 s cooldown (and 1 s initial cooldown) never binds at a 5 s attack interval, so it is not modelled separately.
- **Presentation.** The muzzle and buff effects are not reproduced.
