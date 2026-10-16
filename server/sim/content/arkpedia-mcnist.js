// SPDX-License-Identifier: GPL-3.0-or-later
// One selected composition for all three source skills; public admission is separate.
import {MCNIST_ID as ID,MCNIST_SKILLS} from './arkpedia-mcnist-source.js';
import {prepareMechanistS1,MCNIST_S1_CONTRACT} from './arkpedia-mcnist-s1.js';
import {prepareMechanistS2,MCNIST_S2_CONTRACT} from './arkpedia-mcnist-s2.js';
import {prepareMechanistS3Owner,MCNIST_S3_OWNER_CONTRACT} from './arkpedia-mcnist-s3-owner.js';
import {prepareMcGrafLifecycle,MCGRAF_LIFECYCLE_CONTRACT} from './arkpedia-mcgraf-lifecycle.js';
import {prepareMcGrafS3Lifecycle,MCGRAF_S3_LIFECYCLE_CONTRACT} from './arkpedia-mcgraf-s3-lifecycle.js';
import {MCGRAF_ATTACK_CONTRACT} from './arkpedia-mcnist-attacks.js';
export const MCNIST_CONTRACT=Object.freeze({
 scope:'Selected original Mechanist owner/McGraf, all three source skills, independent deployment, barriers, original clocks and complete S3 charge/replacement composition; no public admission',
 mapping:'Dispatches the selected source skill to its exact contracted owner controller. After owner resources/ordinary clock installation, E1+ installs either the original S1/S2 McGraf card with its distinct melee clock or the separately reviewed S3 lifecycle. S3 composes manual/current-token charge, legal fresh replacement and the source-owned decaying aura. E0 has no token card. Children retain their own source-life and finite born-work cleanup rules.',
 limits:'All child contracts retain their explicit native dispatch, callback, geometry, cooldown, damage transport and timing interpretations. Modules, native particles/audio and original game-frame/pixel parity remain unverified. This selected composition alone cannot approve a public roster entry, dataset build, asset pin or browser result.',
 frameParity:false,moduleSupport:false,nativeParticleSupport:false,
});
export function prepareMechanist(b,u,{contract}={}){
 if(contract!==MCNIST_CONTRACT||u.def.charId!==ID||u.mem.mcnist)throw Error('Fresh selected Mechanist and exact composition contract required');
 const index=MCNIST_SKILLS.indexOf(u.def.skill?.id);if(index<0)throw Error('Original selected Mechanist skill required');
 const factories=[prepareMechanistS1,prepareMechanistS2,prepareMechanistS3Owner],contracts=[MCNIST_S1_CONTRACT,MCNIST_S2_CONTRACT,MCNIST_S3_OWNER_CONTRACT],selected=factories[index](b,u,{contract:contracts[index]}),
  controller=new Mechanist(b,u,selected,index);u.mem.mcnist=controller;return{...selected,controller,kit:selected.kit};
}
export class Mechanist{
 constructor(b,u,selected,index){Object.assign(this,{b,u,owner:selected.controller,resources:selected.resources,record:selected.record,index,deck:null,installed:false});}
 get stopped(){return this.owner.stopped;}
 valid(){return this.owner.valid();}
 install(){if(this.installed||this.stopped)throw Error('Mechanist selected composition cannot be reinstalled');this.installed=true;
  try{this.owner.install();if(this.record.build.elite>0){
   this.deck=this.index===2?prepareMcGrafS3Lifecycle(this.b,this.u,{contract:MCGRAF_S3_LIFECYCLE_CONTRACT,owner:this.owner})
    :prepareMcGrafLifecycle(this.b,this.u,{contract:MCGRAF_LIFECYCLE_CONTRACT,barriers:this.resources,combatContract:MCGRAF_ATTACK_CONTRACT});
   this.deck.install();
  }}catch(error){this.stop();throw error;}
 }
 stop(end=false){this.deck?.stop();if(end&&this.deck?.transports)for(const f of [...this.deck.transports])this.deck.finishTransport(f);this.owner.stop(end);}
}
