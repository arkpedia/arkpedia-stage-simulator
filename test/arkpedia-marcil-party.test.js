// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import { MARCIL_ID as ID, validateMarcilDefinition } from '../server/sim/content/arkpedia-marcil-source.js';
import { MARCIL_PARTY_CONTRACT as CONTRACT, installMarcilParty, verifyMarcilPartySource }
  from '../server/sim/content/arkpedia-marcil-party.js';
import { prepareMarcilFamiliar, MARCIL_FAMILIAR_CONTRACT } from '../server/sim/content/arkpedia-marcil-familiar.js';
import { prepareMarcilExplosion, MARCIL_EXPLOSION_CONTRACT } from '../server/sim/content/arkpedia-marcil-explosion.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { make as baseMake, advance, until, enemy } from './helpers/marcil-fixture.js';
const LAIOS='char_4142_laios', SENSHI='char_4143_sensi', CHIL='char_4144_chilc', MEL='char_208_melan';
const PARTY=[LAIOS,SENSHI,CHIL];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function make({elite=2,potential=1,install=true,members=PARTY,support,skill=1,...opts}={}) {
  const operators=[...members.filter(id=>id!==support),MEL].map(id=>defaultBuild(data.operators[id]));
  const f=baseMake({deferred:true,elite,potential,operators,
    ...(support?{support:defaultBuild(data.operators[support])}:{}),skill,
    ...(skill===2?{prepare:prepareMarcilFamiliar,contract:MARCIL_FAMILIAR_CONTRACT}:{}),
    ...(skill===3?{prepare:prepareMarcilExplosion,contract:MARCIL_EXPLOSION_CONTRACT}:{}),...opts});
  f.b.data.raw.chess[ID]=f.def.raw;
  f.b.bench[ID]={build:f.build,unit:null,deployments:0,readyAt:0,lastCost:0};
  if(install) f.state=installMarcilParty(f.b,{contract:CONTRACT});
  return f;
}
function deploy(f,id=LAIOS,row=4,col=6) { const u=f.b.deployOperator(id,row,col,'RIGHT'); assert.deepEqual(f.b.errors,[]);return u; }
function owner(f) { assert.equal(f.b._deploy(f.u,{initial:false}),true); return f.u; }

test('party talent requires its explicit contract and never enables a public Marcille kit',()=>{
  verifyMarcilPartySource(); assert.equal(CONTRACT.frameParity,false); assert.equal(data.operators[ID],undefined);
  assert.deepEqual(evidence.enabledOperators,[]); const f=make({install:false});
  assert.throws(()=>installMarcilParty(f.b),/explicit party contract/);
  assert.throws(()=>installMarcilParty(f.b,{contract:{...CONTRACT}}),/explicit party contract/);
  const s=installMarcilParty(f.b,{contract:CONTRACT}); assert.equal(s.enabled,true);
  assert.throws(()=>installMarcilParty(f.b,{contract:CONTRACT}),/already installed/);
  assert.ok(Object.isFrozen(s)); assert.ok(Object.isFrozen(s.members)); assert.ok(Object.isFrozen(s.mods));
});

test('party installation requires a fresh roster and rejects late, completed or previously deployed battles',()=>{
  for(const mode of ['missing','time','finished','pending','deployed','deployment-count']) {
    const f=make({install:false});
    if(mode==='missing')delete f.b.bench[ID];
    if(mode==='time')advance(f,.1);
    if(mode==='finished')f.b.finished=true;
    if(mode==='pending')f.b._endReq={reason:'fixture'};
    if(mode==='deployed')deploy(f);
    if(mode==='deployment-count')f.b.bench[LAIOS].deployments=1;
    assert.throws(()=>installMarcilParty(f.b,{contract:CONTRACT}),/fresh selected roster/);
    assert.equal(f.b._marcilParty,undefined);
  }
});

test('shared source validation rejects changed owner stats, tags, skill and promotion talent before squad installation',()=>{
  for(const mutate of [d=>d.stats.def++,d=>d.tags=[],d=>d.skill.bb.atk++,d=>d.talents[1].bb.def++,
    d=>d.skill.spCost--,d=>d.rangeGrid.push([1,90])]) {
    const f=make({install:false}); const def=structuredClone(f.def); mutate(def); f.b.data._chess.set(ID,def);
    assert.throws(()=>installMarcilParty(f.b,{contract:CONTRACT}),/Incomplete Marcille selected source/);
    assert.equal(f.b._marcilParty,undefined);
  }
  const f=make({install:false}); assert.equal(validateMarcilDefinition(f.def).index,0);
  assert.throws(()=>validateMarcilDefinition(null),/Incomplete/);
});

