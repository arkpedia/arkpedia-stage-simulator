// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { make as baseMake, advance, until, born } from './helpers/marcil-fixture.js';
import { prepareMarcilFamiliar, MARCIL_FAMILIAR_CONTRACT } from '../server/sim/content/arkpedia-marcil-familiar.js';
import { prepareMarcilExplosion, MARCIL_EXPLOSION_CONTRACT } from '../server/sim/content/arkpedia-marcil-explosion.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
function make(skill, opts = {}) {
  return baseMake({ skill, ...opts,
    ...(skill === 2 ? { prepare: prepareMarcilFamiliar, contract: MARCIL_FAMILIAR_CONTRACT } : {}),
    ...(skill === 3 ? { prepare: prepareMarcilExplosion, contract: MARCIL_EXPLOSION_CONTRACT } : {}),
  });
}

for (const skill of [1,2,3]) for (let rank=1; rank<=10; rank++)
  test(`S${skill} rank ${rank} denies sub-minimum mana but admits its exact minimum after birth`, () => {
    const f=make(skill,{rank}), minimum=f.record.bb.skill_cost_min_sp;
    f.u.skill.setSpTotal(minimum-1e-6); born(f);
    assert.equal(f.controller.canActivate(),false); assert.equal(f.u.skill.activate('manual'),false);
    advance(f,.6); assert.equal(f.u.skill.activations,0);
    assert.equal(f.wallet.value,minimum-1e-6); assert.equal(skillHud(f.u.skill).ready,false);
    f.u.skill.setSpTotal(minimum);
    assert.equal(f.controller.canActivate(),true);
    if (skill === 2) {
      assert.equal(skillHud(f.u.skill).ready,false); advance(f,f.b.dt);
      assert.equal(f.u.skill.activations,1); assert.equal(f.controller.mode,'chant');
    } else {
      assert.equal(skillHud(f.u.skill).ready,true); assert.equal(f.u.skill.activate('manual'),true);
      assert.equal(f.u.skill.activations,1);
    }
    assert.equal(f.wallet.value,minimum); // Chant entry never debits mana.
    f.b.forceEnd('fixture'); assert.deepEqual(f.b.errors,[]);
  });

for (const skill of [1,2,3]) for (const dir of ['RIGHT','UP','LEFT','DOWN'])
  test(`S${skill} ${dir} cannot replace Start or begin attacking before its deployment gate`, () => {
    const f=make(skill,{dir});
    assert.equal(f.u.mem.regularFormVisual.clip,'Start'); assert.equal(f.controller.canActivate(),false);
    assert.equal(f.u.skill.activate('manual'),false); assert.equal(skillHud(f.u.skill).ready,false);
    const deadline=f.controller.bornUntil;
    advance(f,deadline-f.b.time-.1);
    assert.equal(f.u.skill.activations,0); assert.equal(f.controller.canActivate(),false);
    assert.equal(f.u.mem.regularFormVisual.clip,'Start');
    born(f);
    if (skill === 2) assert.equal(f.u.skill.activations,1);
    else { assert.equal(f.controller.canActivate(),true); assert.equal(f.u.skill.activate('manual'),true); }
    f.b.forceEnd('fixture');
  });

for (const skill of [1,2,3]) for (const interruption of ['control','hidden'])
  test(`S${skill} brief ${interruption} cannot erase the deployment deadline`, () => {
    const f=make(skill), deadline=f.controller.bornUntil;
    if (interruption === 'control') f.b.applyStatus(f.u,'stun',{duration:.1});
    else f.u.hidden=true;
    advance(f,.2); f.u.hidden=false;
    assert.equal(f.controller.bornUntil,deadline);
    assert.equal(f.controller.canActivate(),false); assert.equal(f.u.skill.activate('manual'),false);
    advance(f,.6); assert.equal(f.u.skill.activations,0); assert.equal(f.controller.canActivate(),false);
    born(f);
    if (skill === 2) assert.equal(f.u.skill.activations,1);
    else assert.equal(f.u.skill.activate('manual'),true);
    f.b.forceEnd('fixture');
  });

for (const skill of [1,3])
  test(`S${skill} still interrupts a started chant at the half-second check if its mana falls below minimum`, () => {
    const f=make(skill); born(f);
    const minimum=f.record.bb.skill_cost_min_sp; f.u.skill.setSpTotal(minimum);
    assert.equal(f.u.skill.activate('manual'),true); const started=f.b.time;
    assert.equal(f.mana.controller.consume(1),true);
    advance(f,.45); assert.equal(f.u.skill.active,true);
    until(f,()=>!f.u.skill.active,1);
    assert.ok(f.b.time>=started+.5); assert.ok(f.b.time<=started+.5+2*f.b.dt);
    assert.equal(f.wallet.value,minimum-1); assert.equal(f.hits.length,0);
    f.b.forceEnd('fixture');
  });
