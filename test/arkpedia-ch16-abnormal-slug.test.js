// SPDX-License-Identifier: GPL-3.0-or-later
// Direct attachment only: this suite does not grant stage or public admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseSkel } from '../tools/assets/skel.mjs';
import { deriveEnemySupport, prefabPath } from '../shared/arkpedia/enemy-support.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { abnormalSlug } from '../server/sim/content/chapter16-abnormal-slug.js';
import { miner } from '../server/sim/content/chapter16.js';
import { attach, installFeatureDispatch } from '../server/sim/content/enemies.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { verifiedChapter16FamilyGraph, verifiedNative } from '../tools/arkpedia/enemy-support.mjs';
const bytes = p => readFileSync(new URL('../'+p, import.meta.url));
const read = p => JSON.parse(bytes(p));
const records = read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
const review = read('data/candidates/arkpedia-ch16-reviewed-abnormal-slug.json');
const base = 'enemy_10126_rkbomb', mk = 'enemy_3010_mcreep';
function fixture(key = base, {block=0} = {}) {
  const h = makeBattle({ content:'generic', autoFinish:false, setup:installFeatureDispatch,
    defs:{ enemies:Object.fromEntries([key,mk].map(k=>[k,records[k].levels[0]])),
      chess:{dummy:chessRec({id:'dummy',stats:{maxHp:1e6,atk:0,def:0,res:20,blockCnt:block}})} },
    units:[{chessId:'dummy',row:10,col:block?7:5}] });
  h.b.start(); const e=h.spawn(key,{pos:[10,7]}); e.base.moveSpeed=0;e.markDirty();
  const a=abnormalSlug(records[key].levels[0]); attach(h.b,e,[a]);
  for(const k of Object.keys(e.profile.attackCooldowns))e.profile.attackCooldowns[k]=1e6;
  const m=h.spawn(mk,{pos:[10,9]});attach(h.b,m,[miner(records[mk].levels[0])]);
  m.base.moveSpeed=0;m.markDirty();m.atkCd=1e6;
  return {h,b:h.b,e,a,m,u:h.unit('dummy')};
}
const hit=(b,s,t,amount,type='phys')=>b.dealDamage(s,t,{amount,type,isAttack:true,canDodge:false});
test('slug retains checksum-bound original graph and indexed native evidence',()=>{
  for(const p of Object.values(review.sources))assert.equal(createHash('sha256').update(bytes(p.path)).digest('hex'),p.sha256);
  const clock=read('data/arkpedia-enemy-clock-source.json');
  verifiedChapter16FamilyGraph(bytes(review.sources.graph.path),bytes('data/arkpedia-cn-native-source.json'),bytes('data/arkpedia-cn-enemy-native-source.json'),clock);
  verifiedNative(read(review.sources.indexed.path),clock.prefabs,createHash('sha256').update(bytes('data/arkpedia-enemy-clock-source.json')).digest('hex'),read('data/arkpedia-mvp.json').behaviors.source);
});
for(const key of [base,base+'_2'])test(key+': ordinary mitigation, sourceless reduction and true bypass preserve miner pool',()=>{
  const {b,e,a,u}=fixture(key),hp=e.hp,pool=a.pool;
  hit(b,u,e,500);assert.equal(hp-e.hp,200);
  hit(b,null,e,500,'arts');assert.equal(hp-e.hp,400);
  hit(b,u,e,100,'true');assert.equal(hp-e.hp,500);
  assert.equal(a.pool,pool);assert.equal(a.mode,0);assert.equal(e.s.taunt,1);
  assert.equal(1e6-u.hp,320,'two sourced attacks retaliate for 200 Arts through 20 RES');
});
test('miner physical hits deplete a post-mitigation pool and overflow on the breaking hit',()=>{
  const {b,e,a,m,h}=fixture(),hp=e.hp,mhp=m.hp;
  hit(b,m,e,500);assert.equal(a.pool,50);assert.equal(e.hp,hp);assert.equal(mhp-m.hp,200);
  hit(b,m,e,500);assert.equal(a.pool,0);assert.equal(hp-e.hp,350);assert.equal(a.mode,1);
  assert.equal(e.findBuff('rkbomb_m0_t[shield]'),null);assert.equal(e.s.taunt,0);
  assert.ok(a.phase);assert.ok(e.s.flags.disarm);
  h.run(1.04);assert.equal(a.phase,null);assert.equal(!!e.s.flags.disarm,false);
  const before=m.hp;hit(b,m,e,500);assert.equal(hp-e.hp,750);assert.equal(m.hp,before);
  assert.deepEqual(b.errors,[]);
});
test('miner Arts and True bypass both the physical pool and ordinary reduction',()=>{
  const {b,e,a,m}=fixture(),hp=e.hp,pool=a.pool;
  hit(b,m,e,500,'arts');hit(b,m,e,100,'true');
  assert.equal(hp-e.hp,500);assert.equal(a.pool,pool);assert.equal(a.mode,0);
});
test('mode transition is forced, stun immune, interruptible by freeze and never resets mode',()=>{
  const {b,e,a,m,h}=fixture();b.addBuff(e,{key:'fixture-silence',flags:{silence:true},persist:true});
  hit(b,m,e,1000);assert.equal(a.mode,1);assert.ok(a.phase);
  b.applyStatus(e,'stun',.5);assert.equal(e.s.flags.stun,false);
  const buff=b.addBuff(e,{key:'brief-freeze',flags:{freeze:true},persist:true});b.removeBuff(e,buff);
  h.run(.04);assert.equal(a.phase,null);assert.equal(a.mode,1);
});
test('silence does not disable retaliation, and shield dispel retires only its owned mechanics',()=>{
  const {b,e,a,u,h}=fixture();b.addBuff(e,{key:'fixture-silence',flags:{silence:true},persist:true});
  const hp=u.hp;hit(b,u,e,500);assert.equal(hp-u.hp,160);
  b.removeBuff(e,a.shield);h.run(.04);const before=e.hp,uhp=u.hp;
  hit(b,u,e,500);assert.equal(before-e.hp,400);assert.equal(u.hp,uhp);assert.equal(a.mode,0);
  assert.equal(b._takenMultipliers.has(e),false);assert.deepEqual(b.errors,[]);
});
test('shared packets retain per-recipient amounts and never copy slug resistance to another target',()=>{
  const {b,e,u,m}=fixture();const dmg={amount:500,type:'phys',isAttack:true,canDodge:false},hp=m.hp;
  b.dealDamage(u,e,dmg);b.dealDamage(u,m,dmg);assert.equal(hp-m.hp,350);assert.equal(dmg.mul,undefined);
});
test('death and battle end retire owned hooks, multipliers and transition tasks',()=>{
  for(const end of ['death','battleEnd']){
    const {b,e,a,m,h}=fixture();hit(b,m,e,1000);assert.ok(a.phase);
    if(end==='death')b.kill(e,null);else b.emit('battleEnd',{});
    assert.equal(a.phase,null);assert.equal(b._takenMultipliers.has(e),false);
    h.run(2);assert.deepEqual(b.errors,[]);
  }
});
test('canonical mutations fail construction and source artifacts grant no automatic support',()=>{
  const changed=structuredClone(records[base].levels[0]);changed.talents.bb['Shield.value']++;
  assert.throws(()=>abnormalSlug(changed),/Unreviewed/);
  const {e}=fixture();assert.equal(e.mem.ab.list.length,1);
});
test('original shield actions specify source-free retaliation, physical miner pool and forced one-way mode change',()=>{
  const g=read(review.sources.graph.path),t=JSON.parse(g.templates['rkbomb_m0_t[shield]'].originalJson);
  const events=t.eventToActions._items;
  const start=JSON.parse(events.find(e=>e.key===0).value.SerializedState);
  assert.equal(start[0]._attributeType,'MAX_HP');assert.equal(start[1]._multiplyParamKey,'init_shield_hp_ratio');
  const hit=JSON.parse(events.find(e=>e.key===10).value.SerializedState),counter=hit[0]._succeedNodes.find(n=>n.$type.endsWith('+InverseDamage'));
  assert.equal(counter._hasSource,false);assert.equal(counter._filterModifierCancelled,false);assert.equal(counter._damageType,'MAGICAL');assert.equal(counter._fixValue,true);
  const branch=hit[1];assert.deepEqual(branch._conditionNode._buffKeys,['enemy_mcreep_self_mark']);
  assert.equal(branch._succeedNodes[0]._damageMask,'PHYSICAL');assert.equal(branch._succeedNodes[0]._showShieldUI,false);
  assert.equal(branch._succeedNodes[2]._modeIndex,1);assert.equal(branch._succeedNodes[3]._skillName,'M1Start');
  assert.equal(branch._succeedNodes[3]._checkSkillReady,false);assert.equal(branch._succeedNodes[3]._clearPalsyingBuffBeforeTrigger,true);
  assert.equal(branch._failNodes[0]._damageMask,'PHYSICAL_AND_MAGICAL');assert.equal(branch._failNodes[0]._isOneMinus,true);
});
test('one miner link persists in both modes; transition never creates a hostile army mark',()=>{
  const {h,b,e,a,m}=fixture();m.x=7.8;h.run(.34);
  assert.equal(a.engagements.size,1);assert.equal(a.engagement.target,m);assert.equal(e.findBuff('enemy_field_army_self_mark'),null);
  hit(b,m,e,1000);h.run(1.04);assert.equal(a.mode,1);assert.equal(a.engagements.size,1);
  m.x=9;h.run(.34);assert.equal(a.engagements.size,0);assert.equal(m.mem.ch16Engagement,undefined);
});
test('protected attackers receive no counter, while accepted fully shielded hits still retaliate',()=>{
  for(const flag of ['invulnerable','untargetable','sleep']){
    const {b,e,u}=fixture(),hp=u.hp;b.addBuff(u,{key:'protected',persist:true,flags:{[flag]:true}});
    hit(b,u,e,500);assert.equal(u.hp,hp,flag);
  }
  const {b,e,a,m}=fixture(),hp=m.hp;hit(b,m,e,200);assert.equal(e.hp,e.s.maxHp);assert.equal(hp-m.hp,200);assert.equal(a.pool,350);
});

