// SPDX-License-Identifier: GPL-3.0-or-later
// Inspect original meshes, supported source emitters and explicit clips.
// This is not a completed particle/trail lifecycle or reviewed battle renderer.
import * as T from '/vendor/three.module.js';
import {createNativeEffectLibrary,compileNativeEffectPrograms} from './native-effect-player.js';
import {createEffectTrajectory} from '/shared/arkpedia/native-effect-trail.js';
import {readLapplandMotionInput} from '/shared/arkpedia/lappland-effect-motion.js';
const effect=document.querySelector('#effect'),clipSelect=document.querySelector('#clip'),time=document.querySelector('#time');
const status=document.querySelector('#status'),play=document.querySelector('#play'),host=document.querySelector('#scene');
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#142027');
const camera=new T.PerspectiveCamera(35,1,.001,100);camera.up.set(0,1,0);
let pack,animations,shaders,pose,group,playing=false,clock=0,timeWindow=3,last,draws=[],blocked=[];
let library,instance;
let trajectory=null;
let inspectionBounds=null;
let motionInput=null,motionIndex=0,sourcePackSha256,sourceTimeWindow=3;
const motionTrack=document.querySelector('#motion-track'),motionLabel=document.querySelector('#motion-track-label');
const cameraMode=document.querySelector('#camera-mode');
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function bytes(entry){
  const r=await fetch('/review-assets/'+entry.path);if(!r.ok)throw Error('Start the isolated original-effect review server first.');
  const b=await r.arrayBuffer();if(b.byteLength!==entry.bytes||await sha(b)!==entry.sha256)throw Error('Changed original review asset');return b;
}
let rebuildQueue=Promise.resolve();
function rebuild(){
  const name=effect.value;
  const next=rebuildQueue.then(()=>rebuildRoot(name));
  rebuildQueue=next.catch(()=>{});return next;
}
async function rebuildRoot(name){
  effect.disabled=clipSelect.disabled=time.disabled=play.disabled=true;
  playing=false;play.textContent='Play';pose=null;effect.value=name;
  try{
  if(instance)instance.dispose();
  instance=await library.create(name,{allowBlocked:true});
  ({pose,group,draws,blocked}=instance);scene.add(group);
  clipSelect.replaceChildren(new Option('Static native pose',''));
  for(const id of new Set(pose.instances.map(i=>i.clip)))clipSelect.add(new Option(animations.clips[id].name,id));
  if(clipSelect.options.length>1)clipSelect.selectedIndex=1;
  sourceTimeWindow=instance.timeWindow;
  timeWindow=motionInput?.kind==='lappland-s3-battle-motion'?motionInput.tracks[motionIndex].samples.at(-1).time:sourceTimeWindow;time.max=String(timeWindow);
  clock=0;time.value='0';draw();
  group.updateMatrixWorld(true);inspectionBounds=new T.Box3().setFromObject(group);
  if(inspectionBounds.isEmpty())inspectionBounds.set(new T.Vector3(-.25,-.25,-.25),new T.Vector3(.25,.25,.25));
  if(trajectory)inspectionBounds.translate(new T.Vector3().fromArray(trajectory.sample(0)).negate());
  fitCamera();draw();
  updateStatus();
  globalThis.effectReview={compileResults,pose,draws,blocked,library,player:instance,setTime(t){
    if(!Number.isFinite(t)||motionInput?.kind==='lappland-s3-battle-motion'&&(t<0||t>timeWindow))throw Error('Outside recorded motion clock');
    clock=t;time.value=String(t);draw();},setClip(id){clipSelect.value=id;draw();},
    async selectRoot(name){if(motionInput?.kind==='lappland-s3-battle-motion'&&name!==motionInput.tracks[motionIndex].effect)clearMotion();effect.value=name;await rebuild();},
    loadMotion:loadMotionInput,
    setTrajectory(samples){const next=samples===null?null:createEffectTrajectory(samples);clearMotion();trajectory=next;fitCamera();draw();updateStatus();}};
  }finally{effect.disabled=clipSelect.disabled=false;time.disabled=play.disabled=timeWindow===0;}
}
function clearMotion(){
  motionInput=null;motionIndex=0;trajectory=null;motionTrack.replaceChildren();motionLabel.hidden=true;
  timeWindow=sourceTimeWindow;time.max=String(timeWindow);time.disabled=play.disabled=false;
}
async function loadMotionInput(value){
  const next=readLapplandMotionInput(value,sourcePackSha256);
  playing=false;play.textContent='Play';
  if(next.kind==='movement'){globalThis.effectReview.setTrajectory(next.tracks[0].samples);return;}
  motionInput=next;motionIndex=0;trajectory=createEffectTrajectory(next.tracks[0].samples);
  motionTrack.replaceChildren(...next.tracks.map((t,i)=>new Option(`Drone ${t.slot+1} · ${t.start.toFixed(2)}s`,String(i))));motionLabel.hidden=false;
  effect.value=next.tracks[0].effect;await rebuild();
}
function selectMotionTrack(index){
  if(!motionInput||!Number.isInteger(index)||!motionInput.tracks[index])throw Error('Unknown recorded drone motion');
  playing=false;play.textContent='Play';motionIndex=index;trajectory=createEffectTrajectory(motionInput.tracks[index].samples);
  clock=0;time.value='0';timeWindow=motionInput.tracks[index].samples.at(-1).time;time.max=String(timeWindow);time.disabled=play.disabled=timeWindow===0;
  fitCamera();draw();updateStatus();
}
function fitCamera(){
  if(!inspectionBounds)return;
  const bounds=inspectionBounds.clone();
  if(trajectory){
    if(cameraMode.value==='follow')bounds.translate(new T.Vector3().fromArray(trajectory.sample(clock)));
    else{
      const movement=new T.Box3();
      for(const t of trajectory.times(timeWindow))movement.expandByPoint(new T.Vector3().fromArray(trajectory.sample(t)));
      bounds.min.add(movement.min);bounds.max.add(movement.max);
    }
  }
  const centre=bounds.getCenter(new T.Vector3()),extent=bounds.getSize(new T.Vector3()).length();
  const size=Number.isFinite(extent)?Math.max(extent,.5):.5;
  if(!centre.toArray().every(Number.isFinite))centre.set(0,0,0);
  const distance=size*1.8/Math.min(1,camera.aspect);
  camera.far=Math.max(100,distance*4);camera.position.copy(centre).add(new T.Vector3(.2,.35,1).normalize().multiplyScalar(distance));
  camera.lookAt(centre);camera.updateProjectionMatrix();
}
function updateStatus(){
  status.textContent=`${draws.length} original mesh/billboard/trail components inspected. ${blocked.length} components remain unplayed.\nSource-emitter/explicit-clip inspection: sphere/box/straight-cone emission, recorded-distance births, velocity, grid frames and local curl-noise/speed-limit replay with explicit world birth frames. View-aligned stretch trails use original widths, gradients and materials. ${trajectory?'Recorded movement is loaded.':'Load movement JSON to inspect trails; static source poses do not invent a path.'} Other shapes, native script motion and Animator transitions remain unplayed. Distance births interpolate recorded world-position segments; prewarm holds the start pose. Shape RNG/event phases, trail joins/expiry/UV orientation, noise field, timing, native coordinates and color management are not verified against game frames.`;
  if(motionInput?.kind==='lappland-s3-battle-motion')status.textContent+='\nMotion comes from the private simulator controller; cruise segments end at attachment. Reappearance starts a new segment. Native flight, rotation, mount-point height and FSM timing remain unverified.';
}
function draw(){
  if(!instance||instance.disposed)return;
  if(cameraMode.value==='follow')fitCamera();
  instance.update(clock,{camera,clip:clipSelect.value||null,trajectory});
  renderer.render(scene,camera);document.querySelector('#clock').textContent=clock.toFixed(2)+'s';
}
const observer=new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);fitCamera();camera.updateProjectionMatrix();draw();});observer.observe(host);
let compileResults;
try{
  const r=await fetch('/review-assets/manifest.json');if(!r.ok)throw Error('Start tools/arkpedia/preview-lappland-effects.mjs to inspect the cached original assets.');
  const meta=await r.json(),raw=await bytes(meta.effects.pack);
  sourcePackSha256=meta.effects.pack.sha256;
  pack=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  animations=JSON.parse(new TextDecoder().decode(await bytes(meta.animations.artifact)));
  shaders=JSON.parse(new TextDecoder().decode(await bytes(meta.shaders.artifact)));
  library=createNativeEffectLibrary({three:T,pack,animations,shaders,loadTexture:async entry=>{
    const b=await bytes(entry),url=URL.createObjectURL(new Blob([b],{type:'image/webp'}));
    try{return await new T.TextureLoader().loadAsync(url);}finally{URL.revokeObjectURL(url);}
  }});
  compileResults=compileNativeEffectPrograms(renderer,shaders);
  for(const name of Object.keys(pack.roots))effect.add(new Option(name.replace('whitw2_',''),name));
  effect.value='whitw2_token_01';await rebuild();
  effect.disabled=clipSelect.disabled=time.disabled=play.disabled=false;
  effect.onchange=async()=>{playing=false;play.textContent='Play';if(motionInput?.kind==='lappland-s3-battle-motion')clearMotion();await rebuild();};
  clipSelect.onchange=()=>{playing=false;play.textContent='Play';clock=0;time.value='0';draw();};
  time.oninput=()=>{playing=false;play.textContent='Play';clock=Number(time.value);draw();};
  play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause':'Play';last=undefined;};
  document.querySelector('#movement').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>2000000)throw Error('Movement JSON exceeds 2 MB');await loadMotionInput(JSON.parse(await file.text()));}
    catch(error){status.textContent=error.message;}
  };
  document.querySelector('#clear-movement').onclick=()=>{globalThis.effectReview.setTrajectory(null);document.querySelector('#movement').value='';};
  motionTrack.onchange=()=>selectMotionTrack(Number(motionTrack.value));
  cameraMode.onchange=()=>{fitCamera();draw();};
  function frame(now){if(playing){clock=(clock+(last===undefined?0:(now-last)/1000))%timeWindow;time.value=String(clock);draw();}last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
}catch(e){status.textContent=e.message;console.error(e);}
addEventListener('pagehide',()=>{observer.disconnect();library?.dispose();renderer.dispose();},{once:true});
