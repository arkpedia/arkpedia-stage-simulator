# Shanhaizhong Ringleader and Secret-Keeper

`enemy_1299_ymkilr` and `enemy_1299_ymkilr_2` (one database level each, 800 and 1,000 ATK) are admitted from their pinned CN prefabs (`battle/enm_pfb_12.ab`). They are physical melee units with the shared `<$ba.invisible>Invisible</>` trait; the engine's ordinary stealth already matches their toggle (lifted while blocked, back 3 s after the block ends).

**Empowered first attack (`InvisibleCombat`).** The invisibility buff `ymkilr_t_invisible` uses the template `enemy_ymkilr_t_invisible`:
- on start, it clears `ymkilr_atk_up[mark_finish]` and, unless the owner is immune to invisibility, leaves the permanent mark `ymkilr_atk_up[mark]`;
- every 0.1 s, it leaves the mark again if the owner holds neither the mark nor `[mark_finish]`.

The attack skill (wrapper `_familyMask` 2, trigger "contains `ymkilr_atk_up[mark]`") is the ordinary melee packet at the skill's `atk_scale` (2). At its attack event it finishes the mark and adds `[mark_finish]`. The mark outlives the invisibility, so the empowered hit is the first attack after a block reveals the unit; later attacks are ordinary until invisibility starts again.

## Shared changes

- `server/sim/content/arkpedia-enemy-invisible-strike.js`: the reusable `invisibleStrike` kind. It tracks whether the invisibility buff is on (not blocked, not switched off after a block; an anti-invisibility reveal does not end it), keeps the mark as the template does, and scales the next attack's ATK before mitigation.
- Original models are in `arkpedia-sd-assets` `cb43f823`.

## Verification

`test/arkpedia-shanhaizhong-assassins.test.js`:
- admission, and refusal when the skill scale, the template's conditions or the restore delay change;
- a blocked assassin's first attack deals 2× ATK and the next 1×;
- after the block ends, invisibility returns in 3 s with a fresh mark and the next blocked attack is 2× again;
- invisibility and its mark return while a reveal is active.

## Boundaries

- **Immunity to invisibility.** The template's `CheckAbnormalImmune INVISIBLE` is not modelled: no source in the simulator makes an enemy immune to invisibility.
- **Skill as a modifier.** The marked attack is applied as a 2× scale on the ordinary attack, which uses the same clip and packet. The mark is spent when the hit is issued, read here as the attack event.
- **Reveal.** An anti-invisibility reveal is read as not ending the invisibility buff, so it neither starts nor stops the mark cycle.
