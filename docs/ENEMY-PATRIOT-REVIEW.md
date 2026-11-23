# Patriot

`enemy_1506_patrt` has two database levels with the same talents:
- level 0: 45,000 HP, 1,600 ATK, 500 DEF, 45 RES; used by 7-18 and 7-18 Challenge;
- level 1: 60,000 HP, 2,000 ATK, 500 DEF, 45 RES.

Level one lists only `Immo[Rage]` (5% instead of 5.21%). Its spear and revive skills are read from level zero by prefab key (the Mandragora reading), so level one is unverified on a compiled stage.

He is admitted from his pinned CN prefab and the Global buff templates. His extraction scope is new, together with `projectile_spear`; only his prefab changed.

`shared/arkpedia/enemy-patriot-features.js` pins:
- every component reachable from his abilities (51, across his two modes: Default and Rage);
- four templates and the spear projectile;
- the clip clocks from `refs/arts/enm_art_16.ab`: Attack_1 lasts 1.5 s with four strikes at 0.63/0.73/0.83/0.93 s; Attack_2 lasts 1.37 s with a strike at 0.53 s; Skill lasts 3.43 s with its release at 1.7 s.

The runtime is the new `patriot` kind, attached through `talent:immo_trigger[rage]`, which claims three wrappers and two active abilities. The shared keys defer to his contract:
- `talent:reborn` (form bosses);
- `talent:strength` (the Guerrilla Herald and the Inspired receivers);
- `talent:shield` (the barrier enemies and Mephisto);
- `talent:taunt`;
- `skill:Immo[Rage]` (the pulse casters).

No other record's admission changed.

The rules not fixed by the data come from PRTS (`爱国者`).

## Throughout

- **Strength.** Every enemy on the field, selectability ignored and himself included, gets `enemy_9D0_talent_strength[patrt]`: ATK +20% (MULTIPLIER) and DEF +200. One grant holds per unit however many Patriots there are. Each also gets the Inspiration marker `enemy_9D0_talent_strength`, so the guerrillas' "When Inspired" bonuses apply while he is present. The grant stays through his revive.
- **Pulse immunity.** The Originium Altar's pulse does not damage him (`ore_immune`). He is also immune to sleep, and to silence from his record.

## Marching Stance

- **Shield.** ATK +50%, DEF +200%, RES +100% (MULTIPLIER items, which add up with Strength's +20%: ATK ×1.7, DEF (500+200)×3), and taunt +2.
- **Attack.** He attacks only his blocker (the Default mode has no attack trigger). Each attack strikes four times for 100% ATK Physical damage, on the clip's four events (`_additionalTimes` 3).

## First knock-out

- **The wave.** The current wave is released (`finish_current_wave_when_buff_finish` ends with the stance), without the next-wave option.
- **The revive.** 60 s, immobile and untargetable, with ATK +20% and DEF +200 (`patrt_trigger_ore[reborning]`).
- **Sacrifice.** Every 0.8 s it deals 5.21% ATK as true splash damage to ground operators within 1.75 (`Immo[Rage]`).
- **Revive HP.** Full HP, per PRTS; the native `_hpRechargeRatio` is 0.85, read the same way as for the earlier bosses' revives. Then 15 s of invincibility.

## Ruination Stance

- **Stats.** Immune to stun, freezing and levitation. Movement +0.1 and BAT -0.4. ATK +20% and DEF +200 also come from `immo_trigger[rage]`'s talent values; PRTS lists only the speed changes.
- **Attack.** A single 100% ATK Physical hit on one ground operator within 0.85, blocked or not.
- **Sacrifice.** It continues every 0.8 s.
- **Spear (`throwspear[Rage]`).** First at 15 s, then every 20 s, the cooldown running from the cast start. The target is the farthest ground operator on a ranged tile within 20. He stands through the 3.43 s Skill clip; the spear leaves at 1.7 s and lands after its 0.5 s life for 135% ATK Physical damage.
- **The next knock-out is final.**

## Verification

`test/arkpedia-patriot.test.js`:
- **Admission.** Both levels are admitted. Each of these is refused: a changed revive duration, a changed spear cooldown, fewer attack repeats, and a wider Sacrifice collider.
- **Strength.** The +20% ATK and +200 DEF, and the Inspiration marker (a Guerrilla Sniper gains its extra target). Two Patriots do not stack. The aura holds through the revive and is gone once both are defeated.
- **Marching Stance.** ATK ×1.7, DEF ×3 after the Strength flat, RES ×2, taunt 2, pulse immunity. He targets only his blocker and strikes four times.
- **Knock-out.** The wave is released. Sacrifice ticks every 0.8 s with true damage. After 60 s he is at full HP in Ruination Stance, invincible for 15 s, with the immunities and the BAT and range changes. Sacrifice continues, and the next knock-out is final.
- **Ruination.** A single hit; the spear goes to the ranged-tile operator rather than a farther ground-tile one, lands for 135% ATK, and its cooldown runs from the cast start.
- **Compiled stages.** On 7-18 and 7-18 Challenge (45,000 and 54,000 HP after the runes), with the Originium Altar:
  - he is pulse-immune;
  - a Guerrilla Sniper beside him is Inspired;
  - the knock-out releases the wave;
  - five Sacrifice ticks of true damage hit a Myrtle beside him in 4 s;
  - he ends in Ruination Stance at full HP and invincible, with no battle errors.

The library rebuild published exactly two more stages, 7-18 and 7-18 Challenge (1,013 available). No other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, the browser review passed, and 7-18 runs in the preview with Patriot drawn and no console errors.

## Boundaries

- **Revive HP.** Full HP, per PRTS, against the native 0.85.
- **Ruination ATK/DEF.** +20% and +200 from the talent values, which PRTS does not list. This is an in-game check.
- **Spear target.** "Ranged position" is read as a unit standing on a RANGED-build tile (`_buildableType` 2).
- **Spear timing.** It lands 0.5 s after the 1.7 s release, the projectile's life.
- **Not published.** His other stages wait on other work: H7-4 (a branch program), 14-20 and H14-4 (another boss, an environment), the Integrated Strategies and TN-4 bossrush variants, and VI-7.
- **Presentation.** The stance and revive effects are not reproduced.

## H7-4 (2026-11-23, main story)

H7-4 fields level-1 Patriot with a 30 s revive: the talent `reborn.duration` 30, and the skill `immo_trigger[reborning]` restated with `duration` 30.

**The sparse level.** Level 1 lists only its own `Immo[Rage]`, and the contract reads it over level 0. A new feature hook, `stageSparseSkills` (`shared/arkpedia/stage-enemy-talents.js`), gives the stage-override check that overlay as the skill list:
- Level 1's `Immo[Rage]`, level 0's `throwspear[Rage]` and `immo_trigger[reborning]`.
- A stage list naming some of these changes them in place and keeps the rest, instead of replacing the whole list.
- Patriot declares the hook for level 1 only, with the `reborn.duration` and `duration` overrides and a subset-only skill set.

**The level's branch.** It also carries a `frstar_frosts` branch whose Ice Crystal aliases name nothing in the level. The no-op rule (`emptyActivationBranches`) now accepts a branch whose aliases are all absent from the level's predefined units, not only a level with none at all.

`test/arkpedia-h7-4.test.js` checks:
- the compiled record: level 1's `Immo[Rage]`, a 30 s revive and reborning duration, and the no-op branch;
- a battle in which Patriot stands up from his first knock-out after 30 s.

H7-4 is published (1,060 available).
