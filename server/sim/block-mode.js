// SPDX-License-Identifier: GPL-3.0-or-later
// Original ChangeCharBlockMode is a command, separate from a buff's lifetime.
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
export function explicitBlockMode(u){const p=u?.mem?.regularBlockMode;return p&&p.life===u?.deploySeq?p.mode:null;}
export function commandBlockMode(b,u,mode,owner){
 if(!['WALK','FLY'].includes(mode)||!owner)throw Error('Explicit source block mode and owner required');
 if(b.finished||!present(u))return null;
 const p={mode,owner,life:u.deploySeq};u.mem.regularBlockMode=p;
 // A mode switch releases the incompatible old block, but retains the selected
 // skill input separately in its controller. No new contact is invented here.
 for(const e of u.blocking.slice())if((mode==='FLY')!==e.isFlying)b._unblock(e);
 if(b._hooks.blockModeChanged)b.emit('blockModeChanged',{unit:u,mode});
 return p;
}
export function clearBlockMode(b,u,p){
 if(!p||u.mem.regularBlockMode!==p)return false;delete u.mem.regularBlockMode;
 if(u.deploySeq===p.life){b.releaseBlocked(u);if(!b.finished&&b._hooks.blockModeChanged)b.emit('blockModeChanged',{unit:u,mode:null});}
 return true;
}
