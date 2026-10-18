// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit held component fixture; the passive account is diagnostic only.
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type:'json'};
import e from '../../data/arkpedia-native-operators/char_4223_botany.json' with {type:'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {selectedBotanyBuild,BOTANY_ID as ID} from '../../server/sim/content/arkpedia-botany-source.js';
import {BotanyBurstTalent,BOTANY_TALENT_CONTRACT} from '../../server/sim/content/arkpedia-botany-talent.js';
import {BotanyOrdinaryAttacks,BOTANY_ORDINARY_CONTRACT} from '../../server/sim/content/arkpedia-botany-ordinary.js';
export{near,advance,until}from'./mon3tr-fixture.js';
export function addOwner(b,{skill=1,elite=2,level=e.tables.character.phases[elite].maxLevel,rank=[4,7,10][elite],potential=1,trust=0,
 row=5,col=5,dir='RIGHT',defer=false,contract=BOTANY_TALENT_CONTRACT,beforeInstall,ordinary=false,
 ordinaryContract=BOTANY_ORDINARY_CONTRACT,mayBegin=()=>true,prepare}={}){
 const build={elite,level,potential,trust,skillId:`skchr_botany_${skill}`,skillRank:rank,module:'none'},record=selectedBotanyBuild(build),c=e.tables.character;
 const def=normalizeChess({chessId:ID,charId:ID,name:c.appellation,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,
  stats:record.stats,rangeGrid:record.rangeGrid,tags:record.tags,talents:record.talents,
  skill:{...record.source,...record.source.spData,skillId:build.skillId,rangeGrid:record.skillRangeGrid,trigger:{rule:'NEVER'}},arkpedia:build});
 const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir}),prepared=prepare?.(b,u);
 const talent=prepared?.talent??new BotanyBurstTalent(b,u,{contract});
 const attacks=prepared?.controller??(ordinary?new BotanyOrdinaryAttacks(b,u,{contract:ordinaryContract,mayBegin}):null);
 b._setupUnit(u,prepared?.kit??{trait:attacks?.trait()??{noAttack:true},talents:[],skill:{kind:'passive'}});
 beforeInstall?.(b,u,talent,attacks);if(prepared)attacks.install();else{talent.install();attacks?.install();}
 const hits=[],receipts=[];b.on('damaged',ctx=>hits.push({...ctx,time:b.time}));
 b.on('attack',ctx=>{if(ctx.attacker===u)receipts.push({...ctx,time:b.time});});
 const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));};if(!defer)deploy();return{b,u,talent,attacks,record,build,deploy,hits,receipts,...prepared};
}
export function make(opts={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));return addOwner(b,opts);
}
export function enemy(f,{row=5,col=7,hp=1e7,flags={},motion='WALK'}={}){
 const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(t.base,{maxHp:hp,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=hp;t.motion=motion;
 f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});f.b._buildEnemyIndex();return t;
}
export function burst(f,t,{element='erosion',source=null}={}){
 const current=t.findBuff(`${element}Burst`);if(current)f.b.removeBuff(t,current);
 return f.b.dealDamage(source,t,{amount:t.gaugeMax,type:'element',element,canDodge:false,tags:['fixture:burst']});
}
