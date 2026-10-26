import { test } from "node:test";
import assert from "node:assert/strict";
import { spriteFacing } from "../shared/arkpedia/facing.js";
import { swipeFacing, facingPickerLayout } from "../shared/arkpedia/placement.js";

test('edge-facing controls stay above the shelf and outside the central drag handle',()=>{
  for(const [width,height,shelfTop]of [[844,390,298],[1440,900,780],[1024,600,480]])
    for(const [x,y]of [[30,80],[width-30,80],[438,shelfTop-48],[width-30,shelfTop-30]]){
      const point={x,y,s:50},layout=facingPickerLayout(point,{width,height,shelfTop}),half=layout.handleSize/2;
      assert.deepEqual(point,{x,y,s:50});
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const button={x:layout.center.x+dx*layout.spread,y:layout.center.y+dy*layout.spread};
        assert.ok(button.x>=24-1e-8&&button.x<=width-24+1e-8);assert.ok(button.y>=76-1e-8&&button.y<=shelfTop-26+1e-8);
        assert.ok(Math.abs(button.x-layout.center.x)>=half+22||Math.abs(button.y-layout.center.y)>=half+22,'44px arrow must not overlap the handle');
        const dir=dx===1?'RIGHT':dx===-1?'LEFT':dy===1?'DOWN':'UP';assert.equal(swipeFacing(button,layout.center),dir);
      }
    }
});
import { StandardBattle } from "../server/sim/arkpedia.js";
import data from "../data/arkpedia-mvp.json" with { type: "json" };
import { defaultBuild } from "../shared/arkpedia/loadout.js";

test("enemy sprite follows movement instead of its fixed deploy direction, preserving waits and vertical legs", () => {
  const unit = {
    side: "enemy",
    dir: "RIGHT",
    x: 7,
    route: { legIdx: 0, legs: [{ t: "move", c: 6 }] },
  };
  assert.equal(spriteFacing(unit), -1);
  assert.equal(spriteFacing(unit, { x: 8, facing: 1 }), -1);
  assert.equal(spriteFacing({ ...unit, x: 8 }, { x: 7, facing: -1 }), 1);
  assert.equal(spriteFacing(unit, { x: 7, facing: -1 }), -1);
  assert.equal(
    spriteFacing(
      { ...unit, blockedBy: { alive: true, x: 8 } },
      { x: 7, facing: -1 },
    ),
    1,
  );
  assert.equal(spriteFacing({ side: "ally", dir: "LEFT" }), -1);
});

test("0-1 enemies face left at spawn and through every unblocked route tick", () => {
  const battle = new StandardBattle(data, {
    operators: [defaultBuild(data.operators.char_123_fang)],
  });
  const views = new Map();
  let samples = 0;
  for (let i = 0; i < 3000 && !battle.finished; i++) {
    battle.step();
    for (const unit of battle.units.filter((u) => u.side === "enemy" && u.alive)) {
      const facing = spriteFacing(unit, views.get(unit.id));
      assert.equal(facing, -1, `${unit.defId} at ${unit.x},${unit.y}`);
      views.set(unit.id, { x: unit.x, facing });
      samples++;
    }
  }
  assert.ok(samples > 1000);
});

test("second-gesture direction uses its handle origin, not the map tile or a hovered arrow", () => {
  for (const origin of [{ x: 600, y: 400 }, { x: 70, y: 70 }]) {
    for (const [dx, dy, dir] of [
      [70, 0, "RIGHT"],
      [-70, 0, "LEFT"],
      [0, -70, "UP"],
      [0, 70, "DOWN"],
    ]) {
      assert.equal(swipeFacing({ x: origin.x + dx, y: origin.y + dy }, origin), dir);
    }
    assert.equal(swipeFacing({ x: origin.x + 10, y: origin.y + 5 }, origin), null);
    assert.equal(swipeFacing(origin, origin), null);
  }
});
