// SPDX-License-Identifier: GPL-3.0-or-later
// Original mesh-particle diagnostics, not complete FX or native-frame approval.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const linearMotion=process.argv.includes('--linear-motion');
const worldBirth=process.argv.includes('--world-birth'),surfaces=process.argv.includes('--surfaces'),chargeRoots=process.argv.includes('--charge-roots'),componentReview=linearMotion||worldBirth||surfaces;
assert.ok([linearMotion,worldBirth,surfaces,chargeRoots].filter(Boolean).length<=1,'Select one source review');
const mode=surfaces?'surfaces':worldBirth?'world-birth':linearMotion?'linear-motion':'mesh-alignment';
const directory='.cache/arkpedia/aphrissa-source/effects/'+(chargeRoots?'charge-roots':mode)+'-browser/';
const meta=JSON.parse(await readFile('data/arkpedia-aphrissa-'+mode+'.json')),
  bytes=await readFile(meta.fixture.path);
assert.equal(bytes.length,meta.fixture.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.fixture.sha256);
const profiles=JSON.parse(bytes),held=surfaces?Object.keys(profiles).filter(k=>![0,2].includes(profiles[k].data.InitialModule.startColor.minMaxState)):
  worldBirth?Object.keys(profiles).filter(k=>profiles[k].data.ShapeModule.enabled):[],
  disabled=surfaces?Object.keys(profiles).filter(k=>!profiles[k].rendererEnabled):[],
  roots=chargeRoots?['aphris_skill_03_charge_01','aphris_skill_03_charge_01_end']:
    componentReview?Object.keys(profiles).filter(k=>!held.includes(k)&&!disabled.includes(k)):[...new Set(Object.values(profiles).map(r=>r.root))];
