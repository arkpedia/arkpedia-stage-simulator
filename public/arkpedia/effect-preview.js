// SPDX-License-Identifier: GPL-3.0-or-later
// Public source-effect QA page. Timeline scrubbing never touches a real battle.
import { StandardBattle } from '/sim/arkpedia.js';
import { defaultBuild } from '/shared/arkpedia/loadout.js';
import { StageRenderer } from './renderer.js';
const data=await (await fetch('/data/arkpedia-mvp.json')).json();
const renderer=new StageRenderer(document.querySelector('#scene'),data,()=>{});
const time=document.querySelector('#time'),select=document.querySelector('#operator'),play=document.querySelector('#play');
let battle,previewUnit,start=0,playing=false,last,lastAge=-1,playTime=0;
async function reset(){
  play.disabled=true;time.disabled=true;select.disabled=true;playing=false;
  renderer.clear();await renderer.preload([select.value]);await Promise.all([renderer.artReady,renderer.gatesReady]);
  const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];
  battle=new StandardBattle(source,{operators:[defaultBuild(data.operators[select.value])]});
  battle.autoFinish=false;battle.setViewport('fullscreen-workspace');battle.addDp('arkpedia',40);
  const unit=battle.deployOperator(select.value,2,7,'RIGHT');
  previewUnit=unit;lastAge=-1;
  // Finish the entrance clip before freezing the visual timeline.
  renderer.render(battle,0,[],1);
  unit.skill.gainSp(unit.skill.spCost,'preview');
  if(unit.skill.manual)battle.activateOperator(select.value);else battle.step();
  start=unit.skill.lastStart;renderer.render(battle,0,battle.drainEvents(),.01);
  time.value='.08';draw();
  play.disabled=false;time.disabled=false;select.disabled=false;
  document.querySelector('#status').textContent=renderer.skillParticles?
    'Activation burst only. DP-counter flight remains unimplemented; native damping and the body anchor are approximated.':
    'Original skill artwork failed to load. Check the browser console.';
}
function draw(age=Number(time.value)){
  if(!battle)return;
  if(age<lastAge && renderer.skillParticles){
    renderer.skillParticles.clear();
    renderer.skillParticles.add(previewUnit.id,start,[previewUnit.x,previewUnit.y],previewUnit.skill.activations);
  }
  lastAge=age;
  battle.time=start+age;
  renderer.render(battle,0,[],0);
  document.querySelector('#clock').textContent=Number(time.value).toFixed(2)+'s';
}
time.oninput=()=>{playing=false;draw();};select.onchange=reset;
play.onclick=async()=>{await reset();time.value='0';playTime=0;playing=true;last=undefined;};
function frame(now){
  if(playing){
    const delta=last===undefined?0:(now-last)/1000;
    playTime=Math.min(.7,playTime+delta);time.value=playTime.toFixed(2);draw(playTime);
    if(playTime>=.7)playing=false;
  }
  last=now;requestAnimationFrame(frame);
}
await reset();requestAnimationFrame(frame);
addEventListener('pagehide',()=>renderer.destroy(),{once:true});