test('retained skeletons bind Trans to one second without granting an art-only death blast',()=>{
  for(const row of Object.values(read(review.sources.animation.path).enemies)){
    const raw=Buffer.from(row.base64,'base64');
    assert.equal(raw.length,row.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),row.sha256);
    assert.equal(createHash('sha256').update(row.skeletonDataOriginalJson).digest('hex'),row.skeletonDataSha256);
    assert.equal(row.prefabBinding.m_PathID,row.skeletonDataPathId);
    const decoded=parseSkel(raw,undefined,{includeExactDurations:true,includeEventPayloads:true});
    assert.equal(decoded.exactDurations.Trans,review.defaults.transitionDuration);
    assert.equal(decoded.eventPayloads.Trans?.length??0,0);
    for(const name of ['A_Attack','B_Attack']){
      assert.equal(decoded.exactDurations[name],2);assert.equal(decoded.eventPayloads[name][0].name,'OnAttack');
      assert.equal(decoded.eventPayloads[name][0].time,.5333333611488342);
    }
  }
});

test('candidate registration installs exactly one slug and rejects missing/altered native or canonical claims',()=>{
  const native=read(review.sources.indexed.path),clock=read('data/arkpedia-enemy-clock-source.json');
  const evidence={...native,chapter16Families:{abnormalSlug:{graphSha256:review.sources.graph.sha256}}};
  for(const key of Object.keys(review.enemies)){
    const entry={[key]:records[key]};assert.equal(deriveEnemySupport(entry,clock.prefabs,evidence)[key].policy,'stats-attacks-and-features');
    assert.equal(deriveEnemySupport(entry,clock.prefabs,native)[key].policy,null);
    const altered=structuredClone(evidence);altered.prefabs[prefabPath(key)][0].originalJson+=' ';
    assert.equal(deriveEnemySupport(entry,clock.prefabs,altered)[key].policy,null);
    const changed=structuredClone(entry);changed[key].levels[0].talents.bb['Shield.value']++;
    assert.equal(deriveEnemySupport(changed,clock.prefabs,evidence)[key].policy,null);
    const h=makeBattle({content:'generic',autoFinish:false,setup:b=>{installFeatureDispatch(b);installEnemyFeatures(b);},defs:{enemies:{[key]:records[key].levels[0]}}});
    h.b.start();const e=h.spawn(key,{pos:[10,7]});assert.equal(e.mem.ab.list.filter(a=>a.changeMode).length,1);
    assert.equal(e.mem.ab.list.length,1);assert.deepEqual(h.b.errors,[]);
  }
});
test('both modes use independent native Attack/Combat clocks and do not schedule M1Start on spawn',()=>{
  const {h,e,a,m}=fixture();m.x=7.8;m.hp=m.s.maxHp;h.run(.1);assert.equal(a.mode,0);assert.equal(a.phase,null);
  e.profile.attackCooldowns.m0Attack=0;const hp=m.hp;h.run(.04);assert.equal(hp-m.hp,150);
  assert.ok(e.profile.attackCooldowns.m0Attack>1.8);assert.ok(e.profile.attackCooldowns.m0Combat>999999);
  // The forced mode switch is permanent and exposes its own ready clock;
  // finishing the clip does not copy the old mode's remaining cooldown.
  a.changeMode();h.run(1.04);e.profile.attackCooldowns.m1Attack=0;const before=m.hp;h.run(.04);
  assert.equal(before-m.hp,150);assert.ok(e.profile.attackCooldowns.m1Attack>1.8);assert.ok(e.profile.attackCooldowns.m1Combat>999998);
  assert.equal(a.mode,1);assert.deepEqual(h.b.errors,[]);
});

test('real operator blocking selects each mode Combat clock without spending the unblocked Attack clock',()=>{
  const {h,e,a,u}=fixture(base,{block:1});h.run(.1);assert.equal(e.blockedBy,u);
  let hp=u.hp;e.profile.attackCooldowns.m0Combat=0;h.run(.04);assert.equal(hp-u.hp,300);
  assert.ok(e.profile.attackCooldowns.m0Combat>1.8);assert.ok(e.profile.attackCooldowns.m0Attack>999999);
  a.changeMode();h.run(1.04);hp=u.hp;e.profile.attackCooldowns.m1Combat=0;h.run(.04);assert.equal(hp-u.hp,300);
  assert.ok(e.profile.attackCooldowns.m1Combat>1.8);assert.ok(e.profile.attackCooldowns.m1Attack>999998);
  assert.deepEqual(h.b.errors,[]);
});
