import {FilesetResolver,HandLandmarker} from './assets/vision_bundle.mjs';
let tracker=null,canvas=null,context=null;
let initialization;

async function initialize(){
  const vision=await FilesetResolver.forVisionTasks(new URL('./assets/wasm/',import.meta.url).href.replace(/\/$/,''));
  // Use the runtime's ESM loader: the classic loader cannot expose its factory
  // when imported from a module worker.
  if(vision.wasmLoaderPath.endsWith('vision_wasm_internal.js')){
    vision.wasmLoaderPath=new URL('./assets/wasm/vision_wasm_module_internal.js',import.meta.url).href;
    vision.wasmBinaryPath=new URL('./assets/wasm/vision_wasm_module_internal.wasm',import.meta.url).href;
  }else{
    vision.wasmLoaderPath=new URL('./assets/wasm/vision_wasm_nosimd_module.js',import.meta.url).href;
  }
  tracker=await HandLandmarker.createFromOptions(vision,{
    baseOptions:{modelAssetPath:new URL('./assets/hand_landmarker.task',import.meta.url).href,delegate:'CPU'},
    runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55
  });
  self.postMessage({type:'ready'});
}

initialization=initialize().catch(error=>self.postMessage({type:'error',message:'Hand tracker could not initialize: '+error.message}));
self.onmessage=async({data})=>{
  if(data.type!=='frame')return;
  const started=performance.now();
  try{
    await initialization;
    if(!tracker)throw Error('Tracker unavailable');
    const {bitmap}=data;
    if(!canvas||canvas.width!==bitmap.width||canvas.height!==bitmap.height){canvas=new OffscreenCanvas(bitmap.width,bitmap.height);context=canvas.getContext('2d');}
    // Mirror inference and preview consistently. Restore anatomical labels below:
    // the Tasks model's Left/Right output swaps when its input is mirrored.
    context.setTransform(-1,0,0,1,canvas.width,0);context.drawImage(bitmap,0,0);context.setTransform(1,0,0,1,0,0);
    const result=tracker.detectForVideo(canvas,data.timestamp);
    const hands=result.landmarks.map((landmarks,i)=>({landmarks,worldLandmarks:result.worldLandmarks[i],label:result.handedness[i][0].categoryName==='Left'?'Right':'Left',score:result.handedness[i][0].score}));
    self.postMessage({type:'result',hands,timestamp:data.timestamp,session:data.session,inferenceMs:performance.now()-started});
  }catch(error){self.postMessage({type:'frame-error',message:error.message,session:data.session});}
  finally{data.bitmap.close();}
};
