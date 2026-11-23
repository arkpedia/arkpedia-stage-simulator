# Fieldmus and Hard-Snouted Fieldmus

Two fast melee rodents from the Act31 Blight family:
- **Fieldmus** (`enemy_1395_dhxts`): 1,700 HP, 180 ATK, 0 DEF, 0 RES, attack interval 1.3, move speed 1.9, weight 1.
- **Hard-Snouted Fieldmus** (`enemy_1395_dhxts_2`): 2,200 HP, 250 ATK; otherwise the same.

Hard-Snouted Fieldmus alone blocked VEC-SP04 "Gnawed-Out Holes" and VEC-SP05 "Gnawbeast Tsunami". Its other stages, and every Fieldmus stage, wait on other work: the Throttle Valve and Sky Pole devices, Blight stage rules, and other enemies.

Both are admitted from their pinned CN prefabs and the Global buff templates. `shared/arkpedia/enemy-fieldmus-features.js` holds the contract. It pins:
- the record (stats, both ability texts, the TL skill with its `hp_ratio`);
- every component reachable from the retained abilities (the variants differ only in their skeleton);
- the `enemy_dhxts_passive`, `enemy_dhxts_hit_tl` and `empty` templates;
- the Attack clip clock from `refs/arts/enm_art_15.ab`: 1.1 s, hit at 0.367 s.

The runtime is `server/sim/content/arkpedia-enemy-fieldmus.js`, kind `fieldmus`.

## Attack

An ordinary melee attack at the Attack clip's event.

## TL: attacks surrounding Throttle Valves

TL is a skill with no cooldown and no SP. Its familyMask-1 wrapper has a trigger selector: a 0.5 circle, filter tag `trap_dhtl` (the Throttle Valve), and one target.
- **Target.** When a valve is in reach, it casts the Attack clip on it. The nearest valve is chosen; `_postFilter` 4 is read as the nearest.
- **The hit.** At the event, `enemy_dhxts_hit_tl` lands on the valve: `DamageViaMaxHpRatio`, Pure, no SP. The damage is `hp_ratio` (1%, or 2% for Hard-Snouted) of the valve's own maximum HP. `_getMaxHpFromTarget=false` is read as the recipient's maximum HP, the reading reviewed in `docs/STAGE-POWER-ARMOR-REVIEW.md`.
- **During the cast.** It stands still and makes no ordinary attack.
- **Repeats.** With no cooldown, it casts again as soon as the clip ends while a valve stays in reach.

The runtime targets any live unit tagged `trap_dhtl`. No published stage has a Throttle Valve yet; that device is stages-phase work.

## Passive: Invisible on Blighted tiles

`enemy_dhxts_passive` triggers every 1 s. The first trigger comes at once (`waitFirstTriggerInterval` 0).
- **On a Blighted tile** (`Act31SideCheckInPolluteArea`), not blocked and not yet Invisible: it derives `enemy_dhxts_passive[invis]`, which has the INVISIBLE flag.
- **Off the Blight:** the derived buff ends at the next check.
- **Blocked:** `ON_OWNER_BLOCKEE_CHANGED` with `CheckBlocked` ends it at once. While blocked it does not return.

The Blight test reads the battle's `act31SidePollute` environment provider (`shared/arkpedia/environment-conditions.js`), the one the Blight Archers use. Without a provider it is never Blighted. Invisible is the engine's `stealth` flag with no restore delay: the runtime owns both removal and return.

## Verification

`test/arkpedia-fieldmus.test.js`:
- **Admission.** Both variants are admitted. Each of these is refused:
  - Physical instead of Pure;
  - the attacker's maximum HP instead of the valve's;
  - CAMOUFLAGE instead of INVISIBLE;
  - no removal on block;
  - another filter tag;
  - a larger trigger;
  - another `hp_ratio`.
- **Blight.** No stealth without the Blight. On it, the Fieldmus turns Invisible at the next 1 s check. After the Blight ends it stays Invisible until the following check, then drops it.
- **Blocking.** A block removes the Invisibility at once, and it does not return while blocked. Once free, it is back at the next check.
- **Valves.** For both variants:
  - with no valve there is no cast;
  - with valves at 0.4 and at 2, only the near one is hit: Pure, for `hp_ratio` of its maximum HP;
  - there is no ordinary attack during the cast;
  - it hits once per 1.1 s clip.
- **Compiled VEC-SP04 and VEC-SP05.** Hard-Snouted Fieldmus has 2,200 HP and 250 ATK. It stays visible (no Blight) and never casts (no valves). No battle errors.

The library rebuild published VEC-SP04 and VEC-SP05 (1,024 available); no other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures. The browser review passed, and both stages load in the preview with no console errors.

## Boundaries

- **Valve order.** `_postFilter` 4 is read as the nearest valve.
- **Cast speed.** The TL cast runs the Attack clip at its own length, slowed by Slow effects (`slowDownRate`). `_maxAnimScale` −1 suggests attack speed does not shorten it; this is unchecked.
- **Stunned while casting.** A Stun during the cast does not cancel it in this runtime. That is unchecked in game; it matters only once valves exist.
- **Presentation.** The hit spark and the stealth effect are not reproduced.
