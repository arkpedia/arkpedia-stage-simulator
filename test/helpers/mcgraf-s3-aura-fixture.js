// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {make as barriers,enemy} from './mcnist-barrier-fixture.js';
import {SkillRuntime} from '../../server/sim/skills.js';
import {normalizeToken} from '../../server/sim/simdata.js';
import {MCGRAF_ID as TOKEN} from '../../server/sim/content/arkpedia-mcnist-source.js';
import {selectedMcGrafBuild} from '../../server/sim/content/arkpedia-mcgraf-source.js';
import {prepareMcGrafS3Aura,MCGRAF_S3_AURA_CONTRACT} from '../../server/sim/content/arkpedia-mcgraf-s3-aura.js';
export {enemy,advance,near} from './mcnist-barrier-fixture.js';
// This fixture explicitly supplies a duration-only host and source-linked token.
// It neither installs nor claims the still-held S3 owner/charge/lifetime adapter.
export function make({rank=10,potential=1,dir='RIGHT',active=true,install=true,withEnemy=true,contract=MCGRAF_S3_AURA_CONTRACT}={}){
 const f=barriers({skill:3,rank,potential,dir});
 f.u.skill=new SkillRuntime(f.b,f.u,f.u.def.skill,{kind:'duration',duration:40,trigger:{rule:'NEVER'}});f.u.skill.reset();
 if(active){f.u.skill.sp=f.u.skill.spCost;f.u.skill.charges=1;assert.equal(f.u.skill.activate('MANUAL'),true);}
 const r=selectedMcGrafBuild(f.build),def=normalizeToken(TOKEN,{name:r.source.appellation,position:r.source.position,profession:r.source.profession,
  stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,arkpedia:{...r.build},skill:null});
 f.t=f.b.spawnToken(f.u,TOKEN,5,7,{dir,def,kit:{trait:{noAttack:true},talents:[],skill:null,install:(_b,t)=>{t.deploymentSlotCost=0;f.resources.registerToken(t);}}});
 if(withEnemy){f.e=enemy(f,{x:f.t.x+1,y:f.t.y});f.e.base.atk=1000;f.e.markDirty();}
 if(install){f.aura=prepareMcGrafS3Aura(f.b,f.t,{contract,barriers:f.resources});assert.equal(f.aura.install(),true);}return f;
}
