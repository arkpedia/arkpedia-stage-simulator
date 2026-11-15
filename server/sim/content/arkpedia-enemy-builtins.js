// SPDX-License-Identifier: GPL-3.0-or-later
import { featureAbilities,rebornAbility,elem,hurt,areaAlliesInTiles } from './enemies.js';
import { periodicDamage } from '../damage.js';
export const builtinEnemyAbilities=Object.freeze({
  permanentStatusResistance: ({value}) => ({spawn(b,e){
    b.applyStatus(e,'resist',{key:'ab:permanentResistance',source:e,value});
  }}),
  stageSupplyDrop: ({ token, count, delay }) => ({
    death(c, b, e, a) {
      // Bare catalogue fixtures have no level-owned reward. Stage compilation
      // requires both parameters and a matching card before this can ship.
      if (c.reason !== 'killed' || !token || !count || a.released || e.s.flags.silence) return;
      a.released = true;
      b.after(delay, () => b.grantStageToken(token, count), { holdsBattle: true });
    },
  }),
  reborn: params => rebornAbility(params),
  // 持续损失生命: `amount` HP every second, sourceless.
  periodicLoss: ({ amount }) => ({ iv: 1, tick(b, e) { if (amount > 0) b.dealDamage(null, e, periodicDamage(amount)); } }),
  swim: ({ atk }) => ({
    spawn(b, e) { e.mem.erosionImmune = true; },
    tick(b, e) {
      if (!(b.highTide?.active && b._isFlooded?.(e.tileR, e.tileC)) && !e.findBuff('buff_sea')) return;
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
