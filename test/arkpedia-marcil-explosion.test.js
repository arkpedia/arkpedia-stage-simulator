// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import { MARCIL_ID as ID } from '../server/sim/content/arkpedia-marcil-source.js';
import { prepareMarcilExplosion as prepare, MARCIL_EXPLOSION_CONTRACT as contract, verifyMarcilExplosionSource }
  from '../server/sim/content/arkpedia-marcil-explosion.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { rotateOffset } from '../server/sim/dir.js';
import { make as baseMake, advance, until, born, enemy } from './helpers/marcil-fixture.js';
function make(opts = {}) {
  const f = baseMake({ skill: 3, prepare, contract, ...opts });
  f.bursts = []; f.marks = []; f.ends = [];
  f.b.on('marcilExplosion', x => f.bursts.push({ ...x, time: f.b.time }));
  f.b.on('marcilExplosionMarker', x => f.marks.push(x));
  f.b.on('marcilExplosionMarkerEnd', x => f.ends.push(x));
  return f;
}
function beginManual(f) { born(f); return f.u.skill.activate('manual'); }
const near = (a,z) => assert.ok(Math.abs(a-z) < 1e-5, `${a} != ${z}`);
function extra(f) {
  assert.equal(beginManual(f), true);
  until(f, () => f.controller.mode === 's3-extra', 8);
}
function release(f) { extra(f); assert.equal(f.controller.cancel(), true); }
function completeExtra(f) { extra(f); until(f, () => f.controller.mode === 's3-volley', 11); }
function high(f, dr = 0, dc = 0) {
  const centre = f.controller.marker ?? f.controller.centre();
  const [r,c] = rotateOffset(dr,dc,centre.dir);
  f.b.grid.tile(centre.row+r,centre.col+c).height = 'HIGH';
}
function finish(f) { until(f, () => !f.u.skill.active, 12); }
function at(f, dr=0, dc=0, opts={}) {
  const centre = f.controller.marker ?? f.controller.centre();
  const [r,c] = rotateOffset(dr,dc,centre.dir);
  return enemy(f,{row:centre.row+r,col:centre.col+c,...opts});
}

test('S3 requires its source-complete build and explicit contract while public registration and terrain stay held', () => {
  verifyMarcilExplosionSource(); assert.equal(contract.frameParity, false); assert.equal(contract.terrainImplemented, false);
  assert.equal(data.operators[ID], undefined); assert.deepEqual(evidence.enabledOperators, []);
  assert.throws(() => make({ contract: { ...contract } }), /explicit explosion contract/);
  for (const skill of [1,2]) assert.throws(() => make({ skill }), /selected S3/);
  for (const mutate of [d=>d.stats.atk++,d=>d.skill.bb.interval++,d=>d.skill.bb.trig_cnt++,
    d=>d.skill.bb.stun++,d=>d.skill.bb.sp_cost_extra++,d=>d.talents[0].bb.atk++])
    assert.throws(() => make({mutate}), /Incomplete/);
});

