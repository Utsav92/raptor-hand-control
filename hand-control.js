import {HandController,selectLeft} from './gestures.mjs';

const root=document.getElementById('raptor-lab'),$=id=>document.getElementById(id);
const video=$('hand-video'),overlay=$('hand-overlay'),ctx=overlay.getContext('2d');
const start=$('camera-start'),stop=$('camera-stop'),status=$('hand-status');
const controller=new HandController(),zero=()=>({x:0,y:0,z:0,yaw:0,pitch:0,roll:0});
const targets=new Map();let origin=zero(),worker,ready=false,active=false,stream=null,busy=false,session=0,lastSeen=0,lastFrame=0,lastVideo=-1,lastMessage=0,raf=0,initTimer,lastControlKey='engine';
const connections=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
function say(text){if(status.textContent!==text)status.textContent=text;}
function key(){return $('hand-target').value==='part'?'part:'+root.raptorHandControl.selectedPart():'engine';}
function reanchor(){controller.reset();origin={...(targets.get(key())||zero())};}
function color(token){const probe=document.createElement('span');probe.style.color='var('+token+')';document.body.appendChild(probe);const c=getComputedStyle(probe).color;probe.remove();return c;}
function draw(hands,selected){ctx.clearRect(0,0,overlay.width,overlay.height);for(const h of hands){const p=h.landmarks;ctx.strokeStyle=ctx.fillStyle=color(h===selected?'--primary':'--muted-foreground');ctx.lineWidth=h===selected?3:1.5;ctx.globalAlpha=h===selected?1:.45;ctx.beginPath();for(const[a,b]of connections){ctx.moveTo(p[a].x*overlay.width,p[a].y*overlay.height);ctx.lineTo(p[b].x*overlay.width,p[b].y*overlay.height);}ctx.stroke();for(const point of p){ctx.beginPath();ctx.arc(point.x*overlay.width,point.y*overlay.height,h===selected?3.5:2,0,Math.PI*2);ctx.fill();}}ctx.globalAlpha=1;}
function consume(hands,time){
  if(key()!==lastControlKey){reanchor();lastControlKey=key();}
  const left=selectLeft(hands,$('hand-swap').checked);draw(hands,left);
  if(!left){if(time-lastSeen>450){controller.reset();$('hand-gesture').textContent='No left hand';$('hand-open').textContent='—';say(hands.length?'Show your left hand · view held':'Hand lost · view held');}return;}
  lastSeen=time;const result=controller.update(left,time);
  if(result.newTrack)origin={...(targets.get(key())||zero())};
  if(result.command!==null)root.raptorHandControl.setExplosion(result.command);
  const pose={};for(const k of ['x','y','z','yaw','pitch','roll'])pose[k]=origin[k]+result[k];
  root.raptorHandControl.setPose($('hand-target').value,pose);targets.set(key(),pose);
  if(time-lastMessage>120){$('hand-open').textContent=Math.round(result.open*100)+'%';$('hand-gesture').textContent=result.gesture==='open'?'Open palm':result.gesture==='closed'?'Fist':'Transition';say('Left hand tracked · '+(result.gesture==='open'?'explode':result.gesture==='closed'?'assemble':'hold'));lastMessage=time;}
}
function initializeWorker(){
  worker=new Worker(new URL('./hand-worker.js',import.meta.url),{type:'module'});
  initTimer=setTimeout(()=>{if(!ready){say('Tracker is taking longer to load. Reload to retry.');}},25000);
  worker.onmessage=({data})=>{
    if(data.type==='ready'){clearTimeout(initTimer);ready=true;start.disabled=false;say('Ready · camera off');return;}
    if(data.type==='error'){clearTimeout(initTimer);say(data.message);return;}
    if(data.session!==session)return;
    busy=false;
    if(data.type==='frame-error'){say('Tracking error: '+data.message);stopCamera(false);return;}
    if(data.type==='result'&&active){const now=performance.now();if(now-data.timestamp<500)consume(data.hands,now);}
  };
  worker.onerror=event=>{say('Hand tracker error: '+event.message);clearTimeout(initTimer);stopCamera(false);};
}
async function loop(now){
  if(!active)return;
  raf=requestAnimationFrame(loop);
  if(document.hidden||busy||now-lastFrame<1000/24||video.readyState<2||video.currentTime===lastVideo)return;
  busy=true;lastFrame=now;lastVideo=video.currentTime;const capturedSession=session;
  try{const bitmap=await createImageBitmap(video);if(!active||capturedSession!==session){bitmap.close();busy=false;return;}worker.postMessage({type:'frame',bitmap,timestamp:performance.now(),session},[bitmap]);}
  catch(error){busy=false;say('Camera frame error: '+error.message);stopCamera(false);}
}
async function startCamera(){
  if(!ready||active)return;
  if(!navigator.mediaDevices?.getUserMedia){say('Open this localhost page in Chrome or Edge to use the webcam.');return;}
  start.disabled=true;say('Allow camera access in your browser…');session++;const requestedSession=session;
  try{
    const requestedStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}},audio:false});
    if(requestedSession!==session){requestedStream.getTracks().forEach(t=>t.stop());return;}
    stream=requestedStream;video.srcObject=stream;await video.play();
    overlay.width=video.videoWidth||640;overlay.height=video.videoHeight||480;active=true;busy=false;stop.disabled=false;start.textContent='Camera on';$('camera-placeholder').hidden=true;lastSeen=performance.now();lastFrame=0;lastVideo=-1;reanchor();say('Show your left palm to begin');
    stream.getVideoTracks()[0].addEventListener('ended',()=>stopCamera(),{once:true});raf=requestAnimationFrame(loop);
  }catch(error){stream?.getTracks().forEach(t=>t.stop());stream=null;start.disabled=false;start.textContent='Start camera';say(error.name==='NotAllowedError'?'Camera permission denied. Allow access in the browser, then retry.':error.name==='NotFoundError'?'No webcam found. Connect a camera, then retry.':'Camera could not start: '+error.message);}
}
function stopCamera(announce=true){active=false;session++;cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;busy=false;stop.disabled=true;start.disabled=!ready;start.textContent='Start camera';$('camera-placeholder').hidden=false;ctx.clearRect(0,0,overlay.width,overlay.height);controller.reset();$('hand-gesture').textContent='—';$('hand-open').textContent='—';if(announce)say('Camera off · mouse controls available');}
start.addEventListener('click',startCamera);stop.addEventListener('click',()=>stopCamera());
$('hand-recenter').addEventListener('click',()=>{reanchor();say(active?'Hold your left palm in the new neutral position':'Start the camera to set a neutral hand position');});
$('hand-reset').addEventListener('click',()=>{root.raptorHandControl.resetPose();targets.clear();reanchor();});
$('hand-target').addEventListener('change',()=>{reanchor();$('target-help').textContent=$('hand-target').value==='part'?'Choose an assembly under Inspect, then move or rotate your hand. Open/close still controls all parts.':'All assemblies move together. Open/close always controls the full exploded view.';});
$('r-part').addEventListener('change',reanchor);root.addEventListener('click',e=>{if(e.target.closest('.r-tag')&&$('hand-target').value==='part')reanchor();});
$('hand-swap').addEventListener('change',reanchor);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)stopCamera();});
window.addEventListener('pagehide',()=>{stopCamera(false);worker?.terminate();clearTimeout(initTimer);},{once:true});
if(!root.raptorHandControl){say('The 3D engine did not initialize. Reload to retry.');}
else initializeWorker();
// Synthetic validation is exposed only when explicitly running the local test page.
if(new URL(location.href).searchParams.has('test'))window.raptorGestureTest={consume,controller,isActive:()=>active,isReady:()=>ready};
