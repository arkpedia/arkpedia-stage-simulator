# Mephisto, "The Singer"

`enemy_1514_smephi` has two database levels:
- level 0: 60,000 HP, 450 ATK; used by M8-8 and its Challenge;
- level 1: 70,000 HP, 550 ATK; used by H8-3.

He is admitted from his pinned CN prefab and the Global buff templates. His extraction scope is new in `extract-enemy-native-abilities.py`; only his prefab changed.

`shared/arkpedia/enemy-mephisto-features.js` pins:
- every component reachable from the retained abilities (95, across three modes);
- fourteen templates;
- his projectile;
- the clip clocks from `refs/arts/enm_art_16.ab`.

The runtime is the new `mephisto` kind, attached through `talent:rage_aura`, which both levels carry. That feature claims seven skill wrappers and the four active abilities: the two release-wave bodies and the born and kill logs. The shared `skill:blink` (Crownslayer, checkpoint blinkers) and `talent:shield` (barrier families) defer to his contract; `skill:blink` keeps claiming its own wrapper.

The rules not fixed by the data come from PRTS (`梅菲斯特，“歌者”`).

## Level one

Level one lists two skills: Poison with 80 damage, and a slower blink (initial 90 s, cooldowns 105, 180, 120 …, delay 0.25). They are read as a sparse overlay on level zero by skill prefab key, as for the other bosses. PRTS lists Heal and Dust Release for level one too.

## Throughout

- He cannot be blocked and never walks (`smephi_immune`: self-bound, unbalance-immune).
- **Toxicity.** Every `hp_ratio` of max HP lost (20% while Active, 15% in Rage, counted from his HP when the state began) adds one 30 s Toxicity stack.
  - There are at most five stacks, each with its own timer.
  - Each stack also forces Dust Release: a 1 s cast with invincibility and disarm.
  - While stacks remain, every second all ground operators take `damage` × stacks as sourceless pure damage (`smephi_poison_trigger` → Poison; 50 on level 0, 80 on level 1). The Poison selector is ground-only and also hits units that cannot be targeted.
- **Blink.** First after `initCooldown` (30 s; 90 s on level 1); after each blink the next cooldown comes from the `cooldown_0`…`cooldown_5` list (75, 65, 60, 45, 30, 30).
  - He hides for `delay` plus Move_begin and Move_end (2.42 s; 1.42 s on level 1, matching PRTS), invulnerable, untargetable and unblockable.
  - He then reappears at the next MOVE checkpoint of his route, using the 'Awaken' blink helper.
  - Not while Dormant.

## Active and Rage

- **Attacks.** At most two ground targets, with a speed-8 Arts shot (Attack: 2.33 s, strike at 1.63 s).
- **Heal.** Cooldown 10 s, initial 0. It heals up to three hurt allies (never himself), lowest HP ratio first, for `atk_scale` × ATK, at Skill's strike (0.93 s of 2.67 s).
- **Host aura.** Allies tagged `mutant` get ATK ×(1 + 0.1) and ASPD +10 while he is Active; ×(1 + 0.2) and +20 in Rage. None while he is Dormant.

## Two revives

1. **Active, knocked out.** The current wave is released, tracking him at the next wave. After `reborn.duration` (2.6 s) he enters the Dormant state at full HP:
   - 2 s invincible;
   - DEF +2,200 and RES +50;
   - heals 200 HP per second;
   - disarmed, with no skills.
2. **Dormant, knocked out or after 100 s** (`smephi_suicide_after_buff` kills him at the timeout). The wave is released without tracking. After 2.6 s he enters Rage:
   - with his current HP, but at least half (`reborn.min_hp_ratio`);
   - 2.6 s invincible;
   - ATK +20%.
3. **Rage, knocked out.** Final.

## Stage values

M8-8 Challenge doubles `Poison.damage` (an `enemy_skill_blackb_mul` rune with difficulty FOUR_STAR, so normal M8-8 keeps 50). The feature declares the multiplier, and the contract accepts any positive Poison damage.

## Verification

`test/arkpedia-mephisto.test.js`:
- **Admission.** Both levels are admitted, as is the doubled dust; a changed Dormant DEF is refused. The level-one overlay gives 80 dust, a 90 s first blink and a 1.42 s hide.
- **Host aura.** A Host gets +10% ATK and +10 ASPD while he is Active, nothing while he is Dormant, and +20% / +20 in Rage.
- **Toxicity.** Each 20% lost adds a stack with Dust Release invincibility. The dust deals 50 per stack each second, and the stacks lapse after 30 s.
- **Heal.** It restores ATK to a hurt ally and never to himself.
- **Revives.** The wave is released with tracking; then Dormant: full HP, +2,200 DEF, invincible, no attacks, healing. A knock-out releases the wave again into Rage at half HP with +20% ATK; the Rage knock-out is final.
- **Blink.** He is hidden and protected, reappears at the next checkpoint, and the next cooldown is the list's first value.
- **Compiled stages.** M8-8 (dust 50), M8-8 Challenge (dust 100) and H8-3 (level 1, dust 80) take him through Dormant into Rage without battle errors.

The library rebuild published exactly three more stages: M8-8, M8-8 Challenge and H8-3 (1,002 available). `check-stage-library.mjs` smoked every graph with no failures, the browser review passed, and M8-8 opens in the preview.

## Boundaries

- **Heal count.** Heal reaches three allies (the selector's `_maxNum` 3), although PRTS says all hurt enemies.
- **Full stacks.** At five stacks, a new stack replaces the one closest to expiring.
- **Host aura damage.** The aura's per-second `damage` (0) is not modelled.
- **Presentation.** The BGM change and the native animation states are not reproduced.