for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank} cancels only its extra chant, debits once per burst and uses selected damage/stun`,()=>{
  const f=make({rank}); const mana=f.wallet.value, atk=f.u.s.atk; const target=at(f); high(f);
  born(f); f.b.bench[ID]={unit:f.u}; assert.equal(f.b.activateOperator(ID),true);
  assert.equal(f.u.skill.end('manual'),false); assert.equal(skillHud(f.u.skill).canCancel,false);
  until(f,()=>f.controller.mode==='s3-extra',8);
  assert.equal(f.wallet.value,mana); assert.equal(f.wallet.completedExtraChant,false); assert.equal(f.hits.length,0);
  assert.equal(skillHud(f.u.skill).canCancel,true); assert.equal(f.b.activateOperator(ID),true);
  assert.equal(f.u.skill.active,true); assert.equal(f.wallet.completedExtraChant,false);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_Attack'); assert.equal(f.u.skill.end('manual'),false);
  until(f,()=>f.bursts.length===1);
  near(f.hits[0].hpLoss,atk*f.record.bb.atk_scale); near(target.findBuff('stun').duration,f.record.bb.stun);
  assert.equal(f.wallet.value,mana-f.record.bb.skill_cost_min_sp);
  assert.equal(f.u.skill.gainSp(10,'gift'),0); finish(f);
  assert.equal(f.bursts.length,1); assert.equal(f.wallet.value,mana-8);
  assert.equal(f.u.skill.activations,1); assert.equal(f.marks.length,1); assert.equal(f.ends.length,1);
  assert.equal(f.controller.marker,null); assert.equal(f.wallet.completedExtraChant,false);
  assert.equal(skillHud(f.u.skill).ready,true);
  for(let i=1;i<f.bursts.length;i++)assert.ok(Math.abs(f.bursts[i].time-f.bursts[0].time-i*.45)<f.b.dt+1e-9);
});

test('the complete automatic extra window precedes the diagnostic volley without unlocking mana recovery',()=>{
  const f=make(); extra(f); const began=f.b.time, mana=f.wallet.value;
  assert.equal(f.controller.phase.deadline-f.controller.phase.nextCheck>0,true);
  advance(f,9.5); assert.equal(f.controller.mode,'s3-extra'); assert.equal(f.wallet.value,mana);
  until(f,()=>f.controller.mode==='s3-volley',1); assert.ok(f.b.time-began>=9.9);
  until(f,()=>f.controller.mode==='s3-recovery'); assert.equal(f.u.skill.active,true);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_End'); assert.equal(f.u.skill.gainSp(10,'gift'),0);
  finish(f); assert.equal(f.wallet.value,1); assert.equal(f.u.skill.gainSp(10,'gift'),10);
});

test('affected highland tiles each centre x-4 stun, including enemies outside x-1 damage, in all facings',()=>{
  for(const dir of ['RIGHT','UP','LEFT','DOWN']) {
    const f=make({dir}); f.u.skill.setSpTotal(8); release(f);
    high(f); high(f,0,2);
    const middle=at(f), diamond=at(f,0,2), outside=at(f,2,2), remote=at(f,0,3);
    until(f,()=>f.bursts.length===1);
    assert.equal(f.hits.length,2); assert.ok(f.hits.some(h=>h.target===middle)); assert.ok(f.hits.some(h=>h.target===diamond));
    assert.ok(middle.findBuff('stun')); assert.ok(diamond.findBuff('stun')); assert.equal(outside.findBuff('stun'),null);
    assert.ok(remote.findBuff('stun')); assert.equal(remote.hp,remote.s.maxHp);
    assert.equal(f.bursts[0].highTiles.length,2);
    assert.equal(outside.hp,outside.s.maxHp); assert.equal(f.wallet.value,0); finish(f);
    assert.equal(f.u.mem.regularVisualDirection,['UP','LEFT'].includes(dir)?'UP':'RIGHT');
  }
});

test('the centre stays two forward tiles independent of base range, and shrinks at every stage edge',()=>{
  for(const dir of ['RIGHT','UP','LEFT','DOWN']) for(const distance of [0,1,2]) {
    const f=make({dir}), R=f.b.grid.rect;
    if(dir==='RIGHT') f.u.tileC=R.c1-distance;
    if(dir==='LEFT') f.u.tileC=R.c0+distance;
    if(dir==='UP') f.u.tileR=R.r1-distance;
    if(dir==='DOWN') f.u.tileR=R.r0+distance;
    const [dr,dc]=rotateOffset(0,distance,dir);
    const expected={row:f.u.tileR+dr,col:f.u.tileC+dc,dir};
    f.controller.record={...f.record,rangeGrid:[[0,0],[0,7]]};
    f.b.addBuff(f.u,{key:'fixture:range',mods:{rangeExtend:4}});
    assert.deepEqual(f.controller.centre(),expected); extra(f);
    assert.deepEqual(f.controller.marker,expected);
    f.u.dir=dir==='RIGHT'?'LEFT':'RIGHT'; assert.deepEqual(f.controller.marker,expected);
  }
});

test('S3 rejects sub-minimum mana without starting a chant or spending resources',()=>{
  for(const value of [0,1,7,7.99]) {
    const f=make(); born(f); f.u.skill.setSpTotal(value);
    assert.equal(f.u.skill.activate('manual'),false); assert.equal(skillHud(f.u.skill).ready,false);
    advance(f,2); assert.equal(f.wallet.value,value); assert.equal(f.bursts.length,0);
    assert.equal(f.u.skill.activations,0); assert.equal(f.wallet.completedExtraChant,false);
    assert.equal(f.controller.marker,null);
  }
});

test('dropping below the initial threshold during extra chant ends it without a later volley',()=>{
  const f=make(); f.u.skill.setSpTotal(8); extra(f); assert.ok(f.mana.controller.consume(1));
  until(f,()=>!f.controller.isChanting(),1); advance(f,15);
  assert.equal(f.bursts.length,0); assert.equal(f.wallet.value,7); assert.equal(f.wallet.completedExtraChant,false);
});

test('the final burst captures mana-boosted ATK before zero removes the talent modifier',()=>{
  const f=make(); f.u.skill.setSpTotal(8); release(f); const atk=f.u.s.atk; at(f);
  until(f,()=>f.bursts.length===1); assert.equal(f.wallet.value,0);
  near(f.bursts[0].amount,atk*f.record.bb.atk_scale); assert.equal(f.u.findBuff('marcil:mana-atk'),null);
});

test('each repeat samples current ATK instead of caching the first explosion',()=>{
  const f=make(); f.u.skill.setSpTotal(24); completeExtra(f); at(f);
  until(f,()=>f.bursts.length===1); const first=f.bursts[0].amount;
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});
  until(f,()=>f.bursts.length===2); near(f.bursts[1].amount-first,f.u.base.atk*f.record.bb.atk_scale);
});

test('no enemy is required and an empty area still spends the selected tile-cast mana',()=>{
  const f=make(); f.u.skill.setSpTotal(17); completeExtra(f); finish(f);
  assert.equal(f.bursts.length,2); assert.equal(f.hits.length,0); assert.equal(f.wallet.value,1);
  assert.ok(f.bursts.every(x=>x.victims.length===0&&x.terrainImplemented===false));
});

test('area selection handles flying/camouflage, excludes stealth/sleep and honors stun immunity',()=>{
  const f=make(); f.u.skill.setSpTotal(8); release(f); high(f);
  const aerial=at(f,0,0,{fly:true}), camo=at(f,0,1,{flags:{camou:true}});
  const stealth=at(f,1,0,{flags:{stealth:true}}), sleep=at(f,-1,0), immune=at(f,1,1);
  f.b.applyStatus(sleep,'sleep',{duration:20});
  immune.def={...immune.def,immune:new Set([...immune.def.immune,'stun'])}; immune.markDirty();
  until(f,()=>f.bursts.length===1);
  assert.equal(f.hits.length,3); assert.ok(aerial.findBuff('stun')); assert.ok(camo.findBuff('stun'));
  assert.equal(immune.findBuff('stun'),null); assert.equal(stealth.hp,stealth.s.maxHp); assert.equal(sleep.hp,sleep.s.maxHp);
});

test('S3 selects highland tiles for fragments without changing terrain',()=>{
  const f=make(); f.u.skill.setSpTotal(8); release(f);
  const {row,col}=f.controller.marker; const tile=f.b.grid.tile(row,col); tile.height='HIGH';
  const before=structuredClone(f.b.grid.tiles); at(f); finish(f);
  assert.deepEqual(f.b.grid.tiles,before); assert.equal(f.bursts[0].terrainImplemented,false);
});

test('departure clears mana only after natural extra completion, through volley and recovery',()=>{
  for(const phase of ['main','extra','manual-release','natural-release','recovery'])for(const reason of ['killed','retreat']) {
    const f=make();
    if(phase==='main') assert.equal(beginManual(f),true);
    else if(phase==='natural-release'||phase==='recovery') {
      if(phase==='recovery') f.u.skill.setSpTotal(17);
      completeExtra(f);
      if(phase==='recovery') until(f,()=>f.controller.mode==='s3-recovery');
    } else { extra(f); if(phase==='manual-release') assert.equal(f.controller.cancel(),true); }
    const before=f.wallet.value, count=f.bursts.length, clears=['natural-release','recovery'].includes(phase);
    assert.equal(f.wallet.completedExtraChant,clears);
    if(reason==='retreat') f.b.retreat(f.u,{permanent:true}); else f.b.kill(f.u);
    assert.equal(f.wallet.value,clears?0:before);
    assert.equal(f.controller.stopped,true); assert.equal(f.controller.marker,null); assert.equal(f.wallet.completedExtraChant,false);
    const next=f.create(); assert.equal(next.wallet,f.wallet); assert.equal(next.u.skill.spTotal,f.wallet.value);
    advance(f,1); assert.equal(f.bursts.length,count);
  }
});

test('control ends each incomplete phase, and silence alone leaves the unsilenceable cast running',()=>{
  for(const phase of ['main','extra','volley']) {
    const f=make(); if(phase==='main') assert.equal(beginManual(f),true);
    else { extra(f); if(phase==='volley') f.controller.cancel(); }
    f.b.applyStatus(f.u,'silence',{duration:2}); advance(f,.1); assert.equal(f.u.skill.active,phase==='volley');
    assert.equal(f.controller.isChanting(),phase!=='volley');
    f.b.applyStatus(f.u,'stun',{duration:2}); advance(f,.1);
    assert.equal(f.u.skill.active,false); assert.equal(f.wallet.completedExtraChant,false); assert.equal(f.controller.marker,null);
    assert.equal(f.bursts.length,0);
  }
});

test('hiding the extra-phase owner removes its marker and clears the death-clear mark without spending mana',()=>{
  const f=make(); extra(f); const mana=f.wallet.value; f.u.hidden=true; advance(f,.1);
  assert.equal(f.u.skill.active,false); assert.equal(f.wallet.completedExtraChant,false); assert.equal(f.controller.marker,null);
  f.u.hidden=false; f.b.kill(f.u); assert.equal(f.wallet.value,mana); advance(f,15); assert.equal(f.bursts.length,0);
});

test('a changed deployment epoch cannot release the old marker or cancel a later life',()=>{
  const f=make(); extra(f); const cancel=f.controller.cancel.bind(f.controller); const end=f.u.skill.end;
  f.b.retreat(f.u,{permanent:true}); const next=f.create();
  assert.equal(cancel(),false); assert.equal(end('manual'),false);
  assert.equal(next.u.skill.active,false); assert.equal(next.controller.marker,null);
  advance(f,20); assert.equal(f.bursts.length,0);
});

test('real Senshi meals recover mana during extra chant but remain locked during volley recovery',()=>{
  for(const phase of ['extra','recovery']) {
    const f=make(); if(phase==='recovery') f.u.skill.setSpTotal(8); extra(f);
    const senshi=f.b.deployOperator('char_4143_sensi',5,5,'RIGHT'); senshi.atkCd=1000; senshi.skill.rule='NEVER';
    senshi.skill.setSpTotal(senshi.skill.spCost); assert.equal(senshi.skill.activate('fixture'),true);
    const cooking=senshi.mem.senshiCooking;
    if(phase==='recovery') {
      advance(f,cooking.hit-.9); assert.equal(f.controller.cancel(),true);
      until(f,()=>f.controller.mode==='s3-recovery');
    }
    const mana=f.wallet.value; until(f,()=>cooking.released,10);
    assert.equal(f.wallet.value,phase==='extra'?mana+10:mana);
    assert.equal(f.u.skill.active,phase==='recovery');
    assert.equal(f.controller.mode,`s3-${phase}`);
  }
});

test('a naturally recovered full off-field wallet yields ten bursts without an invented on-field recharge',()=>{
  const f=make({deferred:true}); advance(f,16); assert.equal(f.wallet.value,80);
  assert.ok(f.b._deploy(f.u,{initial:false})); completeExtra(f); finish(f);
  assert.equal(f.bursts.length,10); assert.equal(f.wallet.value,0); advance(f,10); assert.equal(f.wallet.value,0);
});

test('S3 cannot replace the deployment animation, then releases on its original Attack event',()=>{
  const f=make(); at(f); assert.equal(f.controller.phase.kind,'born');
  assert.equal(f.u.skill.activate('manual'),false); assert.equal(f.u.mem.regularFormVisual.clip,'Start');
  advance(f,.9); assert.equal(f.u.skill.activate('manual'),false); assert.equal(f.outputs.length,0);
  assert.equal(f.marks.length,0); born(f); assert.equal(f.u.skill.activate('manual'),true);
  until(f,()=>f.controller.mode==='s3-extra',7); const releasedAt=f.b.time;
  f.controller.cancel(); until(f,()=>f.bursts.length===1);
  const nativeRelease=evidence.models[ID].Front.eventPayloads.Skill_3_Attack[0].time;
  assert.ok(f.bursts[0].time>=releasedAt+nativeRelease-1e-9);
  assert.ok(f.bursts[0].time<=releasedAt+nativeRelease+f.b.dt+1e-9);
});

test('retirement from a marker or extra-phase callback cannot leave a marker, scheduled volley or stale wallet owner',()=>{
  for(const event of ['marcilExplosionMarker','marcilExtraChant']) {
    const f=make(); f.b.on(event,x=>{if(x.unit===f.u)f.b.retreat(f.u,{permanent:true});});
    assert.equal(beginManual(f),true); until(f,()=>f.controller.stopped,8);
    assert.equal(f.controller.marker,null); assert.equal(f.wallet.owner,null); assert.equal(f.wallet.completedExtraChant,false);
    assert.equal(f.ends.length,1); advance(f,20); assert.equal(f.bursts.length,0);
  }
});

test('a rejection in the shared stun pipeline does not undo the explosion damage or create an immunity bypass',()=>{
  const f=make(); f.u.skill.setSpTotal(8); release(f); high(f); const target=at(f);
  f.b.on('beforeBuff',x=>{if(x.unit===target&&x.buff?.key==='stun')x.cancel=true;});
  until(f,()=>f.bursts.length===1); assert.equal(f.hits.length,1); assert.equal(target.findBuff('stun'),null);
  assert.equal(f.wallet.value,0);
});

test('a callback retiring the owner at the last mana debit prevents the output group',()=>{
  const f=make(); f.u.skill.setSpTotal(8); release(f); at(f);
  f.u.findBuff('marcil:mana-atk').onRemove=()=>f.b.retreat(f.u,{permanent:true});
  until(f,()=>f.controller.stopped); assert.equal(f.wallet.value,0); assert.equal(f.hits.length,0); assert.equal(f.bursts.length,0);
});

test('retirement or battle finish inside damage stops remaining recipients, stun and repeat dispatch',()=>{
  for(const action of ['retreat','finish']) {
    const f=make(); release(f); at(f); const second=at(f,0,1);
    f.b.on('damaged',x=>{if(x.source===f.u) action==='retreat'?f.b.retreat(f.u,{permanent:true}):f.b.forceEnd('fixture');});
    until(f,()=>f.controller.stopped);
    assert.equal(f.hits.length,1); assert.equal(second.hp,second.s.maxHp); assert.equal(second.findBuff('stun'),null);
    assert.equal(f.bursts.length,0); assert.equal(f.controller.marker,null); const count=f.hits.length;
    advance(f,20); assert.equal(f.hits.length,count);
  }
});

test('a replacement recipient life cannot inherit a queued damage or stun from the previous life',()=>{
  const f=make(); f.u.skill.setSpTotal(8); release(f); const first=at(f), second=at(f,0,1);
  f.b.on('damaged',x=>{if(x.target===first) second.deploySeq++;});
  until(f,()=>f.bursts.length===1);
  assert.equal(f.hits.length,1); assert.equal(second.hp,second.s.maxHp); assert.equal(second.findBuff('stun'),null);
});

test('battle finish in main/extra/release/recovery retires the marker and denies all retained commands',()=>{
  for(const phase of ['main','extra','release','recovery']) {
    const f=make();
    if(phase==='main') assert.equal(beginManual(f),true);
    else { extra(f); if(phase!=='extra') f.controller.cancel(); if(phase==='recovery') until(f,()=>f.controller.mode==='s3-recovery'); }
    const activate=f.u.skill.activate, end=f.u.skill.end; f.b.forceEnd('fixture');
    assert.equal(f.controller.stopped,true); assert.equal(f.wallet.closed,true); assert.equal(f.controller.marker,null);
    assert.equal(f.u.skill.active,false); assert.equal(activate('manual'),false); assert.equal(end('manual'),false);
    const n=f.bursts.length; advance(f,30); assert.equal(f.bursts.length,n);
  }
});

test('lowland-only blasts cause damage without stun, and highland outside the blast adds no fragment area',()=>{
  const f=make(); f.u.skill.setSpTotal(8); release(f); high(f,0,3);
  const target=at(f), remote=at(f,0,3); finish(f);
  assert.equal(f.hits.length,1); assert.equal(target.findBuff('stun'),null);
  assert.equal(remote.findBuff('stun'),null); assert.equal(remote.hp,remote.s.maxHp);
  assert.deepEqual(f.bursts[0].highTiles,[]); assert.deepEqual(f.bursts[0].stunKeys,[]);
});

test('overlapping fragment areas apply only one stun per recipient and sample current tile height',()=>{
  const f=make(); f.u.skill.setSpTotal(24); completeExtra(f); high(f); high(f,0,1);
  const target=at(f,0,1), statuses=[];
  f.b.on('beforeBuff',x=>{if(x.unit===target&&x.buff?.key==='stun')statuses.push(x);});
  until(f,()=>f.bursts.length===1); assert.equal(statuses.length,1);
  assert.equal(f.bursts[0].highTiles.length,2);
  high(f); const centre=f.controller.marker;
  f.b.grid.tile(centre.row,centre.col).height='LOW';
  f.b.grid.tile(centre.row,centre.col+1).height='LOW';
  until(f,()=>f.bursts.length===2); assert.equal(statuses.length,1);
  assert.deepEqual(f.bursts[1].highTiles,[]);
});

for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank} naturally completes extra chant and spends all affordable groups`,()=>{
  const f=make({rank}), mana=f.wallet.value; completeExtra(f);
  assert.equal(f.wallet.completedExtraChant,true); finish(f);
  assert.equal(f.bursts.length,Math.floor(mana/8)); assert.equal(f.wallet.value,mana%8);
  assert.equal(f.wallet.completedExtraChant,false);
  for(let i=1;i<f.bursts.length;i++)assert.ok(Math.abs(f.bursts[i].time-f.bursts[0].time-i*.45)<f.b.dt+1e-9);
});
