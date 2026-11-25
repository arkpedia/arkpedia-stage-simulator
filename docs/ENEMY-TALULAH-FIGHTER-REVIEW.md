# Talulah, the Fighter

`enemy_3002_ftrtal` (PRTS 斗士塔露拉) walks the R8 stages with the player's side, fighting the Ursus forces. This batch admits her and the four records whose ranged attack reaches her:
- the Infected Patrol Captains `enemy_1107_uoffcr` and `_2`;
- the Ursus Raiders `enemy_1111_ucommd` and `_2`.

It publishes R8-3, R8-8 and their Challenges (1,139 available).

Still blocked:
- R8-5, R8-6 and R8-11 wait on their devices or other enemies.
- JT8-1 waits on the story Fighter `enemy_3002_ftrtal_s` and the Ursus Civilian `enemy_3001_upeopl`.

## A neutral route actor

Her root has `_sideTypeIndex` 2. That is the Mark of Epoch's side, which the engine already runs as `side: 'neutral'`.
- She sits in the battle's separate `neutralUnits` list.
- Operators never select her (`canTargetEnemy`).
- She is not counted and holds neither a wave nor the battle's end.

The handover once called side 2 "ally"; it is neutral.

What the source adds:
- **`NeutralTag`** puts `mark_neutral[effect]` on her for life. That buff is BLOCK_FREE and sleep-immune, so nothing blocks her and sleep cannot touch her.
- **`Dead`** carries `upeople_t` (ON_OWNER_KILLED: `ModifyLifePoint` by `dead.value`, −2). If she is killed, the stage loses 2 life points.
- **Her record's `lpr` is 0.** PRTS: "进入敌方侵入点时不扣除目标生命，死亡时扣除目标生命".

The engine's `leak()` used to ignore anything not on the enemy side, so a neutral walker would have stood at its exit forever. A reviewed neutral route actor (`profile.neutralExit`) now leaves at its exit without cost.

## Her kit

Her kit is the boss Talulah's prefab layout. The selectors are the boss's, excluding targets already burning, and also skip units tagged `tap_roadblock`.

**Burning Breath and the shot**
- **Shot:** while nothing blocks her she fires `projectile_enemy_ftrtal` at speed 10 for ATK ×1 Arts (`_damageType` 2). There is no blocked mode. The clip `Attack` is 2 s with OnAttack at 1 s, and the record's 5 s attack time paces it.
- **Burning Breath (`DragonFire`):** one hostile enemy in her attack range (1.5) not already burning. Cooldown 20 s, first at 20 s. The burn lasts 30.5 s at 200/s, rising to 400/s over 20 s; resistance cuts its duration. Clip `Skill_1`: 2 s, release at 1 s.
- **Stellar Corona (`DanceFire`):** 200% Arts within 2.5, but its cooldown is 10,000 s, so it never comes up in a stage. Clip `Skill_2`: 3.67 s, release at 2.57 s.

**Half HP**
- Below half HP (`HalfHp` `_maxHpRatio` 0.5), DEF and RES rise by the blackboard's 50% (MULTIPLIER).
- `DragonFire[Half]` then runs every 10 s, first after 10 s.

**Runtime**
- The runtime is the new kind `talulahFighter`, held on her own Burning Breath ability line.
- The boss's talent and skill keys now cover both records: the boss keeps the `talulah` kind, she carries no ability on them.

## Who attacks her

Neither ordinary enemies nor operators ever select a neutral unit. The Patrol Captain and Ursus Raider prefabs each have a ranged `Attack` whose trigger selects only units carrying `mark_neutral[effect]`, ground only. PRTS: "可对半径1.2范围内的乌萨斯平民/斗士塔露拉/矿工游击队进行普通攻击（不可对空）".

The new kind `neutralShot` replaces the old name-priority flag, which had no effect:
- **When it fires:** while unblocked and off cooldown, the shooter fires its own projectile at the nearest marked ground unit within 1.2, for ATK ×1 Physical.
- **Clips:** the Captain's `Attack` is 1 s (OnAttack 0.5 s); the Raider's is 1.17 s (0.57 s).
- **Otherwise** they fight as before: melee on their blocker.

## Evidence

`shared/arkpedia/enemy-talulah-fighter-features.js` pins, for all five records:
- every component reachable from their retained abilities;
- the templates (`upeople_t`, `ftrtal_t_1` (audio only), `switch_mode_restart_fsm`, `log_hp_ratio`, `empty`);
- their projectiles;
- the clip clocks: `data/arkpedia-talulah-fighter-animations.json` from `refs/arts/enm_art_19.ab`, and `data/arkpedia-patrol-captain-animations.json` from `enm_art_6.ab`.

The 1.2 radius comes from PRTS: the trigger collider is not retained. Her two common abilities, the neutral mark and the death, are claimed as implemented.

## Checked

`test/arkpedia-talulah-fighter.test.js`:
- **Pins:** pins and refusals for all five records.
- **R8-3 headless run:** she spawns neutral, uncounted, unblockable and sleep-immune, and operators cannot select her. She hits only enemies (her Arts shot and Burning Breath). Only Captain or Raider `neutralShot` hits reach her.
- **Life points:** killing her takes exactly 2 life points; her exit takes none.
- **Victory:** the stage clears once every counted enemy is gone.
- **R8-8 (probe):** she shoots the flying Targeteers and leaves at her exit without cost. Nobody there can hurt her.

Of the published stages, only the Captain and Raider definitions changed (37 bundles, Chapter 8 and events). With no neutral unit on the map their behaviour is unchanged.

## Not checked

- In game.
- **Inferences**
  - She picks the nearest hostile enemy.
  - She stands through each shot and skill clip.
  - The shooters choose the nearest marked unit.
  - Whether area attacks from enemies (the Targeteers' shells) can hurt her: the engine says no.
