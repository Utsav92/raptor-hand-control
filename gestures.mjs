const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:(a.z||0)-(b.z||0)});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const norm=v=>Math.sqrt(dot(v,v));
const unit=v=>{const n=norm(v)||1;return{x:v.x/n,y:v.y/n,z:v.z/n};};
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const dist=(a,b)=>norm(sub(a,b));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const joint=(a,b,c)=>Math.acos(clamp(dot(unit(sub(a,b)),unit(sub(c,b))),-1,1));

export function openness(points){
  if(!points||points.length!==21)return 0;
  const values=[5,9,13,17].map(i=>{
    const straight=Math.min(joint(points[i],points[i+1],points[i+2]),joint(points[i+1],points[i+2],points[i+3]));
    const extension=dist(points[i+3],points[0])/Math.max(.001,dist(points[i+1],points[0]));
    return Math.min(clamp((straight-1.6)/1.25,0,1),clamp((extension-1.02)/.25,0,1));
  });
  return values.reduce((a,b)=>a+b,0)/4;
}

export function selectLeft(hands,swap=false){
  const wanted=swap?'Right':'Left';
  return hands.filter(h=>h.label===wanted&&h.score>=.65&&h.landmarks?.length===21).sort((a,b)=>b.score-a.score)[0]||null;
}

export function palmPose(hand){
  const p=hand.landmarks,w=hand.worldLandmarks?.length===21?hand.worldLandmarks:p;
  const across=unit(sub(w[5],w[17])),up=unit(sub(w[9],w[0])),normal=unit(cross(across,up));
  const center={x:(p[0].x+p[5].x+p[9].x+p[17].x)/4,y:(p[0].y+p[5].y+p[9].y+p[17].y)/4};
  return {...center,size:Math.max(.025,dist(p[5],p[17])),yaw:Math.atan2(normal.x,normal.z),pitch:Math.atan2(normal.y,Math.hypot(normal.x,normal.z)),roll:Math.atan2(up.x,-up.y)};
}

export class HandController{
  constructor(){this.reset();}
  reset(){this.baseline=null;this.filtered=null;this.lastTime=null;this.candidate=null;this.candidateSince=0;this.lastCommand=null;}
  update(hand,time){
    const raw=palmPose(hand),open=openness(hand.worldLandmarks?.length===21?hand.worldLandmarks:hand.landmarks);
    const newTrack=!this.baseline;
    if(newTrack){this.baseline={...raw};this.filtered={...raw};this.lastTime=time;}
    const dt=clamp((time-this.lastTime)/1000,.001,.12),alpha=1-Math.exp(-dt/.07);this.lastTime=time;
    for(const k of ['x','y','size'])this.filtered[k]+=(raw[k]-this.filtered[k])*alpha;
    for(const k of ['yaw','pitch','roll'])this.filtered[k]+=wrap(raw[k]-this.filtered[k])*alpha;
    const candidate=open>.72?'open':open<.24?'closed':'hold';
    if(candidate!==this.candidate){this.candidate=candidate;this.candidateSince=time;}
    let command=null;
    if(candidate!=='hold'&&time-this.candidateSince>=180&&candidate!==this.lastCommand){command=candidate==='open'?1:0;this.lastCommand=candidate;}
    const f=this.filtered,b=this.baseline;
    return{newTrack,open,gesture:candidate,command,x:clamp((f.x-b.x)*7,-3,3),y:clamp((b.y-f.y)*7,-3,3),z:clamp(Math.log(f.size/b.size)*3,-2.5,2.5),yaw:clamp(wrap(f.yaw-b.yaw)*1.8,-Math.PI,Math.PI),pitch:clamp(wrap(f.pitch-b.pitch)*1.4,-1.3,1.3),roll:clamp(-wrap(f.roll-b.roll),-1.8,1.8)};
  }
}
