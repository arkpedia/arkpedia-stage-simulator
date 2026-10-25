// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import data from'../data/arkpedia-mvp.json' with{type:'json'};
import tables from'../data/candidates/arkpedia-stage-predefined-module-tables.json' with{type:'json'};
import native from'../data/candidates/arkpedia-stage-predefined-module-native.json' with{type:'json'};
import{StandardBattle}from'../server/sim/arkpedia.js';
import{normalizeChess}from'../server/sim/simdata.js';
import{defaultBuild,catalogueFor}from'../shared/arkpedia/loadout.js';
import{acquireTargets,effectiveProfile}from'../server/sim/ai.js';
import{mulberryStageBuild,mulberryStageRecord,verifyMulberryStageModule,installMulberryStageModule}from'../server/sim/content/arkpedia-mulberry-stage-module.js';
import{ptilopsisStageBuild,ptilopsisStageRecord}from'../server/sim/content/arkpedia-ptilopsis-stage-module.js';
import{poncirusStageBuild,poncirusStageRecord}from'../server/sim/content/arkpedia-poncirus-stage-module.js';
import{kestrelStageBuild,kestrelStageRecord}from'../server/sim/content/arkpedia-kestrel-stage-module.js';
const ID='char_473_mberry',MED='char_436_whispr',FAN='char_123_fang',build=mulberryStageBuild(),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function advance(b,t){for(let i=0;i<Math.ceil(t/b.dt-1e-8);i++)b.step();assert.deepEqual(b.errors,[]);}
function fixture(){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const b=new StandardBattle(d,{operators:[{...build,module:null},defaultBuild(d.operators[MED]),defaultBuild(d.operators[FAN])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const def=normalizeChess(mulberryStageRecord(build,d)),get=b.data.getChess.bind(b.data);b.data.getChess=(id,...args)=>id===ID?def:get(id,...args);b.bench[ID].build={...build};
 const deploy=(id=ID,row=2,col=4)=>{b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,row,col,'UP');u.atkCd=1000;return u;};
 return{b,def,deploy};
}
function wound(u){u.base.maxHp=1e5;u.markDirty();void u.s;u.hp=100;u.elem.burn=1e4;}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.ok(b.activateOperator(ID));u.atkCd=1000;}
test('the exact hidden S2 module has the selected stats, trait and talent and leaves public selection closed',()=>{
 const r=mulberryStageRecord(build,data);near(r.stats.maxHp,1597);near(r.stats.atk,458);near(r.stats.def,99);near(r.trait.bb.ep_heal_ratio,.6);near(r.talents[0].bb.atk,.15);
 assert.deepEqual(catalogueFor(data)[ID].modules,[]);assert.throws(()=>new StandardBattle(structuredClone(data),{operators:[build]}));
 for(const change of [{level:79},{potential:5},{trust:200},{skillRank:10},{moduleLevel:2},{stage:'17-14'},{skillId:'skchr_mberry_1'}])assert.throws(()=>mulberryStageRecord({...build,...change},data),/Unreviewed/);
});
test('ordinary tracked healing uses the module elemental ratio once and heals HP independently',()=>{
 const f=fixture(),u=f.deploy(),a=f.deploy(FAN,3,4);wound(a);f.b.forceAttack(u,[a]);u.atkCd=1000;advance(f.b,1.5);
 near(a.hp,558);near(a.elem.burn,1e4-458*.6);assert.equal(f.b.projectiles.list.length,0);
});
test('full-HP elemental injury is an ordinary heal target with the module',()=>{
 const f=fixture(),u=f.deploy(),a=f.deploy(FAN,3,4);a.elem.neural=900;assert.ok(acquireTargets(f.b,u,effectiveProfile(u)).includes(a));
 f.b.forceAttack(u,[a]);u.atkCd=1000;advance(f.b,1.5);near(a.hp,a.s.maxHp);near(a.elem.neural,900-458*.6);
});
test('S2 directly heals with the module ratio and retains its native elemental protection',()=>{
 const f=fixture(),u=f.deploy(),a=f.deploy(FAN,3,4);wound(a);cast(f.b,u);near(a.s.elemTakenMul,1-u.def.skill.bb.ep_damage_resistance);
 f.b.forceAttack(u,[a]);near(a.hp,558);near(a.elem.burn,1e4-458*.6);assert.equal(f.b.projectiles.list.length,0);near(u.skill.spTotal,0);
 u.skill.end('fixture');advance(f.b,.1);near(a.s.elemTakenMul,1);
});
test('the global 15 percent Medic aura includes owner and later medics, excluding other professions',()=>{
 const f=fixture(),u=f.deploy();near(u.s.atk,458);const medic=f.deploy(MED,1,2),other=f.deploy(FAN,3,4);
 near(u.s.atk,458*1.15);near(medic.s.atk,medic.base.atk*1.15);near(other.s.atk,other.base.atk);
 f.b.addBuff(medic,{key:'fixture:noheal',flags:{noHeal:true,healFree:true,untargetable:true}});advance(f.b,.1);near(medic.s.atk,medic.base.atk*1.15);
 f.b.addBuff(medic,{key:'fixture:personal',mods:{atkPct:.2}});near(medic.s.atk,medic.base.atk*1.35);f.b.retreatOperator(ID);near(medic.s.atk,medic.base.atk*1.2);
});
test('recipient isolation and loss of the second Medic retract only the owned aura',()=>{
 const f=fixture(),u=f.deploy(),medic=f.deploy(MED,1,2);f.b.addBuff(medic,{key:'fixture:isolate',flags:{isolated:true}});advance(f.b,.1);near(medic.s.atk,medic.base.atk);
 f.b.removeBuff(medic,'fixture:isolate');advance(f.b,.1);near(medic.s.atk,medic.base.atk*1.15);f.b.retreatOperator(MED);near(u.s.atk,458);
});
test('retirement during aura admission cannot leave a late buff or remove personal effects',()=>{
 const f=fixture(),u=f.deploy();f.b.on('beforeBuff',c=>{if(c.unit.defId===MED&&c.buff.key===`mulberry:medic:${u.id}`)f.b.retreat(u,{permanent:true});});
 const medic=f.deploy(MED,1,2);near(medic.s.atk,medic.base.atk);assert.equal(medic.findBuff(`mulberry:medic:${u.id}`),null);assert.deepEqual(f.b.errors,[]);
});
test('replacement source and recipient lifetimes do not inherit old aura admissions',()=>{
 const f=fixture(),u=f.deploy(),medic=f.deploy(MED,1,2);u.deploySeq++;advance(f.b,.1);near(medic.s.atk,medic.base.atk);near(u.s.atk,458);
 const g=fixture(),v=g.deploy();let changed=false;g.b.on('beforeBuff',c=>{if(!changed&&c.unit.defId===MED&&c.buff.source===v){changed=true;c.unit.deploySeq++;}});
 const target=g.deploy(MED,1,2);assert.ok(changed);near(target.s.atk,target.base.atk);advance(g.b,.1);near(target.s.atk,target.base.atk*1.15);
});
test('battle completion cleans Medic aura even while both participants remain alive',()=>{
 const f=fixture(),u=f.deploy(),medic=f.deploy(MED,1,2);f.b.emit('battleEnd',{});near(u.s.atk,458);near(medic.s.atk,medic.base.atk);
});
test('all four exact 17-16 module builds compose through real deployment, SP, Medic aura and S2 healing',()=>{
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const builds=[build,ptilopsisStageBuild(),poncirusStageBuild(),kestrelStageBuild()],records=[mulberryStageRecord,ptilopsisStageRecord,poncirusStageRecord,kestrelStageRecord];
 const b=new StandardBattle(d,{operators:builds.map(r=>({...r,module:null}))});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const defs=new Map(builds.map((r,i)=>[r.id,normalizeChess(records[i](r,d))])),get=b.data.getChess.bind(b.data);b.data.getChess=(id,...args)=>defs.get(id)??get(id,...args);
 for(const r of builds)b.bench[r.id].build={...r};
 const deploy=(id,row,col)=>{b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,row,col,'RIGHT');u.atkCd=1000;return u;};
 const mul=deploy(ID,2,4),pti=deploy('char_128_plosis',2,3),pon=deploy('char_488_buildr',3,4),kes=deploy('char_4023_rfalcn',3,5);
 near(b.bench[kes.defId].lastCost,9);near(mul.s.atk,458*1.15);near(pti.s.atk,437*1.15);
 for(const u of[mul,pti,pon,kes])u.skill.setSpTotal(0);advance(b,1);
 for(const u of[mul,pti,pon,kes])near(u.skill.spTotal,1.35);
 pon.hp=100;pon.elem.burn=900;cast(b,mul);b.forceAttack(mul,[pon]);near(pon.hp,100+458*1.15);near(pon.elem.burn,900-458*1.15*.6);
 b.retreatOperator(pti.defId);advance(b,.1);near(mul.s.atk,458);near(pon.s.spRecovery,1);near(kes.s.spRecovery,1);assert.deepEqual(b.errors,[]);
});
test('module phase, native S1 condition and canonical card mutations are rejected',()=>{
 const t=structuredClone(tables);t.modules.uniequip_002_mberry.phase.parts[0].overrideTraitDataBundle.candidates[0].blackboard[0].value=.7;assert.throws(()=>verifyMulberryStageModule(t,native),/Unreviewed/);
 const card=structuredClone(tables);card.stages['17-16'].predefines.characterCards.find(c=>c.inst.characterKey===ID).skillIndex=0;assert.throws(()=>verifyMulberryStageModule(card,native),/Unreviewed/);
 const n=structuredClone(native),r=n.templates.mberry_e_002_t_10.eventToActions._items[0].value;r.SerializedState=r.SerializedState.replace('"_skillIndex":0','"_skillIndex":1');assert.throws(()=>verifyMulberryStageModule(tables,n),/Unreviewed/);
 const f=fixture();assert.throws(()=>installMulberryStageModule(f.b,{mem:{}},{...f.def,skill:{...f.def.skill,id:'skchr_mberry_1'}}),/Unreviewed/);
});
