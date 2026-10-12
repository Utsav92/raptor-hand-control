import assert from 'node:assert/strict';
import {HandController,openness,selectLeft} from '../gestures.mjs';

export function hand(open=true,label='Left'){
  const p=Array.from({length:21},()=>({x:.5,y:.8,z:0}));
  p[0]={x:.5,y:.8,z:0};
  for(let i=0;i<4;i++){
    const m=5+i*4,x=.37+i*.09;
    p[m]={x,y:.57,z:0};
    p[m+1]={x,y:.40,z:0};
    p[m+2]={x,y:open?.28:.47,z:open?0:-.06};
    p[m+3]={x,y:open?.18:.62,z:open?0:-.05};
  }
  p[1]={x:.40,y:.72,z:0};p[2]={x:.32,y:.63,z:0};p[3]={x:.25,y:.55,z:0};p[4]={x:.19,y:.48,z:0};
  return {label,score:.98,landmarks:p,worldLandmarks:p.map(q=>({...q}))};
}
const open=hand(true),closed=hand(false);
assert(openness(open.landmarks)>.9,'Open palm must classify as open');
assert(openness(closed.landmarks)<.2,'Fist must classify as closed');
assert.equal(selectLeft([hand(true,'Right')]),null,'Right hand cannot drive the engine');
assert.equal(selectLeft([hand(true,'Right')],true).label,'Right','Mirrored driver swap works');
const c=new HandController();
assert.equal(c.update(open,0).command,null,'No single-frame gesture trigger');
assert.equal(c.update(open,100).command,null,'Dwell suppresses jitter');
assert.equal(c.update(open,200).command,1,'Stable open triggers explode');
assert.equal(c.update(closed,240).command,null);
assert.equal(c.update(closed,440).command,0,'Stable fist triggers assemble');
const moved=hand(true);
moved.landmarks=moved.landmarks.map(p=>({...p,x:p.x+.15,y:p.y-.10}));
let movedResult;
for(let i=0;i<10;i++)movedResult=c.update(moved,500+i*50);
assert(movedResult.x>.8&&movedResult.y>.5,'Hand motion becomes model translation');
const rotated=hand(true),angle=.5;
rotated.worldLandmarks=rotated.worldLandmarks.map(p=>({x:(p.x-.5)*Math.cos(angle)+.5,y:p.y,z:-(p.x-.5)*Math.sin(angle)}));
let rotatedResult;
for(let i=0;i<10;i++)rotatedResult=c.update(rotated,1100+i*50);
assert(Math.abs(rotatedResult.yaw)>.5,'Palm normal drives yaw');
console.log('PASS: open/fist, gesture dwell, left-hand filtering, mirrored input, translation and palm rotation');
