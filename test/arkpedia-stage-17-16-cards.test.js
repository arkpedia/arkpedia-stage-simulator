// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import data from'../data/arkpedia-mvp.json' with{type:'json'};
import source from'../data/candidates/arkpedia-predefined-tutorial-source.json' with{type:'json'};
import{DataSource,withUnitLoadouts}from'../server/sim/simdata.js';import{chessRec}from'./helpers/battleHarness.js';
import{StandardBattle}from'../server/sim/arkpedia.js';import{defaultBuild,catalogueFor}from'../shared/arkpedia/loadout.js';
import{installStage17_16Cards}from'../server/sim/content/arkpedia-stage-17-16-cards.js';
import{installViyPredefined,applyViyTutorialSp}from'../server/sim/content/arkpedia-viy-predefined.js';
const M='char_473_mberry',P='char_128_plosis',K='char_4023_rfalcn',V='char_488_buildr',ids=[M,P,K,V],actions=source.actions.filter(r=>r.action.actionType==='ACTIVATE_PREDEFINED').map(r=>r.action);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`),action=id=>actions.find(a=>a.key===id+'#1');
function fixture(extra=[]){const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;const b=new StandardBattle(d,{operators:['char_122_beagle',...extra].map(id=>defaultBuild(d.operators[id]))});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));return{b,d};}
function advance(b,t){for(let n=0;n<Math.ceil(t/b.dt-1e-8);n++)b.step();assert.deepEqual(b.errors,[]);}
test('batch registration clears cached misses, freezes copies and preserves existing identities and caller dictionaries',()=>{
 const raw={a:chessRec({id:'a'})},ds=new DataSource({chess:raw}),other=new DataSource({chess:raw}),old=ds.getChess('a'),r=chessRec({id:'new',stats:{atk:5}});
 assert.equal(ds.getChess('new'),null);const result=ds.registerChessRecords({new:r});assert.equal(ds.getChess('new'),result.get('new'));near(result.get('new').stats.atk,5);
 r.stats.atk=999;near(ds.getChess('new').stats.atk,5);assert.throws(()=>{result.get('new').stats.atk=1;},TypeError);assert.equal(ds.getChess('a'),old);assert.equal(raw.new,undefined);assert.equal(other.getChess('new'),null);
});
test('invalid or conflicting batches cannot partially register or shadow fallback records',()=>{
 const parent=new DataSource({chess:{old:chessRec({id:'old'})}}),ds=new DataSource({},parent);
 assert.throws(()=>ds.registerChessRecords({new:chessRec({id:'new'}),old:chessRec({id:'old'})}),/conflicts/);assert.equal(ds.raw.chess.new,undefined);assert.equal(ds.getChess('new'),null);assert.deepEqual(ds.getChess('old'),parent.getChess('old'));
 for(const records of [{wrong:chessRec({id:'different'})},{'bad|key':chessRec({id:'bad|key'})},null,[]])assert.throws(()=>ds.registerChessRecords(records));
});
test('a loadout view and its underlying data source share newly staged definitions without replacing the getter',()=>{
 const ds=new DataSource({chess:{a:chessRec({id:'a'})}}),view=withUnitLoadouts(ds,[{units:[{chessId:'a',skillIndex:0,moduleId:'none'}]}]),get=view.getChess;
 view.getChess('new');view.registerChessRecords({new:chessRec({id:'new'})});assert.equal(view.getChess,get);assert.equal(view.getChess('new'),ds.getChess('new'));
});
test('staged definitions preserve the normal default and explicit skill-loadout resolution',()=>{
 const r=chessRec({id:'multi'});r.skill.index=1;r.skills=[r.skill,{...r.skill,index:2,skillId:'sk_variant',spCost:20}];
 const ordinary=new DataSource({chess:{multi:r}}),staged=new DataSource();staged.registerChessRecords({multi:r});
 assert.deepEqual(staged.getChess('multi'),ordinary.getChess('multi'));assert.deepEqual(staged.getChess('multi',{skillIndex:2}),ordinary.getChess('multi',{skillIndex:2}));near(staged.getChess('multi',{skillIndex:2}).skill.spCost,20);
});
test('hidden cards register exact source records but cannot deploy or spend DP before their own action',()=>{
 const{b,d}=fixture(),get=b.data.getChess,dp=b.dp;for(const id of ids)assert.equal(b.data.getChess(id),null);
 const c=installStage17_16Cards(b,d);assert.equal(b.data.getChess,get);assert.ok(c.cards().every(r=>!r.active));assert.equal(b.deployedSlots(),0);near(b.dp,dp);
 for(const id of ids){assert.equal(b.bench[id],undefined);assert.equal(b.cost(id),Infinity);assert.throws(()=>b.redeployOperatorFromSkill(id,2,4,'RIGHT'),/unavailable/);assert.equal(b.data.getChess(id).raw.arkpedia.moduleLevel,3);assert.deepEqual(catalogueFor(d)[id].modules,[]);}
});
test('each literal activation delivers only its alias once, and unrelated records remain hidden',()=>{
 const{b,d}=fixture(),c=installStage17_16Cards(b,d);
 for(let n=0;n<actions.length;n++){const a=actions[n],id=a.key.split('#')[0],result=c.receive(structuredClone(a));assert.equal(result.status,'activated');assert.equal(b.bench[id].predefinedAlias,a.key);assert.equal(Object.isFrozen(b.bench[id].build),true);assert.equal(c.cards().filter(r=>r.active).length,n+1);
  const entry=b.bench[id];assert.equal(c.receive(a).status,'already-active');assert.equal(b.bench[id],entry);}
 assert.equal(b.allyUnits.length,0);assert.deepEqual(b.errors,[]);
});
test('the native preset and all four delivered cards compose without replacing data getters or injecting player loadouts',()=>{
 const{b,d}=fixture(),viy=installViyPredefined(b),c=installStage17_16Cards(b,d);for(const a of actions)c.receive(a);
 const deploy=(id,row,col)=>{b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,row,col,'RIGHT');u.atkCd=1000;return u;};
 const mul=deploy(M,2,4),pti=deploy(P,2,3),pon=deploy(V,3,4),kes=deploy(K,3,5);near(b.bench[K].lastCost,9);near(mul.s.atk,458*1.15);near(pti.s.atk,437*1.15);
 for(const u of[mul,pti,pon,kes])u.skill.setSpTotal(0);advance(b,1);for(const u of[mul,pti,pon,kes])near(u.skill.spTotal,1.35);
 assert.equal(applyViyTutorialSp(b).after,49);assert.ok(b.activateOperator(viy.key));assert.equal(b.deployedSlots(),5);assert.deepEqual(b.errors,[]);
});
test('duplicate delivery cannot reset a paid deployment, its refund, cooldown or first-use cost',()=>{
 const{b,d}=fixture(),c=installStage17_16Cards(b,d);c.receive(action(K));b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(K,3,5,'RIGHT'),entry=b.bench[K];near(entry.lastCost,9);b.getPlayer('arkpedia').dp=0;
 c.receive(action(K));assert.equal(entry.unit,u);near(entry.lastCost,9);assert.equal(entry.deployments,1);b.retreatOperator(K);near(b.dp,4);const ready=entry.readyAt;
 c.receive(action(K));assert.equal(entry.readyAt,ready);assert.equal(entry.deployments,1);near(b.cost(K),19);entry.readyAt=b.time;b.getPlayer('arkpedia').dp=99;b.deployOperator(K,3,5,'RIGHT');near(entry.lastCost,19);
});
test('changed action flags, clocks or aliases are rejected instead of activating a different source card',()=>{
 const{b,d}=fixture(),c=installStage17_16Cards(b,d);
 for(const change of [{preDelay:0},{count:2},{key:K},{routeIndex:0},{actionType:'SPAWN'}])assert.throws(()=>c.receive({...action(K),...change}),/Unreviewed/);
 assert.throws(()=>c.receive(source.actions[0].action),/Unreviewed/);assert.ok(c.cards().every(r=>!r.active));
});
test('freshness, source and existing-role guards leave no partial records on failure',()=>{
 const selected=fixture([K]);assert.throws(()=>installStage17_16Cards(selected.b,selected.d),/conflicts/);assert.equal(selected.b.data.rawChess(M),null);
 const{b,d}=fixture(),changed=structuredClone(source);changed.predefines.characterCards[0].hidden=false;assert.throws(()=>installStage17_16Cards(b,d,{tutorial:changed}),/Unreviewed/);assert.equal(b.data.rawChess(M),null);
 b.time=1;assert.throws(()=>installStage17_16Cards(b,d),/fresh/);b.time=0;installStage17_16Cards(b,d);assert.throws(()=>installStage17_16Cards(b,d),/fresh/);
});
test('battle completion and replaced registrations or entries cannot deliver or reset stale cards',()=>{
 for(const end of ['event','finished']){const{b,d}=fixture(),c=installStage17_16Cards(b,d);if(end==='event')b.emit('battleEnd',{});else b.finished=true;assert.equal(c.receive(action(K)).status,'cancelled');assert.equal(b.bench[K],undefined);}
 const{b,d}=fixture(),c=installStage17_16Cards(b,d);c.receive(action(K));b.bench[K]={...b.bench[K]};assert.throws(()=>c.receive(action(K)),/replaced/);
 const other=fixture(),o=installStage17_16Cards(other.b,other.d);other.b.data.raw.chess[K]={};assert.throws(()=>o.receive(action(K)),/replaced/);
});
