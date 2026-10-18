// SPDX-License-Identifier: GPL-3.0-or-later
// Held component fixture. The passive account does not replace either source skill.
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type:'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {selectedAegisBuild,AEGIS_ID as ID} from '../../server/sim/content/arkpedia-aegis-source.js';
import e from '../../data/arkpedia-native-operators/char_4218_aigis.json' with {type:'json'};
import {AegisTakeoff,AEGIS_TAKEOFF_CONTRACT} from '../../server/sim/content/arkpedia-aegis-takeoff.js';
import {AegisPhysicalTalent,AEGIS_TALENT_CONTRACT} from '../../server/sim/content/arkpedia-aegis-talent.js';
import {AegisOrdinaryAttacks,AEGIS_ORDINARY_CONTRACT} from '../../server/sim/content/arkpedia-aegis-ordinary.js';
export {near,advance,until} from './mon3tr-fixture.js';
export {enemy} from './skybox-fixture.js';
export function make({skill=1,elite=2,level=[50,70,80][elite],rank=[4,7,10][elite],potential=1,trust=0,row=5,col=5,dir='RIGHT',
 defer=false,beforeInstall,flight=true,talent=true,ordinary=false,mayBegin=()=>true,ordinaryContract=AEGIS_ORDINARY_CONTRACT,flightContract=AEGIS_TAKEOFF_CONTRACT,talentContract=AEGIS_TALENT_CONTRACT}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;d.stage.geometry.rows=19;d.stage.geometry.cols=21;
 d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const build={elite,level,potential,trust,skillId:`skchr_aigis_${skill}`,skillRank:rank,module:'none'},record=selectedAegisBuild(build),c=e.tables.character,
  def=normalizeChess({chessId:ID,charId:ID,name:c.appellation,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,stats:record.stats,rangeGrid:record.rangeGrid,tags:record.tags,talents:record.talents,
   skill:{...record.source,...record.source.spData,skillId:build.skillId,rangeGrid:record.skillRangeGrid},arkpedia:build}),u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
 const takeoff=flight?new AegisTakeoff(b,u,{contract:flightContract}):null,physical=talent?new AegisPhysicalTalent(b,u,{contract:talentContract}):null;
 const attacks=ordinary?new AegisOrdinaryAttacks(b,u,{contract:ordinaryContract,flight:takeoff,mayBegin}):null;
 b._setupUnit(u,{trait:attacks?.trait()??{noAttack:true},talents:[],skill:{kind:'passive'}});beforeInstall?.(b,u,takeoff,physical,attacks);takeoff?.install();physical?.install();attacks?.install();
 const hits=[],receipts=[];b.on('damaged',c=>hits.push({...c,time:b.time}));b.on('attack',c=>{if(c.attacker===u)receipts.push({...c,time:b.time});});
 const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));};if(!defer)deploy();return{b,u,record,build,flight:takeoff,talent:physical,attacks,hits,receipts,deploy};
}
