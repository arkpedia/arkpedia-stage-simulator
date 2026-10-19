// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled shared runtime/HUD verification on an admitted operator. This is
// not a Makoto candidate, source-combat review or public roster admission.
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3184',out='.cache/arkpedia/reviews/native-manual-permission/',ID='char_208_melan';
const data=JSON.parse(await readFile('data/arkpedia-mvp.json'));data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},allowed:false,timer:false,starts:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;battle.on('skillStart',h=>{if(h.unit===this.owner)this.starts.push({activation:h.activation,reason:h.reason});});
 const label=document.createElement('div');label.textContent='CONTROLLED SHARED HUD CHECK · Melantha / empty waves / no SP recovery · NOT MAKOTO ADMISSION';label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);},
 prepare(){const u=this.owner,sk=u.skill;sk.setSpTotal(0);battle.addBuff(u,{key:'qa:native-permission-sp-stop',flags:{noSp:true}});
 sk.spec.manualCastWithoutSp=()=>this.allowed;sk.spec.manualTriggerOnly=()=>this.allowed;sk.spec.formCountdown=()=>this.timer?{remaining:10,duration:20,label:'Controlled form',canActivate:this.allowed}:null;
 this.timer=true;this.render();},
 restore(){const sk=this.owner.skill;sk.end('controlled-fixture-end');this.allowed=false;this.timer=false;delete sk.spec.manualCastWithoutSp;delete sk.spec.manualTriggerOnly;delete sk.spec.formCountdown;this.render();},
 snapshot(){const u=this.owner,sk=u.skill,button=document.querySelector('#skill'),box=button.getBoundingClientRect();return{hud:skillHud(sk),sp:sk.spTotal,charges:sk.charges,active:sk.active,activations:sk.activations,starts:this.starts,atk:u.s.atk,
 button:{disabled:button.disabled,ready:button.classList.contains('ready'),label:button.getAttribute('aria-label'),text:button.innerText,box:{x:box.x,y:box.y,width:box.width,height:box.height}},errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true]){
 const label=mobile?'phone':'desktop',{page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:'skchr_melan_1'});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,3,4,mobile?'UP':'RIGHT');await page.click(`#deployment [data-id="${ID}"]`);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 await page.evaluate(()=>cnReview.prepare());const before=await page.evaluate(()=>cnReview.snapshot());await capture('permission-off');assert.equal(before.sp,0);assert.equal(before.charges,0);assert.equal(before.hud.ready,false);assert.equal(before.button.disabled,true);
 await page.evaluate(()=>{cnReview.allowed=true;cnReview.render();});const ready=await page.evaluate(()=>cnReview.snapshot());await capture('zero-sp-ready');assert.equal(ready.hud.ready,true);assert.equal(ready.hud.canActivate,true);assert.equal(ready.button.disabled,false);assert.equal(ready.button.ready,true);assert.equal(ready.sp,0);assert.equal(ready.charges,0);assert.match(ready.button.text,/READY/);
 if(mobile)await page.tap('#skill');else await page.click('#skill');await page.waitForFunction(()=>cnReview.owner.skill.activations===1);await page.evaluate(()=>cnReview.render());
 const cast=await page.evaluate(()=>cnReview.snapshot());await capture('accepted-cast');assert.equal(cast.active,true);assert.equal(cast.sp,0);assert.equal(cast.charges,0);assert.equal(cast.activations,1);assert.deepEqual(cast.starts,[{activation:1,reason:'manual'}]);assert.equal(cast.button.disabled,true);assert.equal(cast.hud.ready,false);assert.ok(cast.atk>before.atk);
 await page.evaluate(()=>cnReview.restore());const ended=await page.evaluate(()=>cnReview.snapshot());await capture('restored-normal');assert.equal(ended.active,false);assert.equal(ended.hud.ready,false);assert.equal(ended.sp,0);assert.equal(ended.button.disabled,true);
 for(const state of[before,ready,cast,ended]){assert.deepEqual(state.errors,[]);assert.equal(state.glError,0);for(const key of['x','y','width','height'])assert.ok(Math.abs(state.button.box[key]-before.button.box[key])<.5,`${label} stable ${key}`);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,before,ready,cast,ended});await page.close();console.log(label+': actual deployment/swipe, zero-SP ready control, one real cast, normal restoration and stable button geometry passed');
 }
 await writeFile(out+'report.json',JSON.stringify({scope:'Controlled shared native cast permission/HUD on admitted Melantha; not Makoto gameplay/public admission',browserVersion:driver.browserVersion,sourceOrigin:driver.sourceOrigin,fixtureOrigin:driver.fixtureOrigin,cacheDisabled:driver.cacheDisabled,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
