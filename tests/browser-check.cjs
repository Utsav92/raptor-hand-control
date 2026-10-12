const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.RAPTOR_PLAYWRIGHT_PATH||'playwright');

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1380,height:1100}});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const remote=[];page.on('request',r=>{if(!r.url().startsWith('http://localhost:54821/')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))remote.push(r.url());});
 await page.goto('http://localhost:54821/?test=1');
 await page.waitForFunction(()=>window.raptorGestureTest?.isReady(),{timeout:30000});
 assert.equal(await page.locator('#camera-start').isEnabled(),true);
 const fixture=await page.evaluate(async()=>{
  const image=new Image();image.src='/tests/right_hands.jpg';await image.decode();
  const infer=mirror=>new Promise((resolve,reject)=>{
   const w=new Worker('/hand-worker.js',{type:'module'});
   const timeout=setTimeout(()=>{w.terminate();reject(Error('Inference timeout'));},30000);
   async function send(){const c=new OffscreenCanvas(image.width,image.height),cx=c.getContext('2d');if(mirror){cx.translate(c.width,0);cx.scale(-1,1);}cx.drawImage(image,0,0);const bitmap=await createImageBitmap(c);w.postMessage({type:'frame',bitmap,timestamp:performance.now(),session:1},[bitmap]);}
   w.onmessage=async({data})=>{if(data.type==='ready')await send();else if(data.type==='result'){clearTimeout(timeout);w.terminate();resolve(data.hands);}else if(data.type.includes('error')){clearTimeout(timeout);w.terminate();reject(Error(data.message));}};
  });
  return [await infer(false),await infer(true)];
 });
 assert(fixture[0].length>0&&fixture[0].every(h=>h.label==='Right'),'Anatomical right-hand fixture must remain Right after mirrored inference');
 assert(fixture[1].length>0&&fixture[1].every(h=>h.label==='Left'),'Mirrored fixture must map to anatomical Left');
 assert(fixture.flat().every(h=>h.landmarks.length===21));
 await page.evaluate(async()=>{
  const {HandController,openness}=await import('/gestures.mjs');
  const make=(open=true)=>{const p=Array.from({length:21},()=>({x:.5,y:.8,z:0}));for(let i=0;i<4;i++){const m=5+i*4,x=.37+i*.09;p[m]={x,y:.57,z:0};p[m+1]={x,y:.4,z:0};p[m+2]={x,y:open?.28:.47,z:open?0:-.06};p[m+3]={x,y:open?.18:.62,z:open?0:-.05};}return {label:'Left',score:.98,landmarks:p,worldLandmarks:p.map(q=>({...q}))};};
  window.syntheticHand=make;
  const t=performance.now(),test=window.raptorGestureTest;
  test.consume([make(true)],t);test.consume([make(true)],t+220);
 });
 assert.equal(await page.locator('#raptor-lab').evaluate(el=>el.raptorSnapshot().parameters.explode),1,'Stable open hand explodes actual model');
 await page.evaluate(()=>{const test=window.raptorGestureTest,t=performance.now();const h=window.syntheticHand(false);test.consume([h],t+500);test.consume([h],t+750);});
 assert.equal(await page.locator('#raptor-lab').evaluate(el=>el.raptorSnapshot().parameters.explode),0,'Stable fist assembles actual model');
 await page.evaluate(()=>{
  const t=performance.now(),test=window.raptorGestureTest;
  for(let i=0;i<12;i++){const h=window.syntheticHand(true);h.landmarks=h.landmarks.map(p=>({...p,x:p.x+.1,y:p.y-.08}));h.worldLandmarks=h.worldLandmarks.map(p=>({x:(p.x-.5)*Math.cos(.5)+.5,y:p.y,z:-(p.x-.5)*Math.sin(.5)}));test.consume([h],t+1000+i*50);}
 });
 const whole=await page.locator('#raptor-lab').evaluate(el=>el.raptorHandControl.poseSnapshot().whole);
 assert(whole.position.some(v=>Math.abs(v)>.1)&&whole.rotation.some((v,i)=>i<3&&Math.abs(v)>.1),'Translation and rotation reach engine transform');
 await page.getByRole('combobox',{name:'Move and rotate'}).selectOption('part');
 await page.getByRole('combobox',{name:'Inspect an engine assembly'}).selectOption('nozzle');
 await page.evaluate(()=>{const t=performance.now(),test=window.raptorGestureTest;test.consume([window.syntheticHand(true)],t+2000);for(let i=0;i<12;i++){const h=window.syntheticHand(true);h.landmarks=h.landmarks.map(p=>({...p,x:p.x+.1}));test.consume([h],t+2050+i*50);}});
 const piece=await page.locator('#raptor-lab').evaluate(el=>el.raptorHandControl.poseSnapshot().parts);
 assert.equal(piece.length,1);assert.equal(piece[0].id,'nozzle');assert(piece[0].position.some(v=>Math.abs(v)>.1));
 const before=await page.locator('#raptor-lab').evaluate(el=>JSON.stringify(el.raptorHandControl.poseSnapshot()));
 await page.evaluate(()=>window.raptorGestureTest.consume([],performance.now()+8000));
 assert.equal(await page.locator('#raptor-lab').evaluate(el=>JSON.stringify(el.raptorHandControl.poseSnapshot())),before,'Tracking loss holds the last pose');
 await page.evaluate(()=>{const h=window.syntheticHand(true);h.label='Right';window.raptorGestureTest.consume([h],performance.now()+9000);});
 assert.equal(await page.locator('#raptor-lab').evaluate(el=>JSON.stringify(el.raptorHandControl.poseSnapshot())),before,'Right-hand input cannot move parts');
 await page.getByRole('button',{name:'Reset view',exact:true}).click();
 assert.equal((await page.locator('#raptor-lab').evaluate(el=>el.raptorHandControl.poseSnapshot().parts)).length,0);

 // Exercise camera start/stop using a generated video stream, never the real webcam.
 await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;c.getContext('2d').fillRect(0,0,640,480);window.syntheticStream=c.captureStream(12);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>window.syntheticStream});});
 await page.getByRole('button',{name:'Start camera',exact:true}).click();
 await page.waitForFunction(()=>window.raptorGestureTest.isActive());
 await page.getByRole('button',{name:'Stop',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.syntheticStream.getTracks().every(t=>t.readyState==='ended')),true,'Stop releases the generated camera track');
 assert.equal(await page.evaluate(()=>window.raptorGestureTest.isActive()),false);
 await page.evaluate(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{throw new DOMException('Denied','NotAllowedError');}});});
 await page.getByRole('button',{name:'Start camera',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('hand-status').textContent.includes('permission denied'));
 assert.equal(await page.locator('#camera-start').isEnabled(),true,'Denied camera can be retried');
 await page.screenshot({path:'output/playwright/raptor-hand-validated.png',fullPage:true});
 await page.setViewportSize({width:360,height:1500});
 await page.screenshot({path:'output/playwright/raptor-hand-mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No mobile horizontal overflow');
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[],'No remote runtime requests');
 const report={passed:true,assemblies:20,realModelInference:{rightLabels:fixture[0].map(h=>h.label),leftLabels:fixture[1].map(h=>h.label),landmarksPerHand:21},checks:['open/fist assembly','palm rotation','hand translation','individual part movement','tracking-loss freeze','right-hand exclusion','camera start/stop with synthetic stream','permission denial/retry','mobile layout','no remote requests'],actualWebcamTested:false};
 fs.writeFileSync(path.join(__dirname,'validation.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
