// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated source-selected stage fixture, not public roster/factory support.
import * as T from '/vendor/three.module.js';
import {StageRenderer} from './renderer.js';
import {createNativeEffectLibrary} from './native-effect-player.js';
import {createLapplandStageEffects} from './lappland-stage-effects.js';
import {recordLapplandS3Motion} from '/sim/content/arkpedia-lappland-motion.js';
import {StandardBattle} from '/sim/arkpedia.js';
import {normalizeChess} from '/sim/simdata.js';
import {defaultBuild} from '/shared/arkpedia/loadout.js';
import {LAPPLAND_ALTER_ID as ID,LAPPLAND_ATTACK_CONTRACT,selectedLapplandBuild,prepareLapplandAttacks} from '/sim/content/arkpedia-lappland-alter.js';
const status=document.querySelector('#status'),buttons=[...document.querySelectorAll('header button')],host=document.querySelector('#board');
let data,evidence,library,pass,stage,battle,owner,controller,target,resizeReview,playing=false,accumulator=0,last;
const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
async function bytes(entry){const r=await fetch('/review-assets/'+entry.path);if(!r.ok)throw Error('Original effect review asset unavailable');const b=await r.arrayBuffer();if(b.byteLength!==entry.bytes||await hash(b)!==entry.sha256)throw Error('Changed original effect review asset');return b;}
function enemy(col){
 const t=battle.spawnEnemy('enemy_1007_slime',{pos:[owner.y,col]});Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();t.hp=1e7;
 battle.addBuff(t,{key:'source-review:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();return t;
}
function draw(dt=0){
 stage.render(battle,dt,battle.drainEvents());document.querySelector('#clock').textContent=battle.time.toFixed(2)+'s';
 document.querySelector('#cast').disabled=!owner.alive||owner.skill.active;
 const phases=controller.s3.drones.map(d=>d.phase).join(', ')||'inactive';
 status.textContent=`Private S3 fixture on original 0-1 geometry; public factory and native frame parity remain unfinished. Enemies are pinned test targets. Cast adds one test charge.\nCruise phases: ${phases}. Original effects: ${pass.instanceCount}. Motion uses observed board coordinates at source height zero; native mount height, heading and FSM dispatch remain unverified.`;
}
async function reset(){
 playing=false;last=undefined;accumulator=0;document.querySelector('#play').textContent='Play';
 pass.clear();stage.clear();const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 battle=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_289_gyuki)]});battle.autoFinish=false;battle.recordEvents=true;battle.rng=()=>.99;battle.setViewport('fullscreen-workspace');
 const build={elite:2,level:90,potential:1,trust:0,skillId:'skchr_whitw2_3',skillRank:10},r=selectedLapplandBuild(build),c=evidence.tables.character;
 const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
  tags:[c.nationId,c.groupId,c.teamId].filter(v=>typeof v==='string'&&v),skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:r.source.rangeId?evidence.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
 const tile=stage.tiles.filter(t=>t.type===1).sort((a,b)=>Math.abs(a.row-3)+Math.abs(a.col-4)-Math.abs(b.row-3)-Math.abs(b.col-4))[0];if(!tile)throw Error('Original stage has no ranged deployment tile');
 owner=battle._makeAlly(battle.getPlayer('arkpedia'),def,'op',tile.row,tile.col,{dir:'RIGHT'});const prepared=prepareLapplandAttacks(battle,owner,{contract:LAPPLAND_ATTACK_CONTRACT});controller=prepared.controller;
 battle._setupUnit(owner,prepared.kit);controller.install();if(!battle._deploy(owner,{initial:false}))throw Error('Private review deployment failed');owner.player.dp=99;
 target=enemy(Math.min(d.stage.geometry.cols-2,tile.col+5));pass.update(battle);await stage.preload([...Object.keys(battle.bench),ID]);draw();
 // This private operator is absent from the public metadata used by the
 // renderer. Select its original S3 model role explicitly for this fixture.
 const actor=stage.views.get(owner.id)?.actor,role=actor?.roles.skills?.['2'];
 if(!role)throw Error('Original Lappland model has no S3 animation role');
 actor.roles={...actor.roles,skill:role};actor.baseRoles=actor.roles;
 document.querySelector('#retreat').disabled=false;document.querySelector('#cast').disabled=false;
}
async function cast(){if(!owner.alive||owner.skill.active)return false;owner.skill.addCharge(1);if(!controller.toggle())throw Error('Private source cast was rejected');draw();await pass.ready();draw();return true;}
async function advance(seconds){for(let n=0;n<Math.ceil(seconds/battle.dt-1e-9);n++)battle.step();if(battle.errors.length)throw Error(JSON.stringify(battle.errors));draw(seconds);await pass.ready();draw();}
function disposeReview(){playing=false;resizeReview?.disconnect();if(stage&&!stage.destroyed)stage.destroy();pass?.dispose();library?.dispose();}
try{
 [data,evidence]=await Promise.all(['/review-stage-data.json','/data/arkpedia-lappland-alter-prefabs.json'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('Start the isolated source review server');return r.json();}));
 const meta=await (await fetch('/review-assets/manifest.json')).json(),raw=await bytes(meta.effects.pack),pack=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
 const animations=JSON.parse(new TextDecoder().decode(await bytes(meta.animations.artifact))),shaders=JSON.parse(new TextDecoder().decode(await bytes(meta.shaders.artifact)));
 library=createNativeEffectLibrary({three:T,pack,animations,shaders,loadTexture:async entry=>{const raw=await bytes(entry),url=URL.createObjectURL(new Blob([raw],{type:'image/webp'}));try{return await new T.TextureLoader().loadAsync(url);}finally{URL.revokeObjectURL(url);}}});
 // Validate/decode the entire cruise root before starting the private battle.
 const probe=await library.create('whitw2_skill_03_token_trail_01');probe.dispose();
 pass=createLapplandStageEffects({three:T,library,sourcePackSha256:meta.effects.pack.sha256,recordMotion:recordLapplandS3Motion});
 stage=new StageRenderer(host,data,()=>{},{nativeEffects:pass});await Promise.all([stage.artReady,stage.gatesReady,stage.particlesReady]);await reset();buttons.forEach(b=>b.disabled=false);
 // The shared renderer first resizes without a battle. Redraw the private
 // paused fixture afterward so rotation cannot remove its actors or gauges.
 resizeReview=new ResizeObserver(()=>draw());resizeReview.observe(host);
 document.querySelector('#play').onclick=()=>{playing=!playing;last=undefined;document.querySelector('#play').textContent=playing?'Pause':'Play';};
 document.querySelector('#cast').onclick=()=>cast().catch(e=>{status.textContent=e.message;console.error(e);});
 document.querySelector('#move').onclick=()=>{const col=Math.max(1,target.x-2);battle.kill(target);target=enemy(col);draw();};
 document.querySelector('#retreat').onclick=()=>{battle.retreat(owner,{permanent:true});playing=false;document.querySelector('#play').textContent='Play';document.querySelector('#retreat').disabled=document.querySelector('#cast').disabled=true;draw();};
 document.querySelector('#reset').onclick=()=>reset().catch(e=>{status.textContent=e.message;console.error(e);});
 globalThis.lapplandStageReview={get battle(){return battle;},get owner(){return owner;},get controller(){return controller;},stage,pass,library,cast,advance,reset,draw,dispose:disposeReview};
 function frame(now){
  if(playing&&!matchMedia('(max-width:700px) and (orientation:portrait)').matches){accumulator+=last===undefined?0:Math.min(.25,(now-last)/1000);let stepped=0;while(accumulator>=battle.dt){battle.step();accumulator-=battle.dt;stepped+=battle.dt;}draw(stepped);}
  last=now;requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}catch(e){status.textContent=e.message;console.error(e);}
addEventListener('pagehide',disposeReview,{once:true});
