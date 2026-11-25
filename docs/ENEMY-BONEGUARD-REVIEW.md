# Boneguard Fluxcasters

Sarkaz Boneguard Fluxcaster `enemy_1365_spnwiz` and its Captain `enemy_1365_spnwiz_2` (PRTS 萨卡兹骸骨漂泊术师 / 术师长) are ranged Arts casters. Knocked out inside a Bloodcalling Altar's range, they drift out of reach until the Altar's next pulse brings them back.

This batch publishes SE-7, SE-7 challenge mode, H13-2 adverse and VEC-SP07 (1,155 available; main story still 426 of 564). The Fluxcasters and the Altar's guard against unmodelled reactions were their only blockers.

## Native evidence

`shared/arkpedia/enemy-boneguard-features.js` (`boneguardNative`) checks the pinned prefab and three templates. The extractor now keeps the Fluxcasters' `Default`, `Ghost`, `Attack`, `Reborn`, `Reborning`, `Passive` and `Revive` objects. The shared `talent:Reborn` key dispatches here for these two records instead of the generic one-time rebirth.

**The record**
- 5,000 / 7,000 HP, ranged, Arts, attack range 2.
- `Reborn.duration` 2; skills `Reborning` (duration 2) and `Revive`.

**Caster mode (`Default`)**
- Its Passive carries:
  - `enemy_spnwiz_default_mark` (template `enemy_spnwiz_reborn_ctrl`);
  - `enemy_spnwiz_undeadable` (flag 6);
  - a 0.15 s INVINCIBLE (`enemy_spnwiz_default[tick_invincible]`).
- **`enemy_spnwiz_reborn_ctrl`, ON_BEFORE_TRY_SET_HP_ZERO:**
  - holding `trap_bonore_in_range[default]`: it switches to its reborn state;
  - otherwise: the mark and `undeadable` finish, and it dies.

**Reborn**
- `_maxRespawnCnt` −1 (no limit), into mode 1 (`Ghost`), through the `Reborning` ability (2 s).
- `_hpRechargeRatio` 0.5.

**Ghost mode**
- `_combat` is empty, so it never attacks.
- Its Passive carries:
  - `enemy_spnwiz_ghost_mark` (template `enemy_spnwiz_bonore[action]`);
  - `enemy_spnwiz_ghost_suicide`, every 0.5 s, first at 0.5 s: no `trap_bonore_in_range[ghost]` → InstantKill;
  - `enemy_spnwiz_ghost_invincible`, flags 5 (INVINCIBLE), 6 and 22 (UNMOVABLE_PRIVATE, as reviewed for the Black Snake);
  - the Captain's only: an `enemy_bonore_mark` of its own.
- **`enemy_spnwiz_bonore[action]`, when the ghost mark finishes:** if `trap_bonore_in_range[ghost]` holds, the suicide check finishes and `Revive` runs. Revive's action is `SwitchMode` to mode 0, restoring defaults.

**The Altar side** (pinned in `stage-blood-altar.js`)
- **`SpnwizInRange`:** gives `trap_bonore_in_range[default]` to units carrying `enemy_spnwiz_default_mark`.
- **`SpnwizInRange2`:** gives `trap_bonore_in_range[ghost]` and `enemy_bonore_mark` to units carrying `enemy_spnwiz_ghost_invincible`.
- **The range:** both use a line validator with `_offset` 1 and `_includeSameLine` 1.
- **`trap_bonore_s` on a unit carrying `enemy_spnwiz_ghost_mark`:**
  - it creates `trap_bonore_spnwiz_revive[trigger]`, which finishes one `enemy_spnwiz_ghost_mark`;
  - it finishes `enemy_bonore_mark`;
  - it starts no branch phase.

## Runtime

**The Fluxcaster** (`server/sim/content/arkpedia-enemy-boneguard.js`, kind `boneguard`)
- **Caster mode:** an ordinary ranged attacker, with 0.15 s INVINCIBLE each time this mode starts.
- **Rebirth:** a knock-out turns into one when it is still in caster mode, did not fall, and `StageBloodAltars.covers(e)` holds. It then:
  - is untouchable and stunned for 2 s, with full HP;
  - drifts: invulnerable, untargetable, unblockable, rooted, disarmed (`e.mem.boneguardGhost`).
- **Drifting:** every 0.5 s, if no Altar covers it, it is killed. That counts as a kill.
- **Revive:** a pulse sets `e.mem.boneguardRevive`, and on its next tick it returns to caster mode with its route recomputed. It can drift again.

**The Altar** (`arkpedia-stage-blood-altars.js`)
- **`covers(e)`:** the unit's tile lies on the Altar's line or one line either side, from the Altar's tile onward along its facing, and the Altar is alive and not destroyed.
- **`marks(e)`:** a drifting Fluxcaster counts 1 while covered; the Captain always counts 1.
- **A pulse hit on a drifting one:** it revives it and spends no branch phase. It still takes one of the 10 targets and ends the pulse.
- Only the pilot is left in `BLOOD_ALTAR_UNMODELLED`.

## Checked

`test/arkpedia-boneguard.test.js`:
- **Pins:** both records pass. Refused:
  - a 5 s rebirth;
  - a single respawn;
  - a ghost that checks the wrong range;
  - an Altar that does not mark drifting units.
- **SE-7 with no waves:**
  - **In range** (row 5): a knock-out gives a 2 s rebirth at full HP, then the drift with all five flags; true damage does nothing.
  - **Out of range** (row 2), or after a fall: an ordinary death.
- **The 20 s pulse:**
  - it revives the drifter with 0 conversions and no Spawn, and an Amber beyond survives;
  - knocked out again, the drifter and an Amber beside it are both taken at 40 s: one Spawn.
- **Altar destroyed:** the drifter dies within 0.5 s, counted as a kill.
- **Captain:** its mark stays when no Altar covers it.
- **Headless clears:** SE-7, its challenge mode, H13-2 adverse and VEC-SP07. A test hook kills every Fluxcaster it can target every 3 s, so they drift and revive repeatedly.

## Not checked

- In game.
- **Inferences**
  - The range validator is read as lateral ±1 line from the Altar's tile onward. Its class is not decoded; PRTS's drawing matches.
  - `_hpRechargeRatio` 0.5 is read as full HP, following the reviewed bosses (FrostNova). PRTS says 100%.
  - Revive's own animation (`Born`) is not timed: the switch is immediate, one tick after the pulse.
  - Flag 6 is not decoded. It has no effect here.
- The current CN `reborn_ctrl` adds a 0.01 s INVINCIBLE around the switch. The pinned Global template does not, and the model follows the pinned one.
