// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };
import review from '../data/arkpedia-muelsyse-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, catalogueFor, recordFor } from '../shared/arkpedia/loadout.js';
import { selectedMuelsyseBuild, MUELSYSE_ID as ID } from '../server/sim/content/arkpedia-muelsyse.js';
import { deployRegularSummon, retreatRegularSummon } from '../server/sim/content/arkpedia-summons.js';
import { summonUnitId, regularTokenIdsFor } from '../shared/arkpedia/summons.js';
import { FlowingShapeCopyInteraction as Copy } from '../public/arkpedia/muelsyse-copy.js';
const TOKEN='token_10030_mlyss_wtrman', CARD=`summon:${ID}`, MELEE='char_208_melan', RANGED='char_103_angel';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function advance(b,s){for(let n=0;n<Math.ceil(s/b.dt-1e-9);n++)b.step();assert.deepEqual(b.errors,[]);}
function until(b,p,s=110){const end=b.time+s;while(!p()&&b.time<end)advance(b,b.dt);assert.ok(p(),`Missing condition at ${b.time}`);}
function make({skill=1,rank=10,elite=2,potential=1,trust=0,level,support=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(d.operators[ID]),skillId:`skchr_mlyss_${skill}`,skillRank:rank,elite,
  level:level??d.operators[ID].phases[elite].maxLevel,potential,trust};
 const donors=[MELEE,RANGED,'char_108_silent'].map(id=>defaultBuild(d.operators[id]));
 const b=new StandardBattle(d,support?{operators:donors,support:build}:{operators:[build,...donors]});
 b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=999;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 return{b,build:b.bench[ID].build};
}
function enemy(b,row=5,col=7){const t=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e7;b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,unblockable:true}});b._buildEnemyIndex();return t;}
function deploy(b,dir='RIGHT',row=5,col=5){const quoted=b.cost(ID),before=b.dp,u=b.deployOperator(ID,row,col,dir);near(before-b.dp,quoted);return u;}
function point(b,u,row=5,col=6){const slots=b.deployedSlots(),dp=b.dp,t=deployRegularSummon(b,CARD,row,col,'RIGHT');near(b.dp,dp);assert.equal(b.deployedSlots(),slots);until(b,()=>t.mem.muelsyseMode===1);assert.equal(t.ownerUnit,u);return t;}
function copy(b,u,t,id=MELEE,dir='RIGHT'){
 until(b,()=>t.skill.ready);const d=u.mem.muelsyseController.devices,entry={...d.state,unit:t};
 const c=Copy.open(entry);assert.ok(c.active);const dp=b.dp,slots=b.deployedSlots();c.choose(id);assert.equal(c.confirm(dir),true);
 until(b,()=>[2,3].includes(t.mem.muelsyseMode));near(b.dp,dp);assert.equal(b.deployedSlots(),slots);assert.equal(b.bench[id].unit,null);return d.tokens.get(t);
}

