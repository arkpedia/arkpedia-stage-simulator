// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage enemy feature runtime: applies the declarative features of
// shared/arkpedia/enemy-features.js to every spawned enemy. Spawn traits set
// flags or attack fields; ability features attach the shared Stronghold
// abilities (content/enemies.js) through its features-only dispatch, never its
// per-enemy kits.
import { enemyFeature, recordFeatureIds } from '../../../shared/arkpedia/enemy-features.js';
import { installFeatureDispatch, attach, abOf, rebornAbility, featureAbilities, elem, hurt, areaAlliesInTiles } from './enemies.js';
import { chapter16Abilities } from './chapter16.js';
import { periodicDamage } from '../damage.js';

const ABILITIES = Object.freeze({
  ...chapter16Abilities,
  reborn: params => rebornAbility(params),
  ...featureAbilities,
  // 持续损失生命: `amount` HP every second, sourceless.
  periodicLoss: ({ amount }) => ({ iv: 1, tick(b, e) { if (amount > 0) b.dealDamage(null, e, periodicDamage(amount)); } }),
  swim: ({ atk }) => ({
    spawn(b, e) { e.mem.erosionImmune = true; },
    tick(b, e) {
      if (!b.highTide?.active || !b._isFlooded?.(e.tileR, e.tileC)) return;
      b.addBuff(e, { key: 'ab:swim', duration: 1.2, refresh: 'replace', visible: true, mods: { atkPct: atk }, flags: { stealth: true } });
    },
  }),

  pancho: () => ({
    spawn(b, e, a) {
      a.form = 1; a.f = 0; a.b = 0; a.w = 0; a.u = 0; a.whirl = 0;
      e.profile.noAttack = true;
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      a.f += dt; a.b += dt; a.w += dt; a.u += dt; a.whirl += dt;
      if (a.f >= 20) { a.f = 0; const k = b.spawnEnemy('enemy_1162_magmot', { pos: [e.tileR, e.tileC] }); if (k) k.s.moveSpeed = 0.5; }
      if (a.b >= 17) { a.b = 0; b.spawnEnemy('enemy_1164_bmbmot_3', { pos: [e.tileR, e.tileC] }); }
      if (a.w >= 18) {
        a.w = 0;
        const t = b.allyUnits.filter(u => u.alive && u.deployed).sort((x, y) => y.s.maxHp - x.s.maxHp)[0];
        if (t) { hurt(b, e, t, e.s.atk * 0.2, 'arts'); elem(b, e, t, 'erosion', e.s.atk * 0.2); }
      }
      if (a.u >= 18) {
        a.u = 0;
        const t = b.allyUnits.filter(u => u.alive && u.deployed).sort((x, y) => y.s.def - x.s.def)[0];
        if (t) { hurt(b, e, t, e.s.atk * 0.5, 'phys'); b.addBuff(t, { key: 'pancho:defdown', duration: 10, mods: { defPct: -0.5 }, visible: true }); }
      }
      if (a.whirl >= 2 && a.form === 2) {
        a.whirl = 0;
        for (const u of areaAlliesInTiles(b, e, e.tileR, e.tileC, 'box', 1)) {
          if (u.alive) { hurt(b, e, u, e.s.atk, 'phys'); elem(b, e, u, 'erosion', e.s.atk * 0.3); }
        }
      }
    },
    killed(c, b, e, a) {
      if (a.form !== 1) return false;
      a.form = 2; e.base.maxHp = e.s.maxHp = 35000; e.base.atk = e.s.atk = 1200; e.base.def = e.s.def = 850;
      e.hp = 35000; e.profile.noAttack = true;
      b.addBuff(e, { key: 'pancho:form2', duration: 10, visible: true, flags: { invulnerable: true } });
      return true;
    },
  }),
  bmbmot: ({ scale, epRatio }) => ({
    death(c, b, e) {
      for (const u of areaAlliesInTiles(b, e, e.tileR, e.tileC, 'box', 1)) {
        if (!u.alive) continue;
        hurt(b, e, u, e.s.atk * scale, 'phys');
        if (epRatio > 0) elem(b, e, u, 'erosion', e.s.atk * epRatio);
      }
    },
  }),
  bleed: ({ ratio }) => ({ iv: 1, tick(b, e) { if (ratio > 0) b.dealDamage(null, e, periodicDamage(e.s.maxHp * ratio)); } }),
  almot: ({ life }) => ({
    spawn(b, e) { e.counted = false; },
    death(c, b, e) { if (life) b.life = Math.max(0, b.life + life); },
  }),
  crash: ({ scale, block }) => ({
    spawn(b, e) { e.blockWeight = Math.max(e.blockWeight ?? 1, block); },
    tick(b, e) {
      const u = e.blockedBy; if (!u || !u.alive || e.mem.crashAt === u.id) return;
      e.mem.crashAt = u.id; hurt(b, e, u, e.s.atk * scale, 'phys');
    },
  }),
  drown: ({ damage }) => ({ iv: 1, tick(b, e) { if ((e.elem?.erosion ?? 0) > 0) b.dealDamage(null, e, periodicDamage(damage)); } }),
  splashCorrosion: ({ ratio }) => ({
    dealt(c, b, e) {
      if (!c.dmg?.isAttack || !c.target) return;
      for (const u of areaAlliesInTiles(b, e, c.target.tileR, c.target.tileC, 'plus', 1)) {
        if (!u.alive || u === c.target) continue;
        hurt(b, e, u, c.dmg.amount ?? 0, c.dmg.type ?? 'phys');
        if (ratio > 0) elem(b, e, u, 'erosion', e.s.atk * ratio);
      }
    },
  }),
});

/** Apply one spawned enemy's feature traits and abilities (its record is `e.def.raw`). */
export function applyEnemyFeatures(battle, e) {
  const record = e.def?.raw;
  // Only compiled catalogue records (shared/arkpedia/enemy-records.js) carry features.
  if (!record?.abilities || !record.talents?.groups) return;
  const abilities = [];
  for (const id of recordFeatureIds(record)) {
    const f = enemyFeature(id);
    if (!f) continue;
    if (f.trait?.flags) battle.addBuff(e, { key: `feature:${id}`, persist: true, flags: { ...f.trait.flags } });
    if (f.trait?.maxTargets) e.profile.maxTargets = Math.max(e.profile.maxTargets ?? 1, f.trait.maxTargets);
    const ability = typeof f.ability === 'function' ? f.ability(record) : f.ability;
    if (ability) {
      const make = ABILITIES[ability.kind];
      if (!make) throw Error(`Unknown enemy feature ability: ${ability.kind}`);
      abilities.push(make(ability.params(record), abOf(battle, e)));
    }
  }
  if (abilities.length) { installFeatureDispatch(battle); abOf(battle, e); attach(battle, e, abilities); }
}

/** Apply features to every enemy this battle spawns; the shared dispatch is installed only when an ability needs it. */
export function installEnemyFeatures(battle) {
  if (battle.regularEnemyFeatures) return;
  battle.regularEnemyFeatures = true;
  battle.on('enemySpawn', ({ enemy }) => applyEnemyFeatures(battle, enemy), { priority: 90 });
}