const executablePath=process.env.ARKPEDIA_REVIEW_CHROME;
if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME; start preview-aphrissa-effects.mjs on port3185.');
await mkdir(directory,{recursive:true});
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage(),errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>failed.push(r.url()));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
try{
  await page.setViewport({width:1280,height:800});await page.setCacheEnabled(false);
  await page.goto('http://127.0.0.1:3185/',{waitUntil:'networkidle0'});
  const setup=await page.evaluate(async ({componentReview,worldBirth,surfaces,chargeRoots})=>{
    const T=await import('/vendor/three.module.js'),{createNativeEffectLibrary,compileNativeEffectPrograms}=await import('/arkpedia/native-effect-player.js');
    const {createEffectTrajectory}=await import('/shared/arkpedia/native-effect-trail.js');
    // Controlled external movement, not a recorded native actor trajectory.
    const trajectory=worldBirth?createEffectTrajectory([{time:0,position:[0,0,0]},{time:2,position:[1,0,0]}]):null;
    const manifest=await(await fetch('/review-assets/manifest.json')).json();
    const checked=async entry=>{
      const response=await fetch('/review-assets/'+entry.path);if(!response.ok)throw Error('Original review asset unavailable');
      const b=await response.arrayBuffer(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
      if(b.byteLength!==entry.bytes||digest!==entry.sha256)throw Error('Changed original review asset');return b;
    };
    const raw=await checked(manifest.effects.pack),pack=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
    const animations=JSON.parse(new TextDecoder().decode(await checked(manifest.animations.artifact))),
      shaders=JSON.parse(new TextDecoder().decode(await checked(manifest.shaders.artifact)));
    if(animations.sourcePackSha256!==manifest.effects.pack.sha256)throw Error('Changed original animation binding');
    const builtinMeshes=await(await fetch('/data/arkpedia-aphrissa-builtin-meshes.json')).json();
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setClearColor('#0b1116');
    document.querySelector('#scene').append(renderer.domElement);
    const programs=compileNativeEffectPrograms(renderer,shaders),scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.0001,1e6);
    camera.position.set(2,3,8);camera.lookAt(0,0,0);
    const lib=createNativeEffectLibrary({three:T,pack,animations,shaders,builtinMeshes,shaderGlobals:{_HG_UV_ROTATION:0},loadTexture:async entry=>{
      const url=URL.createObjectURL(new Blob([await checked(entry)],{type:'image/webp'}));
      try{return await new T.TextureLoader().loadAsync(url);}finally{URL.revokeObjectURL(url);}
    }});
    let current=null,clock=0,clip=null;
    const visible=part=>{for(let o=part;o;o=o.parent)if(!o.visible)return false;return true;};
    const bounds=()=>{
      const box=new T.Box3();current.group.updateMatrixWorld(true);
      for(const draw of current.draws)for(const part of draw.pool??[draw.mesh])if(visible(part)){
        part.geometry.computeBoundingBox();box.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));
      }
      return box;
    };
    const render=()=>{
      const width=innerWidth,height=innerHeight-48;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
      current.update(clock,{camera,clip,trajectory});renderer.render(scene,camera);
      const gl=renderer.getContext(),pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let count=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-11)+Math.abs(pixels[i+1]-17)+Math.abs(pixels[i+2]-22)>25)count++;
      if(gl.getError()!==gl.NO_ERROR)throw Error('Mesh inspection GL error');return count;
    };
    const select=async selection=>{
      const name=componentReview?selection.particle:selection;
      current?.dispose();current=await (componentReview?lib.inspectParticles(selection.root,{particles:[name]}):chargeRoots?lib.create(name):lib.inspectMeshParticles(name,{allowBlocked:true}));scene.add(current.group);
      if(chargeRoots){
        const enabled=[...current.pose.renderers].filter(([,r])=>r.enabled).map(([id])=>id).sort(),actual=current.draws.map(d=>d.component).sort();
        if(current.inspection!==null||current.blocked.length||JSON.stringify(actual)!==JSON.stringify(enabled))throw Error('Incomplete original charge-root coverage');
      }
      const sourceClips=[...new Set(current.pose.instances.map(i=>i.clip))],
        clips=worldBirth||chargeRoots?[...sourceClips,null]:[null,...sourceClips],attempts=[];let chosen=null;
      for(const candidate of clips){
        clip=candidate;
        for(const time of [.05,.15,.3,.6,1,2,3]){
          clock=time;current.update(clock,{camera,clip,trajectory});const box=bounds();
          if(box.isEmpty()||!Number.isFinite(box.min.length()+box.max.length())){attempts.push({clip,time,empty:true});continue;}
          const center=box.getCenter(new T.Vector3()),radius=Math.max(box.getSize(new T.Vector3()).length()/2,.01);
          camera.position.copy(center).add(new T.Vector3(.2,.15,1).normalize().multiplyScalar(radius*4));camera.lookAt(center);
          const pixels=render();attempts.push({clip,time,pixels,size:box.getSize(new T.Vector3()).toArray()});if(pixels>30){chosen={clock,clip,visiblePixels:pixels};break;}
        }
        if(chosen)break;
      }
      let sourceInactive=false;
      if(!chosen&&componentReview){
        const authored=current.pose.sample(0);
        sourceInactive=current.draws.length>0&&current.draws.every(d=>!authored.nodes.get(d.transform).visible);
        const inactiveOwners=new Set();
        for(const d of current.draws)for(let id=d.transform;id;id=authored.nodes.get(id).parent){
          const n=authored.nodes.get(id);if(!n.active)inactiveOwners.add(n.gameObject);
        }
        // Other recovered transform/material clips do not establish activation.
        // Never hide a potentially activating source binding behind this case.
        if(current.pose.instances.some(i=>i.bindings.some(b=>b.property==='m_IsActive'&&inactiveOwners.has(b.gameObject))))sourceInactive=false;
        if(sourceInactive){clock=.15;clip=null;chosen={clock,clip,visiblePixels:render()};
          if(chosen.visiblePixels!==0)throw Error('Authored inactive particle became visible');}
      }
      if(!chosen)throw Error('No visible original mesh particles in '+name+' '+JSON.stringify(attempts));
      document.querySelector('#status').textContent=name+' · original '+(componentReview?(surfaces?'surface':worldBirth?'world-birth':'linear-motion')+' component':chargeRoots?'complete charge root':'mesh-particle')+' inspection · native gameplay dispatch held';
      const snapshot=()=>JSON.stringify(current.draws.map(d=>{
        // Pools retain spare geometry after later emissions. Compare live
        // particles; every spare must be hidden after a reverse scrub.
        if(d.pool?.slice(d.lastParticles?.length??0).some(p=>p.visible))throw Error('Unused mesh particle remained visible');
        return {id:d.component,particles:d.lastParticles,matrices:d.pool?.slice(0,d.lastParticles?.length??0).map(p=>p.matrix.elements)};
      }));
      const before=snapshot(),saved=clock;clock+=.7;render();clock=saved;render();if(before!==snapshot())throw Error('Reverse mesh clock retained later state');
      let birthHistory;
      if(worldBirth){
        const points=new Map();let retained=0,prewarmed=0,fresh=0;
        birthHistory=[];
        for(const time of [0,.8,2,.8]){
          clock=time;render();const particles=current.draws.flatMap(d=>d.lastParticles??[]);
          for(const p of particles){
            if(!p.worldPosition?.every(Number.isFinite)||p.displacement.some(v=>v!==0))throw Error('Invalid straight World position');
            const old=points.get(p.id);
            if(old){if(old.some((v,axis)=>Math.abs(v-p.worldPosition[axis])>1e-9))throw Error('World particle followed its later emitter');retained++;}
            else points.set(p.id,p.worldPosition.slice());
            if(p.birthTime<0)prewarmed++;else fresh++;
          }
          if(current.draws.some(d=>d.pool.some(p=>!p.matrix.elements.every(Number.isFinite))))throw Error('Invalid World mesh transform');
          birthHistory.push({time,particles:particles.map(p=>({id:p.id,birthTime:p.birthTime,worldPosition:p.worldPosition}))});
        }
        if(!retained||!prewarmed||!fresh)throw Error('Incomplete World birth history');
        clock=saved;render();if(before!==snapshot())throw Error('World history retained later state');
      }
      return {root:componentReview?selection.root:name,...(componentReview?{particle:name}:{}),...chosen,sourceInactive,
        draws:current.draws.length,viewDraws:current.draws.filter(d=>d.alignment===0).length,
        blocked:current.blocked,inspection:current.inspection,reverseStable:true,...(birthHistory?{birthHistory}:{} )};
    };
    const verifyHeld=async ids=>{
      const result=[];
      for(const id of ids){
        let error=null;
        try{const i=await lib.inspectParticle(id);i.dispose();}catch(e){error=e.message;}
        const reason=worldBirth||surfaces?'Initial gradient clock needs review':'Native particle shape/direction needs review';
        if(!error?.includes(reason))throw Error('Changed source hold: '+id+' '+error);
        result.push({particle:id,reason});
      }
      return result;
    };
    const verifyDisabled=async selections=>{
      for(const selection of selections){
        const i=await lib.inspectParticles(selection.root,{particles:[selection.id]});
        try{if(i.draws.length||i.blocked.length)throw Error('Disabled source renderer became active');}finally{i.dispose();}
      }
      return selections.map(s=>s.id);
    };
    window.meshReview={select,render,verifyHeld,verifyDisabled,dispose:async()=>{lib.dispose();await Promise.resolve();renderer.render(scene,camera);return {...renderer.info.memory};}};
    return {compiledPrograms:programs.length,sourcePackSha256:manifest.effects.pack.sha256};
  },{componentReview,worldBirth,surfaces,chargeRoots});
  assert.equal(setup.compiledPrograms,14);assert.equal(setup.sourcePackSha256,meta.sourcePackSha256);
  const results=[],client=await page.createCDPSession();
  for(const root of roots){
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:false});await page.setViewport({width:1280,height:800});
    const desktop=await page.evaluate(selection=>meshReview.select(selection),componentReview?{particle:root,root:profiles[root].root}:root);
    if(componentReview){assert.deepEqual(desktop.inspection.particles,[root]);assert.ok(desktop.draws>0);assert.deepEqual(desktop.blocked,[]);
      assert.equal(desktop.sourceInactive,!profiles[root].gameObjectActive);}
    else if(chargeRoots){assert.equal(desktop.inspection,null);assert.deepEqual(desktop.blocked,[]);}
    else{
      const original=Object.keys(profiles).filter(id=>profiles[id].root===root),heldViews=desktop.blocked.filter(b=>original.includes(b.component));
      assert.equal(desktop.viewDraws,original.length);assert.deepEqual(heldViews,[]);
      desktop.heldViewProfiles=heldViews;
    }
    const label=componentReview?'particle-'+root.split(':').at(-1):root;
    await page.screenshot({path:directory+'desktop-'+label+'.png'});
    await page.setViewport({width:844,height:390});await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    const touch=await page.evaluate(()=>({visiblePixels:meshReview.render(),overflow:document.documentElement.scrollWidth>innerWidth,touchPoints:navigator.maxTouchPoints}));
    if(desktop.sourceInactive)assert.equal(touch.visiblePixels,0);else assert.ok(touch.visiblePixels>20);
    assert.equal(touch.overflow,false);assert.ok(touch.touchPoints>0);
    await page.screenshot({path:directory+'touch-'+label+'.png'});results.push({...desktop,touch});
    console.log(root+': original '+(componentReview?mode:chargeRoots?'complete charge root':'mesh/view particles')+' and reverse clock passed on desktop/touch');
  }
  const heldProfiles=await page.evaluate(ids=>meshReview.verifyHeld(ids),held);
  const disabledProfiles=await page.evaluate(selections=>meshReview.verifyDisabled(selections),disabled.map(id=>({id,root:profiles[id].root})));
  const cleanup=await page.evaluate(()=>meshReview.dispose());assert.equal(cleanup.geometries,0);assert.equal(cleanup.textures,0);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const report={driver:'Chromium software WebGL2',originalMeshInspection:!componentReview&&!chargeRoots,originalCompleteChargeRootInspection:chargeRoots,originalLinearMotionInspection:linearMotion,originalWorldBirthInspection:worldBirth,originalSurfaceInspection:surfaces,nativeFrameParity:false,fullEffectDispatchVerified:false,
    explicitShaderGlobals:{_HG_UV_ROTATION:0},...setup,results,heldProfiles,disabledProfiles,captures:results.length*2,cleanup,errors,failed,
    playerSha256:createHash('sha256').update(await readFile('public/arkpedia/native-effect-player.js')).digest('hex')};
  await writeFile(directory+'report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:results.length,captures:report.captures,cleanup,errors,failed}));
}finally{await browser.close();}