test('public review binds immutable foundation, donor table and delivered original owner/Flowing Shape art',async()=>{
 for(const[name,key]of[['prefabs','sourceFoundationSha256'],['device-art','deviceArtworkSha256'],['copy-source','donorSourceSha256']]){
  const bytes=await readFile(new URL(`../data/arkpedia-muelsyse-${name}.json`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),review[key]);
 }
 assert.deepEqual(evidence.enabledOperators,[]);assert.deepEqual(review.enabledOperators,[ID]);
 for(const key of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(review[key],false);
 assert.equal(evidence.source.commit,data.sources[evidence.source.repository]);
 assert.deepEqual(catalogueFor(data)[ID].modules,[]);assert.deepEqual(catalogueFor(data)[ID].skills.map(s=>s.unlockElite),[0,1,2]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 assert.ok(regularTokenIdsFor([ID]).includes(TOKEN));assert.ok(data.tokens[TOKEN]);
 for(const patch of[{elite:0,skillId:'skchr_mlyss_2'},{elite:1,skillId:'skchr_mlyss_3'},{module:'TAC-X'}])assert.throws(()=>recordFor({...defaultBuild(data.operators[ID]),level:1,...patch},data));
});
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)for(const donor of[MELEE,RANGED])
 test(`public Muelsyse S${skill} rank ${rank} ${donor}: natural copy, owner/form combat and cleanup`,()=>{
  const{b,build}=make({skill,rank}),r=selectedMuelsyseBuild(build),u=deploy(b),t=point(b,u),s=copy(b,u,t,donor);
  const c=u.mem.muelsyseController;near(u.base.atk,r.stats.atk);assert.equal(c.record.index,skill-1);
  const donorDef=b.data.getChess(donor);for(const k of['maxHp','atk','def','res'])near(t.base[k],donorDef.stats[k]*.9);
  const victim=enemy(b);const hits=[];b.on('damaged',h=>hits.push(h));until(b,()=>u.skill.ready,45);
  b.getPlayer('arkpedia').dp=20;const dp=b.dp,at=b.time;assert.equal(b.activateOperator(ID),true);assert.equal(u.skill.activations,1);
  if(skill!==1)near(b.dp,dp+r.bb.cost);assert.equal(c.skills.parents.has(s),true);
  near(t.s.atk,t.base.atk*(1+r.bb.atk)+(s.copy.ranged?0:s.stolenAtk));assert.equal(c.skills.canCopy(s),false);
  if(skill===2&&donor===RANGED)assert.equal(s.mode,4);if(skill===3&&donor===MELEE)assert.equal(s.mode,5);
  if(skill===3&&donor===RANGED){assert.ok(c.devices.tokens.size>1);for(const v of c.devices.tokens.values())assert.equal(v.unit.deploymentSlotCost,0);}
  until(b,()=>hits.some(h=>h.source===u&&h.dmg.tags.includes(`muelsyse:s${skill}`)),5);
  until(b,()=>hits.some(h=>h.source===t),5);assert.ok(victim.hp<victim.s.maxHp);
  until(b,()=>!u.skill.active,18);assert.ok(b.time>=at+15-1e-9);
  if(skill===1)near(b.dp,dp+Math.floor((15+1e-9)/r.bb['mlyss_s_1[cost].interval']));
  assert.equal(c.skills.parents.size,0);assert.equal(c.skills.forms.size,0);assert.equal(s.mode,donor===MELEE?2:3);
  retreatRegularSummon(b,summonUnitId(t));assert.equal(s.mode,0);assert.equal(t.skill.spTotal,0);
  until(b,()=>[2,3].includes(s.mode),30);assert.equal(s.copy.donorId,donor);
  b.retreatOperator(ID);assert.equal(c.stopped,true);assert.equal(c.devices.tokens.size,0);assert.equal(c.devices.handles.length,0);assert.equal(c.skills.parents.size,0);assert.equal(b.regularSummons.has(CARD),false);
  advance(b,80);const fresh=deploy(b);assert.notEqual(fresh,u);assert.equal(fresh.mem.muelsyseController.devices.stock,1);assert.equal(u.alive,false);b.forceEnd('fixture');
 });
for(const elite of[0,1,2])for(let potential=1;potential<=6;potential++)
 test(`public E${elite} potential ${potential} applies source stats and shared Rhine first-deployment cost`,()=>{
  const{b,build}=make({elite,potential,rank:1,trust:200,level:1}),r=selectedMuelsyseBuild(build),first=b.cost(ID),u=deploy(b);
  near(u.base.atk,r.stats.atk);near(u.base.def,r.stats.def);near(u.base.cost,r.stats.cost);
  near(first,r.stats.cost-(elite===2?2+(potential>=5?2:1):0));assert.equal(b._muelsyseSquad.firstUsed,true);
  const silence=b.data.getChess('char_108_silent').stats.cost;near(b.cost('char_108_silent'),silence-(elite===2?2:0));
  b.retreatOperator(ID);near(b.cost(ID),Math.floor(r.stats.cost*1.5)-(elite===2?2:0));b.forceEnd('fixture');
 });
for(const skill of[1,2,3])
 test(`public S${skill} support is fully maxed, applies Rhine cost once and copies the regular squad`,()=>{
  const{b,build}=make({skill,elite:skill-1,rank:1,potential:1,trust:0,level:1,support:true});
  assert.equal(build.elite,2);assert.equal(build.potential,6);assert.equal(build.skillRank,10);assert.equal(build.trust,200);
  assert.equal(build.skillId,`skchr_mlyss_${skill}`);const r=selectedMuelsyseBuild(build),u=deploy(b);near(u.base.cost,r.stats.cost);
  assert.equal(b._muelsyseSquad.firstUsed,true);const t=point(b,u),s=copy(b,u,t,RANGED);assert.equal(s.copy.donorId,RANGED);
  b.forceEnd('fixture');assert.equal(u.mem.muelsyseController.devices.tokens.size,0);
 });
for(const[dir,row,col]of[['RIGHT',5,6],['UP',6,5],['LEFT',5,4],['DOWN',4,5]])
 test(`public ${dir} owner and copy require separate legal placement/confirmation`,()=>{
  const{b}=make(),dp=b.dp;b.setViewport('preview');assert.throws(()=>deploy(b,dir));near(b.dp,dp);b.setViewport('fullscreen-workspace');
  assert.throws(()=>deploy(b,'DIAGONAL'));assert.equal(b._muelsyseSquad.firstUsed,false);const u=deploy(b,dir),t=point(b,u,row,col);
  const s=copy(b,u,t,MELEE,dir);assert.equal(t.dir,dir);assert.equal(s.copy.dir,dir);assert.throws(()=>u.mem.muelsyseController.devices.place(row,col));b.forceEnd('fixture');
 });
for(const skill of[1,2,3])for(const donor of[MELEE,RANGED])
 test(`public S${skill} ${donor} clears unchanged 0-1 with normal DP, legal point and natural copying`,()=>{
  const build={...defaultBuild(data.operators[ID]),skillId:`skchr_mlyss_${skill}`};
  const b=new StandardBattle(data,{operators:[build,defaultBuild(data.operators[donor])]});b.setViewport('fullscreen-workspace');
  let u,t,copied=false,cast=false;const hits=[];b.on('damaged',h=>hits.push(h));
  for(let n=0;n<9001&&!b.finished;n++){
   if(!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,4,4,'DOWN');
   if(u&&!t)t=deployRegularSummon(b,CARD,3,3,'LEFT');
   if(t?.skill.ready&&!copied&&t.mem.muelsyseMode===1){const d=u.mem.muelsyseController.devices;const c=Copy.open({...d.state,unit:t});if(c){c.choose(donor);copied=c.confirm('LEFT');}}
   if(copied&&u.skill.ready&&!cast&&b.time>=45)cast=b.activateOperator(ID);
   b.step();
  }
  assert.equal(copied,true);assert.equal(cast,true);assert.equal(b.finished,true);const result=b.result();assert.equal(result.reason,'cleared');
  const leaks=result.perPlayer.arkpedia.leaked.filter(x=>x.counted).length;assert.equal(result.total,11);assert.equal(result.killed+leaks,11);assert.equal(b.life,data.stage.battle.max_life-leaks);
  assert.ok(hits.some(h=>h.source===u&&h.dmg.tags.includes(`muelsyse:s${skill}`)));assert.ok(hits.some(h=>h.source===t));assert.deepEqual(b.errors,[]);assert.equal(u.mem.muelsyseController.stopped,true);
 });
