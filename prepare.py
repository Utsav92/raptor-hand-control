"""Build a top-level, camera-capable local version of the existing explainer."""
from pathlib import Path
import concurrent.futures
import io
import re
import shutil
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'source/raptor-engine.html'
ASSETS = HERE / 'assets'
ASSETS.mkdir(exist_ok=True)

def download(url):
    with urllib.request.urlopen(url, timeout=90) as response:
        return response.read()

def libraries():
    url = 'https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-1.1.0.tgz'
    archive = tarfile.open(fileobj=io.BytesIO(download(url)), mode='r:gz')
    count = 0
    for member in archive.getmembers():
        if not member.isfile():
            continue
        rel = Path(member.name).relative_to('package')
        if '..' in rel.parts:
            raise ValueError('Unsafe archive path')
        allowed = {
            'vision_bundle.mjs',
            'wasm/vision_wasm_module_internal.js', 'wasm/vision_wasm_module_internal.wasm',
            'wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.wasm',
            'LICENSE',
        }
        if str(rel).replace('\\', '/') in allowed:
            target = ASSETS / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())
            count += 1
    (ASSETS / 'three.min.js').write_bytes(download('https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js'))
    (ASSETS / 'three-LICENSE.txt').write_bytes(download('https://cdn.jsdelivr.net/npm/three@0.158.0/LICENSE'))
    no_simd = ASSETS / 'wasm/vision_wasm_nosimd_internal.js'
    (ASSETS / 'wasm/vision_wasm_nosimd_module.js').write_text(no_simd.read_text(encoding='utf-8') + '\nglobalThis.ModuleFactory = ModuleFactory;\n', encoding='utf-8')
    model = ASSETS / 'hand_landmarker.task'
    if not model.exists():
        model.write_bytes(download('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'))
    print(f'Installed local MediaPipe 1.1.0 runtime ({count} files), Three.js and hand model.', flush=True)

def document():
    source = SOURCE.read_text(encoding='utf-8')
    source = source.replace('https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js', './assets/three.min.js')
    match = re.search(r'<script>\s*(\(function\(\)\{.*)\s*</script>\s*$', source, re.S)
    if not match:
        raise ValueError('Engine source not found')
    engine = match.group(1)
    engine = engine.replace('scene.add(pivot);pivot.add(engine);', 'const modelTransform=new T.Group();scene.add(modelTransform);modelTransform.add(pivot);pivot.add(engine);')
    engine = engine.replace("let w=0,h=0;", """const wholePose={position:new T.Vector3(),rotation:new T.Quaternion()};
 const partPose=new Map();
 root.raptorHandControl={
  setExplosion(value){state.explode=Math.max(0,Math.min(1,value));viewButtons();},
  setPose(mode,pose){
   const position=new T.Vector3(pose.x,pose.y,pose.z||0).applyQuaternion(camera.quaternion);
   const rotation=new T.Quaternion().setFromEuler(new T.Euler(pose.pitch,pose.yaw,pose.roll,'YXZ'));
   if(mode==='part')partPose.set(state.part,{position,rotation});
   else{wholePose.position.copy(position);wholePose.rotation.copy(rotation);}
  },
  resetPose(){wholePose.position.set(0,0,0);wholePose.rotation.identity();partPose.clear();zoomFactor=1;yaw=.42;pitch=.12;},
  selectedPart(){return state.part;},
  poseSnapshot(){return {whole:{position:wholePose.position.toArray(),rotation:wholePose.rotation.toArray()},parts:[...partPose].map(([id,p])=>({id,position:p.position.toArray(),rotation:p.rotation.toArray()}))};}
 };
 root.addEventListener('raptor-hand-pose',e=>{const p=e.detail;if(p&&Number.isFinite(p.x))root.raptorHandControl.setPose(p.mode,p);});
 let w=0,h=0;""")
    old = "p.g.position.copy(p.base).addScaledVector(p.offset,explodeNow);const a=p.base,b=p.g.position;"
    new = """p.g.position.copy(p.base).addScaledVector(p.offset,explodeNow);
   const hp=partPose.get(p.id),q=hp?hp.rotation:new T.Quaternion();p.g.quaternion.slerp(q,blend);
   if(hp)p.g.position.add(hp.position).add(p.anchor).sub(p.anchor.clone().applyQuaternion(p.g.quaternion));
   const a=p.base,b=p.g.position;"""
    if old not in engine:
        raise ValueError('Frame integration not found')
    engine = engine.replace(old, new)
    engine = engine.replace('if(dirty)recolor();scene.updateMatrixWorld();', 'modelTransform.position.lerp(wholePose.position,blend);modelTransform.quaternion.slerp(wholePose.rotation,blend);if(dirty)recolor();scene.updateMatrixWorld();')
    # Start with the cutaway state selected in the conversation.
    engine = engine.replace('cut:false,labels:true', 'cut:true,labels:true')
    engine = engine.replace('values();viewButtons();select(state.part,false);rebuildNozzle();updatePhysics();requestAnimationFrame(frame);', 'restore({...state});values();viewButtons();select(state.part,false);rebuildNozzle();updatePhysics();requestAnimationFrame(frame);')
    (HERE / 'engine.js').write_text(engine, encoding='utf-8')
    model_markup = source[:match.start()] + '<script src="./engine.js"></script>'
    template = (HERE / 'shell.html').read_text(encoding='utf-8')
    (HERE / 'index.html').write_text(template.replace('<!-- ENGINE -->', model_markup), encoding='utf-8')
    print('Built camera-capable top-level app with the same 20 assemblies.', flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    tasks = [pool.submit(libraries), pool.submit(document)]
    for task in tasks:
        task.result()
