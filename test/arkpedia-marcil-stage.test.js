// SPDX-License-Identifier: GPL-3.0-or-later
// Private source actors on the pinned 0-1 map. This bypasses the public roster
// and placement economy; it is a composed engine regression, not browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { MARCIL_ID } from '../server/sim/content/arkpedia-marcil-source.js';
import { prepareMarcilFamiliar, MARCIL_FAMILIAR_CONTRACT } from '../server/sim/content/arkpedia-marcil-familiar.js';
import { prepareMarcilExplosion, MARCIL_EXPLOSION_CONTRACT } from '../server/sim/content/arkpedia-marcil-explosion.js';
import { make, advance } from './helpers/marcil-fixture.js';

for (const skill of [1,2,3]) for (const cancel of skill === 3 ? [false,true] : [false])
  test(`source-only S${skill}${cancel ? ' manual release' : ''} completes the pinned 0-1 waves and retires its hooks`, () => {
    const f = make({ skill, originalStage: true, tile: [4,6], dir: 'DOWN',
      ...(skill === 2 ? { prepare: prepareMarcilFamiliar, contract: MARCIL_FAMILIAR_CONTRACT } : {}),
      ...(skill === 3 ? { prepare: prepareMarcilExplosion, contract: MARCIL_EXPLOSION_CONTRACT } : {}),
    });
    assert.equal(f.u.def.charId, MARCIL_ID);
    assert.deepEqual(f.b.grid.rect, { r0: 0, r1: 5, c0: 0, c1: 8 });
    assert.equal(f.b.grid.tile(4,6).height, 'HIGH');
    assert.equal(f.b.grid.tile(4,6).build, 'RANGED');
    assert.equal(f.b.getPlayer('arkpedia').dp, data.stage.battle.initial_dp);
    const before = structuredClone(f.b.grid.tiles), bursts = [];
    f.b.on('marcilExplosion', x => bursts.push(x));
    let cast = false, cancelled = false;
    while (!f.b.finished && f.b.time < 100) {
      if (skill !== 2 && !cast && f.b.time >= 5) cast = f.u.skill.activate('manual');
      if (cancel && !cancelled && f.controller.mode === 's3-extra') cancelled = f.controller.cancel();
      advance(f, f.b.dt);
    }
    const result = f.b._result;
    assert.equal(result.reason, 'cleared'); assert.equal(result.total, 11); assert.equal(result.errors, 0);
    const leaks = result.perPlayer.arkpedia.leaked.filter(x => x.counted).length;
    assert.equal(result.killed + leaks, result.total);
    assert.equal(f.b.life, data.stage.battle.max_life - leaks);
    assert.ok(result.killed >= 10); assert.ok(f.hits.length >= 10);
    assert.equal(f.u.skill.activations, 1);
    assert.ok(f.b.getPlayer('arkpedia').dp > data.stage.battle.initial_dp);
    assert.deepEqual(f.b.grid.tiles, before);
    assert.equal(f.controller.stopped, true); assert.deepEqual(f.controller.handles, []);
    assert.equal(f.wallet.closed, true); assert.equal(f.wallet.owner, null);
    assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.activate('manual'), false);
    if (skill === 3) {
      assert.equal(bursts.length, cancel ? 1 : Math.floor(f.record.mana.initial / 8));
      assert.ok(bursts.every(x => x.highTiles.length === 6));
      assert.ok(bursts.some(x => x.victims.length > 0));
      assert.equal(f.wallet.value, cancel ? f.record.mana.initial - 8 : f.record.mana.initial % 8);
      assert.equal(f.controller.marker, null);
    }
    advance(f, 5); assert.deepEqual(f.b.errors, []);
  });