test('the bench selection must match the complete held-owner definition, including trust and potential metadata',()=>{
  for(const [key,value] of [['elite',1],['level',1],['potential',2],['trust',200],['skillRank',1],['skillId','skchr_marcil_2'],['module','invalid']]) {
    const f=make({install:false}); f.b.bench[ID].build={...f.build,[key]:value};
    assert.throws(()=>installMarcilParty(f.b,{contract:CONTRACT}),/selected squad build/);
    assert.equal(f.b._marcilParty,undefined);
  }
});

test('only selected E2 unlocks the party talent, across every potential rank',()=>{
  for(const elite of [0,1,2])for(let potential=1;potential<=6;potential++) {
    const f=make({elite,potential}); assert.equal(f.state.enabled,elite===2);
    assert.equal(f.state.members.length,4); const u=deploy(f);
    assert.equal(!!u.findBuff('marcil:party'),elite===2);
    near(u.s.aspd,u.base.aspd+(elite===2?25:0)); near(u.s.def,u.base.def*(elite===2?1.35:1));
  }
});

test('three, two or one party cards do not trigger the four-card threshold, even with unrelated squad members',()=>{
  for(let count=0;count<=2;count++) {
    const f=make({members:PARTY.slice(0,count)}); assert.equal(f.state.members.length,count+1); assert.equal(f.state.enabled,false);
    const u=deploy(f,MEL); assert.equal(u.findBuff('marcil:party'),null); owner(f);
    assert.equal(f.u.findBuff('marcil:party'),null);
  }
});

test('a selected support party card counts while still on the bench',()=>{
  for(const support of PARTY) {
    const f=make({support}); assert.equal(f.state.members.length,4); assert.equal(f.state.enabled,true);
    assert.equal(f.b.bench[support].unit,null); const u=deploy(f,support);
    assert.ok(u.findBuff('marcil:party')); assert.equal(f.u.deployed,false);
  }
});

test('all four source party members, including Marcille herself, receive one selected DEF/ASPD modifier',()=>{
  const f=make(); const u=owner(f); near(u.s.def,u.base.def*1.35); near(u.s.aspd,u.base.aspd+25);
  for(const [i,id]of PARTY.entries()) {
    const v=deploy(f,id,4,i+5); const buff=v.findBuff('marcil:party'); assert.ok(buff);
    assert.deepEqual(buff.mods,{defPct:.35,aspd:25}); assert.equal(buff.source,null); assert.equal(buff.stacks,1);
  }
  const other=deploy(f,MEL,3,6); assert.equal(other.findBuff('marcil:party'),null);
});

test('deck DEF adds beside Senshi own DEF and other percent modifiers without multiplying those buckets',()=>{
  const plain=make({install:false}); const unboosted=deploy(plain,SENSHI);
  const f=make(),u=deploy(f,SENSHI); near(u.s.def-unboosted.s.def,u.base.def*.35);
  const before=u.s.def; f.b.addBuff(u,{key:'fixture:def',mods:{defPct:.4,aspd:10}});
  near(u.s.def-before,u.base.def*.4); near(u.s.aspd,u.base.aspd+35);
  f.state.stop(); assert.equal(u.findBuff('marcil:party'),null);
  assert.ok(u.findBuff('fixture:def')); assert.ok(u.findBuff('sensi_t_1'));
  near(u.s.def,unboosted.s.def+u.base.def*.4); near(u.s.aspd,u.base.aspd+10);
});

test('Marcille may stay on the bench or die without removing the immutable squad bonus from later deployments',()=>{
  for(const reason of ['bench','retreat','killed']) {
    const f=make(); if(reason!=='bench'){owner(f);if(reason==='retreat')f.b.retreat(f.u,{permanent:true});else f.b.kill(f.u);}
    const u=deploy(f); assert.ok(u.findBuff('marcil:party')); assert.equal(f.state.enabled,true);
    assert.equal(f.state.members.length,4); assert.equal(f.state.closed,false);
  }
});

test('a retreated party member gets the same single bonus on its fresh redeployment',()=>{
  const f=make(); const first=deploy(f), stats={def:first.s.def,aspd:first.s.aspd};
  f.b.retreatOperator(LAIOS); assert.equal(first.findBuff('marcil:party'),null);
  f.b.bench[LAIOS].readyAt=f.b.time; f.b.getPlayer('arkpedia').dp=99;
  const next=deploy(f); assert.notEqual(next,first); near(next.s.def,stats.def); near(next.s.aspd,stats.aspd);
  assert.equal(next.buffs.filter(b=>b.key==='marcil:party').length,1);
});

