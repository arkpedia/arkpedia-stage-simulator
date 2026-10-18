// SPDX-License-Identifier: GPL-3.0-or-later
// Held component fixture. The passive account is diagnostic, never a published skill replacement.
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type:'json'};
import e from '../../data/arkpedia-native-operators/char_4213_skybx.json' with {type:'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {selectedSkyboxBuild,SKYBOX_ID as ID} from '../../server/sim/content/arkpedia-skybox-source.js';
import {SkyboxFirstModifierTalent,SKYBOX_TALENT_CONTRACT} from '../../server/sim/content/arkpedia-skybox-talent.js';
import {SkyboxTakeoff,SKYBOX_TAKEOFF_CONTRACT} from '../../server/sim/content/arkpedia-skybox-takeoff.js';
import {SkyboxOrdinaryAttacks,SKYBOX_ORDINARY_CONTRACT} from '../../server/sim/content/arkpedia-skybox-ordinary.js';
export{near,advance,until}from'./mon3tr-fixture.js';
export function addOwner(b,{skill=1,elite=2,level=e.tables.character.phases[elite].maxLevel,rank=[4,7,10][elite],potential=1,trust=0,
 row=5,col=5,dir='RIGHT',defer=false,contract=SKYBOX_TALENT_CONTRACT,beforeInstall,ordinary=false,ordinaryContract=SKYBOX_ORDINARY_CONTRACT,mayBegin=()=>true}={}){
 const build={elite,level,potential,trust,skillId:`skchr_skybx_${skill}`,skillRank:rank,module:'none'},record=selectedSkyboxBuild(build),c=e.tables.character;
 const def=normalizeChess({chessId:ID,charId:ID,name:c.appellation,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,
  stats:record.stats,rangeGrid:record.rangeGrid,tags:record.tags,talents:record.talents,
  skill:{...record.source,...record.source.spData,skillId:build.skillId,rangeGrid:record.skillRangeGrid,trigger:{rule:'NEVER'}},arkpedia:build});
 const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir}),talent=new SkyboxFirstModifierTalent(b,u,{contract});
 const takeoff=ordinary?new SkyboxTakeoff(b,u,{contract:SKYBOX_TAKEOFF_CONTRACT}):null;
 const attacks=ordinary?new SkyboxOrdinaryAttacks(b,u,{contract:ordinaryContract,mayBegin,takeoff}):null;
 b._setupUnit(u,{trait:attacks?.trait()??{noAttack:true},talents:[],skill:{kind:'passive'}});beforeInstall?.(b,u,talent,attacks);
 talent.install();takeoff?.install();attacks?.install();
 const hits=[],receipts=[];b.on('damaged',ctx=>hits.push({...ctx,time:b.time}));
 b.on('attack',ctx=>{if(ctx.attacker===u)receipts.push({...ctx,time:b.time});});
 const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));};if(!defer)deploy();return{b,u,talent,takeoff,attacks,record,build,deploy,hits,receipts};
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
