# Direswine and Raging Direswine

`enemy_1309_mhboar` and `enemy_1309_mhboar_2` (one database level each) are admitted from their pinned CN prefabs (`battle/enm_pfb_13.ab`) and the Global buff templates. The prefabs are identical; only the talent values differ:

| | Direswine | Raging Direswine |
|---|---|---|
| Movement Speed | 0.35 | 0.4 |
| Predelay | 5 s | 3 s |
| Trigger budget | 30 | 35 |
| First attack | 500 × MSPD | 600 × MSPD |
| Crash | 700 × MSPD | 800 × MSPD |

Both are physical melee units that only units with 2 Block can block (the existing block-weight feature).

**Rush (`Rush`).** Five listener buffs run every 0.1 s:
- one starts a rush when the unit is not blocked, stunned, bound, frozen or levitated: `mhboar_t[trigger]` and a fresh `mhboar_t_predelay` for `predelay` seconds;
- four end the rush on stun, bind (unmovable), freeze or levitate. Blocking does not end it.

The trigger fires every `interval` (0.333 s) up to `trig_cnt` times. After the predelay, each firing stacks another additive `move_speed` (+33.3%) Movement Speed multiplier.

**First attack (`FirstAttack`).** Each attack target receives `mhboar_t_atk`. When that buff ends during a rush, it deals `atk_scale` × the Direswine's Movement Speed as physical damage, then ends the rush. The damage is read before the reset.

**Crash (`Crash`).** A 0.5-radius contact area applies `mhboar_crash` to touching allies. While the Direswine moves under its own power, that deals `atk_scale` × Movement Speed physical damage and a stun of `stun` seconds (0 for both).

All of this is the new reusable `direswineRush` kind. The shared `talent:FirstAttack` and `talent:Crash` features dispatch to it for these two records only.

## Verification

`test/arkpedia-direswine.test.js`:
- admission, and refusal when a listener or the crash collider changes;
- the stack count and final speed from the trigger budget;
- stun ends the rush and a fresh predelay follows;
- the first blocked attack's packet uses the accelerated speed and resets it;
- the contact crash deals speed × coefficient once per contact.

## Boundaries

- **Budget.** As for the Lancers (`lancerCharge`, based on a stage measurement), trigger firings during the predelay use up the budget: the Direswine reaches 15 stacks, the Raging Direswine 26. The EN wiki says "up to 30 times" (35 for the Raging Direswine).
- **Moving by itself.** `IfEnemyIsMovingBySelf` is read as the engine's own route movement (`e.moving`); displacement does not count.
- **Damage source.** `DamageViaAttr` with `_getAttrFromTarget` is read as the Direswine's own Movement Speed, matching the EN wiki's "(700 × MSPD)".
- **Wiki values.** The EN wiki's first-attack figure (600) is the Raging Direswine's; the Direswine's is 500.