test('a fresh held-owner life preserves selected source stats and independent mana with the deck bonus',()=>{
  const f=make(); owner(f); assert.equal(f.wallet.value,50); near(f.u.s.def,f.u.base.def*1.35);
  f.b.retreat(f.u,{permanent:true}); const next=f.create();
  assert.equal(next.wallet,f.wallet); assert.equal(next.u.skill.spTotal,50); near(next.u.s.def,next.u.base.def*1.35);
  assert.equal(next.u.buffs.filter(b=>b.key==='marcil:party').length,1);
});

test('party identity is source-backed and rejects forged faction tags on unrelated cards',()=>{
  const f=make({install:false,members:[LAIOS,SENSHI]}); const raw=f.b.data.raw.chess[MEL];
  f.b.data._chess.set(MEL,normalizeChess({...raw,tags:['laios']}));
  assert.throws(()=>installMarcilParty(f.b,{contract:CONTRACT}),/Unreviewed.*member source/);
  assert.equal(f.b._marcilParty,undefined);
});

test('missing or changed original party-member tags fail before any deck modifier is installed',()=>{
  for(const id of PARTY) {
    const f=make({install:false}); f.b.data._chess.set(id,normalizeChess({...f.b.data.raw.chess[id],tags:[]}));
    assert.throws(()=>installMarcilParty(f.b,{contract:CONTRACT}),/Incomplete.*member tags/);
    assert.equal(f.b._marcilParty,undefined);
  }
});

test('alias cards and tagged summon records cannot inflate a threshold of unique source operators',()=>{
  for(const mode of ['alias','token']) {
    const f=make({install:false,members:[LAIOS,SENSHI]}); const raw=f.b.data.raw.chess[LAIOS];
    const id=mode==='alias'?'fixture:duplicate-laios':'fixture:party-token';
    f.b.data.raw.chess[id]={...raw,chessId:id,charId:LAIOS,arkpedia:{...raw.arkpedia,isToken:mode==='token'}};
    f.b.bench[id]={build:{...f.b.bench[LAIOS].build,id},deployments:0};
    const s=installMarcilParty(f.b,{contract:CONTRACT}); assert.equal(s.members.length,3); assert.equal(s.enabled,false);
  }
});

test('tokens, devices, another player and another side never receive an operator-card bonus',()=>{
  const f=make(); const def=f.b.data.getChess(LAIOS);
  for(const [kind,ownerId,side]of [['token','arkpedia','ally'],['device','arkpedia','ally'],['op','other','ally'],['op','arkpedia','enemy']]) {
    const u=f.b._makeAlly(f.b.getPlayer('arkpedia'),def,kind,3,3,{dir:'RIGHT'});
    f.b._setupUnit(u,{trait:{noAttack:true},skill:null}); u.ownerId=ownerId; u.side=side;
    assert.ok(f.b._deploy(u)); assert.equal(u.findBuff('marcil:party'),null); f.b.retreat(u,{permanent:true});
  }
});

test('squad membership remains immutable when deployment state changes or the mutable bench is edited',()=>{
  const f=make(); const list=[...f.state.members]; const u=deploy(f);
  u.hidden=true; f.b.emit('deploy',{unit:u,move:true}); assert.ok(u.findBuff('marcil:party'));
  delete f.b.bench[CHIL]; delete f.b.bench[ID]; assert.deepEqual(f.state.members,list);
  assert.equal(f.state.enabled,true); assert.ok(u.findBuff('marcil:party')); f.state.stop();
});

test('moves and repeated birth notifications never stack the squad modifier',()=>{
  const f=make(); const u=deploy(f), def=u.s.def, aspd=u.s.aspd;
  for(let i=0;i<3;i++)f.b.emit('deploy',{unit:u,move:i%2===0});
  near(u.s.def,def); near(u.s.aspd,aspd); assert.equal(u.buffs.filter(b=>b.key==='marcil:party').length,1);
});

test('rejected deck-buff attachment leaves no bonus and does not consume the squad qualification',()=>{
  const f=make(); f.b.on('beforeBuff',x=>{if(x.buff.key==='marcil:party')x.cancel=true;});
  const u=deploy(f); assert.equal(u.findBuff('marcil:party'),null); near(u.s.aspd,u.base.aspd);
  assert.equal(f.state.enabled,true); assert.equal(f.state.members.length,4);
});

