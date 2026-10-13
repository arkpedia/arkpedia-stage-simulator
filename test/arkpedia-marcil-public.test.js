// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import review from '../data/arkpedia-marcil-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { catalogueFor, defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { selectedMarcilBuild, MARCIL_ID as ID } from '../server/sim/content/arkpedia-marcil-source.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const PARTY = ['char_4142_laios', 'char_4143_sensi', 'char_4144_chilc'];
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-5, `${a} != ${b}`);
function advance(b,s) { for(let n=0;n<Math.ceil(s/b.dt-1e-9);n++)b.step(); assert.deepEqual(b.errors,[]); }
function until(b,p,s=30) { const end=b.time+s;while(!p()&&b.time<end)advance(b,b.dt);assert.ok(p(),`Condition missing at ${b.time}`); }
function make({skill=1,rank=10,elite=2,potential=1,trust=0,level,support=false,members=[]}={}) {
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;
  d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const build={...defaultBuild(d.operators[ID]),elite,level:level??d.operators[ID].phases[elite].maxLevel,
    potential,trust,skillId:`skchr_marcil_${skill}`,skillRank:rank};
  const others=members.map(id=>defaultBuild(d.operators[id]));
  const b=new StandardBattle(d,support?{operators:others.length?others:[defaultBuild(d.operators.char_208_melan)],support:build}
    :{operators:[build,...others]});
  b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=999;
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  return {b,build:b.bench[ID].build,wallet:b._marcilManaWallets.get('arkpedia:'+ID)};
}
function enemy(b,row=5,col=7) {
  const t=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e7;
  b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,unblockable:true}});b._buildEnemyIndex();return t;
}
function begin(b,u,skill) {
  until(b,()=>b.time>u.mem.marcilAttacks.bornUntil,2);
  if(skill!==2)assert.equal(b.activateOperator(ID),true);
  assert.equal(u.mem.marcilAttacks.isChanting(),true);assert.equal(u.skill.active,false);
}
test('public Marcille review binds unchanged source evidence, all skills, original models and no modules',async()=>{
  const bytes=await readFile(new URL('../data/arkpedia-marcil-prefabs.json',import.meta.url));
  assert.equal(review.sourceFoundationSha256,createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(review.enabledOperators,[ID]);assert.deepEqual(evidence.enabledOperators,[]);
  assert.equal(evidence.source.commit,data.sources[evidence.source.repository]);
  for(const key of ['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(review[key],false);
  const c=catalogueFor(data)[ID];assert.deepEqual(c.skills.map(s=>s.id),[1,2,3].map(n=>`skchr_marcil_${n}`));
  assert.deepEqual(c.skills.map(s=>s.unlockElite),[0,1,2]);assert.deepEqual(c.modules,[]);
  for(const patch of [{elite:0,skillId:'skchr_marcil_2'},{elite:1,skillId:'skchr_marcil_3'},{module:'SPC-Y'}])
    assert.throws(()=>recordFor({...defaultBuild(data.operators[ID]),level:1,...patch},data));
  for(const face of ['front','back'])assert.equal(data.sd.models[`operator/${ID}/default/${face}`].skeleton.sha256,review.originalSkeletonSha256[face]);
});
for(const skill of [1,2,3])for(let rank=1;rank<=10;rank++)
  test(`public Marcille S${skill} rank ${rank}: source selection, legal deployment, chant, output and cleanup`,()=>{
    const {b,build,wallet}=make({skill,rank}),r=selectedMarcilBuild(build),dp=b.dp,cost=b.cost(ID);
    const u=b.deployOperator(ID,5,6,'RIGHT'),c=u.mem.marcilAttacks;near(b.dp,dp-cost);near(u.base.atk,r.stats.atk);
    assert.equal(c.record.index,skill-1);assert.equal(wallet.value,r.mana.initial);
    assert.equal(b.activateOperator(ID),false);const hits=[];b.on('damaged',x=>{if(x.source===u)hits.push(x);});
    enemy(b);begin(b,u,skill);assert.equal(skillHud(u.skill).ready,false);
    if(skill===3){until(b,()=>c.mode==='s3-extra',8);assert.equal(b.activateOperator(ID),true);}
    else until(b,()=>u.skill.active,20);
    assert.equal(u.skill.activations,1);until(b,()=>hits.some(h=>h.dmg.tags.includes(`marcil:s${skill}`)),8);
    assert.equal(u.skill.gainSp(10,'gift'),0);
    if(skill===1)near(wallet.value,r.mana.initial-r.bb.sp_cost);
    if(skill===2)near(wallet.value,r.mana.initial-35);
    if(skill===3)near(wallet.value,r.mana.initial-8);
    const mana=wallet.value;b.retreatOperator(ID);assert.equal(wallet.value,mana);
    assert.equal(c.stopped,true);assert.equal(u.skill.active,false);assert.deepEqual(c.handles,[]);
    assert.equal(wallet.owner,null);assert.equal(wallet.claimed,null);assert.equal(u.findBuff(`marcil:s${skill}`),null);
    b.forceEnd('fixture');assert.equal(wallet.closed,true);
  });
for(const elite of [0,1,2])for(let potential=1;potential<=6;potential++)
  test(`public Marcille E${elite} potential ${potential} selects trust, level, mana and promotion talents`,()=>{
    const {b,build,wallet}=make({elite,potential,trust:200,level:1,rank:1,members:PARTY}),r=selectedMarcilBuild(build);
    const u=b.deployOperator(ID,5,6,'RIGHT');near(u.base.atk,r.stats.atk);near(u.base.maxHp,r.stats.maxHp);
    near(u.base.cost,r.stats.cost);near(wallet.value,r.mana.initial);
    near(u.s.atk,u.base.atk*(1+r.talentBb[0].atk));
    near(u.s.def,u.base.def*(elite===2?1.35:1));near(u.s.aspd,u.base.aspd+(elite===2?25:0));
    assert.equal(b._marcilParty.enabled,elite===2);b.forceEnd('fixture');
  });
for(const skill of [1,2,3])for(const dir of ['RIGHT','UP','LEFT','DOWN'])
  test(`public S${skill} ${dir} keeps battle-start bench recovery and saved mana through redeployment`,()=>{
    const {b,wallet}=make({skill});advance(b,12.1);near(wallet.value,Math.min(80,wallet.record.mana.initial+12));
    const u=b.deployOperator(ID,5,6,dir),old=u.mem.marcilAttacks;near(u.skill.spTotal,wallet.value);
    assert.equal(wallet.owner,u);const bornMana=wallet.value;advance(b,.2);near(wallet.value,bornMana);
    b.retreatOperator(ID);const before=wallet.value;advance(b,80);near(wallet.value,80);
    const v=b.deployOperator(ID,5,6,dir);assert.notEqual(v,u);assert.equal(v.mem.marcilMana.wallet,wallet);
    assert.equal(old.stopped,true);assert.equal(old.boundActivate('manual'),false);
    assert.equal(v.mem.marcilAttacks.chantRequests,0);assert.equal(v.skill.activations,0);
    assert.equal(v.mem.regularFormVisual.clip,'Start');assert.equal(v.dir,dir);assert.ok(before<=80);
    b.forceEnd('fixture');
  });
test('public party membership includes support and bench while unrelated bodies stay unbuffed',()=>{
  const {b,wallet}=make({support:true,members:PARTY});assert.equal(b._marcilParty.enabled,true);
  assert.equal(b._marcilParty.members.length,4);assert.equal(wallet.owner,null);
  for(let i=0;i<PARTY.length;i++){
    const u=b.deployOperator(PARTY[i],5+i,7,'RIGHT');assert.ok(u.findBuff('marcil:party'));
    near(u.s.aspd,u.base.aspd+25+(u.def.talents.find(t=>t.bb.attack_speed)?.bb.attack_speed??0));
  }
  assert.equal(b.bench[ID].unit,null);b.forceEnd('fixture');
});
test('public commands reject preview placement, invalid facing and unavailable skill without spending resources',()=>{
  const {b,wallet}=make({skill:3}),dp=b.dp,mana=wallet.value;
  b.setViewport('preview');assert.throws(()=>b.deployOperator(ID,5,6,'RIGHT'));near(b.dp,dp);near(wallet.value,mana);
  b.setViewport('fullscreen-workspace');assert.throws(()=>b.deployOperator(ID,5,6,'INVALID'));near(b.dp,dp);
  const u=b.deployOperator(ID,5,6,'RIGHT');assert.equal(b.activateOperator(ID),false);near(wallet.value,mana);
  b.applyStatus(u,'stun',{duration:3});advance(b,1.1);assert.equal(b.activateOperator(ID),false);
  b.forceEnd('fixture');
});
for(const skill of [1,2,3])test(`public S${skill} completes unchanged 0-1 waves with ordinary DP and Kroos`,()=>{
  const build={...defaultBuild(data.operators[ID]),skillId:`skchr_marcil_${skill}`};
  const b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators.char_124_kroos)]});
  b.setViewport('fullscreen-workspace');const hits=[];b.on('damaged',x=>{if(x.source?.defId===ID)hits.push(x);});
  let deployed=false,kroos=false,cast=false,cancelled=false;
  for(let n=0;n<9001&&!b.finished;n++){
    if(!kroos&&b.dp>=b.cost('char_124_kroos')){b.deployOperator('char_124_kroos',2,4,'UP');kroos=true;}
    if(!deployed&&b.dp>=b.cost(ID)){b.deployOperator(ID,4,6,'DOWN');deployed=true;}
    const u=b.bench[ID].unit,c=u?.mem.marcilAttacks;
    if(skill!==2&&!cast&&u&&c.canActivate()&&(skill!==3||b.time>=48))cast=b.activateOperator(ID);
    if(skill===3&&!cancelled&&c?.canCancel())cancelled=b.activateOperator(ID);
    b.step();
  }
  assert.equal(b.finished,true);const result=b.result();assert.equal(result.reason,'cleared');assert.equal(result.total,11);
  const leaks=result.perPlayer.arkpedia.leaked.filter(x=>x.counted).length;
  assert.equal(result.killed+leaks,11);assert.equal(b.life,data.stage.battle.max_life-leaks);
  assert.ok(hits.some(h=>h.dmg.tags.includes(`marcil:s${skill}`)));assert.deepEqual(b.errors,[]);
  assert.equal(b.bench[ID].unit.mem.marcilAttacks.stopped,true);assert.equal(b._marcilParty.closed,true);
});
