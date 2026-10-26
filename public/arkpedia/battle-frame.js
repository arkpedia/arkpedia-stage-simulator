// SPDX-License-Identifier: GPL-3.0-or-later
// The visual combat delta follows completed engine ticks. Presentation time
// during an owned hold never accumulates into a later catch-up burst.
export function stepBattleFrame(battle,accumulator,real,speed){
 if(battle.simulationHeld)return{accumulator:0,dt:0,events:[]};
 let dt=0;accumulator+=real*speed;
 while(accumulator>=battle.dt&&!battle.finished&&!battle.simulationHeld){
  const before=battle.tickCount;battle.step();
  if(battle.tickCount===before){accumulator=0;break;}
  accumulator-=battle.dt;dt+=battle.dt;
 }
 if(battle.simulationHeld)accumulator=0;
 return{accumulator,dt,events:battle.drainEvents()};
}