test('retirement or a pending battle finish inside deck attachment cannot leave a stale modifier',()=>{
  for(const action of ['retreat','finish']) {
    const f=make(); f.b.on('beforeBuff',x=>{
      if(x.buff.key==='marcil:party')action==='retreat'?f.b.retreat(x.unit,{permanent:true}):f.b.forceEnd('fixture');
    });
    const u=deploy(f); assert.equal(u.findBuff('marcil:party'),null);
    assert.equal(action==='finish'?f.state.closed:!u.alive,true); assert.deepEqual(f.b.errors,[]);
  }
});

test('stopping the party from an attachment callback prevents that deployment and later births from retaining it',()=>{
  const f=make(); f.b.on('beforeBuff',x=>{if(x.buff.key==='marcil:party')f.state.stop();});
  const u=deploy(f); assert.equal(u.findBuff('marcil:party'),null); assert.equal(f.state.closed,true);
  const next=deploy(f,SENSHI,4,7); assert.equal(next.findBuff('marcil:party'),null);
});

test('a pending battle finish during a scheduled deployment removes the buff before the step unwinds',()=>{
  const f=make(); let unit, pending;
  f.b.on('beforeBuff',x=>{if(x.buff.key==='marcil:party'){f.b.forceEnd('fixture');pending=!!f.b._endReq;}});
  f.b.after(.05,()=>{unit=deploy(f);assert.equal(unit.findBuff('marcil:party'),null);});
  advance(f,.2); assert.equal(pending,true); assert.equal(f.b.finished,true); assert.equal(f.state.closed,true);
  assert.equal(unit.findBuff('marcil:party'),null); assert.deepEqual(f.b.errors,[]);
});

test('nested deployment from a deck-buff callback gives each selected companion exactly one modifier',()=>{
  const f=make(); let nested;
  f.b.on('beforeBuff',x=>{if(x.unit.defId===LAIOS&&x.buff.key==='marcil:party')nested=deploy(f,SENSHI,4,7);});
  const first=deploy(f);
  for(const u of [first,nested])assert.equal(u.buffs.filter(b=>b.key==='marcil:party').length,1);
  near(first.s.aspd,first.base.aspd+25); near(nested.s.aspd,nested.base.aspd+25);
  f.state.stop(); assert.equal(first.findBuff('marcil:party'),null); assert.equal(nested.findBuff('marcil:party'),null);
});

test('battle finish and explicit stop remove only owned party modifiers, including temporarily hidden recipients',()=>{
  for(const action of ['finish','stop']) {
    const f=make(),u=deploy(f),v=deploy(f,SENSHI,4,7); u.hidden=true;
    f.b.addBuff(v,{key:'fixture:unrelated',mods:{defPct:.2}});
    action==='finish'?f.b.forceEnd('fixture'):f.state.stop(); f.state.stop();
    assert.equal(f.state.closed,true); assert.equal(u.findBuff('marcil:party'),null); assert.equal(v.findBuff('marcil:party'),null);
    assert.ok(v.findBuff('fixture:unrelated')); assert.ok(v.findBuff('sensi_t_1'));
  }
  const f=make({elite:1}); assert.equal(f.state.enabled,false); f.b.forceEnd('fixture'); assert.equal(f.state.closed,true);
});

test('cleanup follows the accepted modifier object and preserves an unrelated replacement with the same key',()=>{
  const f=make();
  f.b.on('beforeBuff',x=>{if(x.unit.defId===LAIOS&&x.buff.key==='marcil:party')x.buff.key='fixture:renamed-party';});
  const renamed=deploy(f), other=deploy(f,SENSHI,4,7); assert.ok(renamed.findBuff('fixture:renamed-party'));
  f.b.removeBuff(other,'marcil:party');
  const replacement=f.b.addBuff(other,{key:'marcil:party',mods:{defPct:.1}});
  f.state.stop(); assert.equal(renamed.findBuff('fixture:renamed-party'),null);
  assert.equal(other.findBuff('marcil:party'),replacement); near(renamed.s.aspd,renamed.base.aspd);
});

test('the party bonus affects original Marcille attack clocks without changing mana, damage modifiers or source readiness',()=>{
  for(const skill of [1,2,3]) {
    const f=make({skill}); owner(f); const mana=[50,35,65][skill-1]; assert.equal(f.wallet.value,mana);
    near(f.u.s.aspd,f.u.base.aspd+25); near(f.u.s.def,f.u.base.def*1.35);
    if(skill===2){until(f,()=>f.controller.mode==='s2',20);assert.equal(f.wallet.value,0);}
    enemy(f); until(f,()=>f.controller.phase?.kind==='attack');
    const p=f.controller.phase; near(p.speed,1); assert.ok(p.readyAt>=p.releaseAt);
    assert.equal(f.wallet.value,skill===2?0:mana); assert.ok(f.u.findBuff('marcil:party'));
  }
});
