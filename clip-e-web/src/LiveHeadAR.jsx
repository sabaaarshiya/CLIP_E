import React,{useEffect,useMemo,useRef,useState} from'react';

const MODEL_URL='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';
const HAIR_MODEL_URL='https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite';
const WASM_URL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

function clamp(v,min=0,max=1){return Math.max(min,Math.min(max,v))}
function smooth(prev,next,a=.28){return prev==null?next:prev+(next-prev)*a}
function pt(p,i){return p?.[i]||null}
function fpsWindow(){return{t:performance.now(),n:0,fps:0}}
function sampleFps(ref){
  const now=performance.now(),f=ref.current;f.n++;
  if(now-f.t>=900){f.fps=Math.round(f.n*1000/(now-f.t));f.n=0;f.t=now;return f.fps}
  return null
}

function deriveHeadGeometry(points,fadeHeight='Mid'){
  if(!points?.length)return null;
  const forehead=pt(points,10),chin=pt(points,152),leftFace=pt(points,234),rightFace=pt(points,454);
  const leftTemple=pt(points,127)||leftFace,rightTemple=pt(points,356)||rightFace;
  if(!forehead||!chin||!leftFace||!rightFace)return null;
  const faceH=Math.max(.12,chin.y-forehead.y);
  const faceW=Math.max(.12,rightFace.x-leftFace.x);
  const cx=(leftFace.x+rightFace.x)/2;
  const headTop=clamp(forehead.y-faceH*.42,.01,.9);
  const headLeft=clamp(leftFace.x-faceW*.09,.01,.95);
  const headRight=clamp(rightFace.x+faceW*.09,.05,.99);
  const foreheadY=clamp(forehead.y,.02,.95);
  const templeY=clamp(((leftTemple.y+rightTemple.y)/2)+faceH*.05,.04,.96);
  const fadeLift=fadeHeight==='High'?.04:fadeHeight==='Low'?-.04:0;
  const blendTop=clamp(foreheadY+faceH*(.12-fadeLift),headTop,.95);
  const blendBottom=clamp(templeY+faceH*(.22-fadeLift),blendTop+.03,.97);
  const sideBottom=clamp(chin.y-faceH*.06,blendBottom+.03,.99);
  return{cx,headTop,headLeft,headRight,foreheadY,blendTop,blendBottom,sideBottom,faceH,faceW};
}

function geometryToSvg(g,topLength,sideLength,rear=false,rearPlan=[]){
  if(!g)return null;
  const X=v=>Math.round(v*1000),Y=v=>Math.round(v*1000);
  const left=g.headLeft,right=g.headRight,cx=g.cx;
  const topY=g.headTop,foreheadY=g.foreheadY;
  const blendTop=g.blendTop,blendBottom=g.blendBottom,sideBottom=g.sideBottom;
  const inset=g.faceW*.15;
  const leftInner=left+inset,rightInner=right-inset;
  const topPath=`M ${X(left)} ${Y(blendTop)} Q ${X(left)} ${Y(topY)} ${X(cx)} ${Y(topY)} Q ${X(right)} ${Y(topY)} ${X(right)} ${Y(blendTop)} Q ${X(cx)} ${Y(foreheadY+.02)} ${X(left)} ${Y(blendTop)} Z`;
  const leftBlend=`M ${X(left)} ${Y(blendTop)} L ${X(leftInner)} ${Y(blendTop+.01)} L ${X(leftInner)} ${Y(blendBottom)} L ${X(left)} ${Y(blendBottom)} Z`;
  const rightBlend=`M ${X(rightInner)} ${Y(blendTop+.01)} L ${X(right)} ${Y(blendTop)} L ${X(right)} ${Y(blendBottom)} L ${X(rightInner)} ${Y(blendBottom)} Z`;
  const leftSide=`M ${X(left)} ${Y(blendBottom)} L ${X(leftInner)} ${Y(blendBottom)} L ${X(leftInner+.015)} ${Y(sideBottom)} L ${X(left+.025)} ${Y(sideBottom)} Z`;
  const rightSide=`M ${X(rightInner)} ${Y(blendBottom)} L ${X(right)} ${Y(blendBottom)} L ${X(right-.025)} ${Y(sideBottom)} L ${X(rightInner-.015)} ${Y(sideBottom)} Z`;
  const hairline=rear?`M ${X(left+.03)} ${Y(sideBottom-.015)} Q ${X(cx)} ${Y(sideBottom+.015)} ${X(right-.03)} ${Y(sideBottom-.015)}`:`M ${X(leftInner)} ${Y(foreheadY+.015)} Q ${X(cx)} ${Y(foreheadY-.035)} ${X(rightInner)} ${Y(foreheadY+.015)}`;
  const plan=id=>rearPlan.find(x=>x.id===id);
  const crown=plan('crown'),upper=plan('upperBack'),rearSides=plan('rearSides'),neckline=plan('neckline');
  return{
    topPath,leftBlend,rightBlend,leftSide,rightSide,hairline,
    labels:{
      top:{x:X(cx),y:Y((topY+blendTop)/2),text:rear?(crown?.work?`CROWN · ${crown.action}`:'CROWN · PRESERVE'):`TOP · CUT TO ${topLength} mm`},
      blend:{x:X(right-.02),y:Y((blendTop+blendBottom)/2),text:rear?(upper?.action||'UPPER BACK · VERIFY'):'BLEND TRANSITION'},
      side:{x:X(right-.02),y:Y((blendBottom+sideBottom)/2),text:rear?(rearSides?.action||`LOWER BACK · ${sideLength} mm`):`SIDE · CUT TO ${sideLength} mm`},
      edge:{x:X(cx),y:Y(sideBottom-.025),text:rear?(neckline?.action||'NECKLINE · PROTECT'):'HAIRLINE · PROTECTED'}
    }
  };
}

export default function LiveHeadAR({src='',stream=null,topLength=25,sideLength=6,fadeHeight='Mid',className='',showLandmarks=false,onTracking,rear=false,rearPlan=[]}){
  const imgRef=useRef(null),videoRef=useRef(null),analysisCanvasRef=useRef(null),segCanvasRef=useRef(null),hairCanvasRef=useRef(null);
  const landmarkerRef=useRef(null),segmenterRef=useRef(null),rvfcRef=useRef(null),rafRef=useRef(null);
  const smoothedRef=useRef(null),faceSeenRef=useRef(false),processingRef=useRef(false),lastCvAtRef=useRef(0),lastSegAtRef=useRef(0);
  const analysisHeightRef=useRef(720),goodWindowsRef=useRef(0);
  const cameraFpsRef=useRef(fpsWindow()),cvFpsRef=useRef(fpsWindow()),segFpsRef=useRef(fpsWindow()),arFpsRef=useRef(fpsWindow());
  const perfRef=useRef({cameraFps:0,cvFps:0,segFps:0,arFps:0,sourceW:0,sourceH:0,analysisW:0,analysisH:0});

  const[geometry,setGeometry]=useState(null);
  const[status,setStatus]=useState('LOADING TRACKER');
  const[quality,setQuality]=useState({confidence:0});
  const[hairStatus,setHairStatus]=useState('HAIR MODEL LOADING');
  const[landmarks,setLandmarks]=useState([]);
  const[perf,setPerf]=useState(perfRef.current);
  const mode=stream?'VIDEO':'IMAGE';

  function setStatusIfChanged(next){setStatus(v=>v===next?v:next)}
  function setHairStatusIfChanged(next){setHairStatus(v=>v===next?v:next)}

  useEffect(()=>{let cancelled=false;(async()=>{try{
    setStatusIfChanged('LOADING TRACKER');
    const mod=await import('@mediapipe/tasks-vision');
    const vision=await mod.FilesetResolver.forVisionTasks(WASM_URL);
    let landmarker=null;
    for(const delegate of ['GPU','CPU']){
      try{
        landmarker=await mod.FaceLandmarker.createFromOptions(vision,{
          baseOptions:{modelAssetPath:MODEL_URL,delegate},
          runningMode:mode,
          numFaces:1,
          minFaceDetectionConfidence:.35,
          minFacePresenceConfidence:.35,
          minTrackingConfidence:.35
        });
        console.info('[Clip-E AR] FaceLandmarker delegate',delegate);
        break;
      }catch(e){if(delegate==='CPU')throw e}
    }
    if(cancelled){landmarker?.close();return}
    landmarkerRef.current=landmarker;setStatusIfChanged('SEARCHING FOR HEAD');
    try{
      let segmenter=null;
      for(const delegate of ['GPU','CPU']){
        try{
          segmenter=await mod.ImageSegmenter.createFromOptions(vision,{
            baseOptions:{modelAssetPath:HAIR_MODEL_URL,delegate},
            runningMode:mode,
            outputCategoryMask:true,
            outputConfidenceMasks:false
          });
          console.info('[Clip-E AR] Hair segmenter delegate',delegate);
          break;
        }catch(e){if(delegate==='CPU')throw e}
      }
      if(cancelled){segmenter?.close();return}
      segmenterRef.current=segmenter;setHairStatusIfChanged('HAIR MASK READY');
    }catch(segErr){console.warn('Clip-E hair segmenter unavailable',segErr);setHairStatusIfChanged('HAIR MASK UNAVAILABLE')}
    if(!stream&&imgRef.current?.complete)analyzeImage();
  }catch(e){console.error('Clip-E AR tracker failed',e);setStatusIfChanged('TRACKER UNAVAILABLE')}})();
  return()=>{cancelled=true;if(rvfcRef.current&&videoRef.current?.cancelVideoFrameCallback)videoRef.current.cancelVideoFrameCallback(rvfcRef.current);if(rafRef.current)cancelAnimationFrame(rafRef.current);landmarkerRef.current?.close();segmenterRef.current?.close();landmarkerRef.current=null;segmenterRef.current=null}},[mode]);

  function publish(points){
    if(!points?.length){faceSeenRef.current=false;setStatusIfChanged('FACE NOT DETECTED · USING HAIR MASK');if(showLandmarks)setLandmarks([]);return}
    faceSeenRef.current=true;
    const raw=deriveHeadGeometry(points,fadeHeight);
    if(!raw){setStatusIfChanged('LOW CONFIDENCE');return}
    const prev=smoothedRef.current,g={};
    for(const k of Object.keys(raw))g[k]=typeof raw[k]==='number'?smooth(prev?.[k],raw[k]):raw[k];
    smoothedRef.current=g;
    setGeometry(g);if(showLandmarks)setLandmarks(points);
    setStatusIfChanged('HEAD LOCKED');
    const boxArea=(g.headRight-g.headLeft)*Math.max(.01,g.sideBottom-g.headTop);
    const confidence=Math.round(clamp((boxArea-.06)/.24,0,1)*100);
    setQuality(q=>q.confidence===confidence?q:{confidence});
    onTracking?.({tracking:true,confidence,geometry:g});
  }

  function updatePerf(partial={}){
    perfRef.current={...perfRef.current,...partial};
    setPerf({...perfRef.current});
  }

  function adaptAnalysis(cvFps){
    if(!cvFps)return;
    const current=analysisHeightRef.current;
    if(cvFps<11){
      goodWindowsRef.current=0;
      if(current===720)analysisHeightRef.current=540;
      else if(current===540)analysisHeightRef.current=360;
    }else if(cvFps>22){
      goodWindowsRef.current++;
      if(goodWindowsRef.current>=4&&current===360){analysisHeightRef.current=540;goodWindowsRef.current=0}
    }else goodWindowsRef.current=0;
  }

  function prepareCanvas(canvas,source,targetH){
    if(!canvas||!source)return null;
    const sw=source.videoWidth||source.naturalWidth||0,sh=source.videoHeight||source.naturalHeight||0;
    if(!sw||!sh)return null;
    const h=Math.min(sh,targetH),w=Math.max(2,Math.round(h*sw/sh));
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
    ctx.drawImage(source,0,0,w,h);
    return{canvas,w,h,sw,sh};
  }

  function drawHairMask(result){
    const mask=result?.categoryMask,canvas=hairCanvasRef.current;if(!mask||!canvas)return;
    try{
      const data=mask.getAsUint8Array?.();const w=mask.width||segCanvasRef.current?.width||0;const h=mask.height||segCanvasRef.current?.height||0;
      if(!data||!w||!h)return;
      if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
      const ctx=canvas.getContext('2d');const image=ctx.createImageData(w,h);
      let minX=w,minY=h,maxX=0,maxY=0,hairPixels=0;
      for(let i=0;i<data.length;i++){const hair=data[i]===1;const o=i*4;image.data[o]=42;image.data[o+1]=213;image.data[o+2]=186;image.data[o+3]=hair?66:0;if(hair){const x=i%w,y=(i/w)|0;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;hairPixels++}}
      ctx.putImageData(image,0,0);setHairStatusIfChanged('HAIR LOCKED');
      const sf=sampleFps(segFpsRef);if(sf!=null)updatePerf({segFps:sf});
      if(!faceSeenRef.current&&hairPixels>w*h*.015&&maxX>minX&&maxY>minY){
        const left=minX/w,right=maxX/w,top=minY/h,bottom=maxY/h,bh=bottom-top,bw=right-left,cx=(left+right)/2;
        const raw={cx,headTop:top,headLeft:left,headRight:right,foreheadY:top+bh*.34,blendTop:top+bh*.38,blendBottom:top+bh*.68,sideBottom:bottom,faceH:bh,faceW:bw};
        const prev=smoothedRef.current,g={};for(const k of Object.keys(raw))g[k]=smooth(prev?.[k],raw[k],.22);smoothedRef.current=g;setGeometry(g);setStatusIfChanged('HAIR LOCKED · REAR');const confidence=Math.round(clamp((hairPixels/(w*h)-.02)/.25,0,1)*100);setQuality(q=>q.confidence===confidence?q:{confidence});onTracking?.({tracking:true,confidence,geometry:g,source:'hair-mask'});
      }
    }catch(e){console.warn('Hair mask render failed',e);setHairStatusIfChanged('HAIR MASK RETRYING')}
  }

  function runSegmentation(source,now){
    const seg=segmenterRef.current;if(!seg||now-lastSegAtRef.current<125)return;
    lastSegAtRef.current=now;
    const prepared=prepareCanvas(segCanvasRef.current,source,360);if(!prepared)return;
    try{seg.segmentForVideo(prepared.canvas,now,drawHairMask)}catch(e){console.warn('AR hair video segmentation failed',e)}
  }

  function analyzeVideoFrame(video,now){
    if(processingRef.current||now-lastCvAtRef.current<33)return;
    const l=landmarkerRef.current;if(!l||video.readyState<2)return;
    processingRef.current=true;lastCvAtRef.current=now;
    try{
      const prepared=prepareCanvas(analysisCanvasRef.current,video,analysisHeightRef.current);if(!prepared)return;
      const r=l.detectForVideo(prepared.canvas,now);
      publish(r.faceLandmarks?.[0]);
      const cf=sampleFps(cvFpsRef);
      if(cf!=null){adaptAnalysis(cf);updatePerf({cvFps:cf,sourceW:prepared.sw,sourceH:prepared.sh,analysisW:prepared.w,analysisH:prepared.h})}
      runSegmentation(video,now);
    }catch(e){console.warn('AR video analysis failed',e)}
    finally{processingRef.current=false}
  }

  function segmentImage(){
    const seg=segmenterRef.current,img=imgRef.current;if(!seg||!img?.complete||!img.naturalWidth)return;
    const prepared=prepareCanvas(segCanvasRef.current,img,360);if(!prepared)return;
    try{seg.segment(prepared.canvas,drawHairMask)}catch(e){console.warn('Hair image segmentation failed',e)}
  }

  function analyzeImage(){
    const l=landmarkerRef.current,img=imgRef.current;if(!l||!img?.complete||!img.naturalWidth)return;
    const prepared=prepareCanvas(analysisCanvasRef.current,img,720);if(!prepared)return;
    try{const r=l.detect(prepared.canvas);publish(r.faceLandmarks?.[0]);segmentImage()}catch(e){console.warn('AR image analysis failed',e);setStatusIfChanged('TRACKER RETRYING')}
  }

  useEffect(()=>{if(!stream)return;const v=videoRef.current;if(!v)return;v.srcObject=stream;v.play().catch(()=>{});
    const track=stream.getVideoTracks()[0];const settings=track?.getSettings?.()||{};const caps=track?.getCapabilities?.()||{};
    console.info('[Clip-E AR] camera settings',settings);console.info('[Clip-E AR] camera capabilities',caps);
    updatePerf({sourceW:settings.width||0,sourceH:settings.height||0});

    let stopped=false;
    const onPresentedFrame=(now)=>{
      if(stopped)return;
      const fps=sampleFps(cameraFpsRef);if(fps!=null)updatePerf({cameraFps:fps});
      analyzeVideoFrame(v,performance.now());
      if(v.requestVideoFrameCallback)rvfcRef.current=v.requestVideoFrameCallback(onPresentedFrame);
    };
    if(v.requestVideoFrameCallback)rvfcRef.current=v.requestVideoFrameCallback(onPresentedFrame);
    else{
      const fallback=()=>{if(stopped)return;const fps=sampleFps(cameraFpsRef);if(fps!=null)updatePerf({cameraFps:fps});analyzeVideoFrame(v,performance.now());rvfcRef.current=requestAnimationFrame(fallback)};
      rvfcRef.current=requestAnimationFrame(fallback);
    }

    const renderLoop=()=>{
      if(stopped)return;
      const af=sampleFps(arFpsRef);if(af!=null)updatePerf({arFps:af});
      rafRef.current=requestAnimationFrame(renderLoop);
    };
    rafRef.current=requestAnimationFrame(renderLoop);

    return()=>{stopped=true;if(v.cancelVideoFrameCallback&&rvfcRef.current)v.cancelVideoFrameCallback(rvfcRef.current);else if(rvfcRef.current)cancelAnimationFrame(rvfcRef.current);if(rafRef.current)cancelAnimationFrame(rafRef.current)}
  },[stream,fadeHeight,showLandmarks]);

  useEffect(()=>{if(!stream&&src&&imgRef.current?.complete)analyzeImage()},[src,fadeHeight,showLandmarks]);

  const svg=useMemo(()=>geometryToSvg(geometry,topLength,sideLength,rear,rearPlan),[geometry,topLength,sideLength,rear,rearPlan]);
  return <div className={'liveHeadAR '+className}>
    {stream?<video ref={videoRef} autoPlay playsInline muted/>:<img ref={imgRef} src={src} onLoad={analyzeImage} alt="Clip-E camera with AR cut map"/>}
    <canvas ref={analysisCanvasRef} hidden aria-hidden="true"/>
    <canvas ref={segCanvasRef} hidden aria-hidden="true"/>
    <canvas ref={hairCanvasRef} className="arHairMask" aria-hidden="true"/>
    <svg className={'headArSvg '+(geometry?'locked':'')} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      {svg&&<><path className="arTop" d={svg.topPath}/><path className="arBlend" d={svg.leftBlend}/><path className="arBlend" d={svg.rightBlend}/><path className="arSide" d={svg.leftSide}/><path className="arSide" d={svg.rightSide}/><path className={'arHairline '+(rear?'rearEdge':'')} d={svg.hairline}/><text className="arLabel arLabelTop" x={svg.labels.top.x} y={svg.labels.top.y}>{svg.labels.top.text}</text><text className="arLabel" textAnchor="end" x={svg.labels.blend.x} y={svg.labels.blend.y}>{svg.labels.blend.text}</text><text className="arLabel" textAnchor="end" x={svg.labels.side.x} y={svg.labels.side.y}>{svg.labels.side.text}</text><text className="arLabel arEdgeLabel" textAnchor="middle" x={svg.labels.edge.x} y={svg.labels.edge.y}>{svg.labels.edge.text}</text></>}
      {landmarks.map((p,i)=><circle key={i} className="arLandmark" cx={p.x*1000} cy={p.y*1000} r="2.5"/>)}
    </svg>
    <div className="arHud">
      <span className={geometry?'arLive':'arWaiting'}>● {status}</span>
      {stream&&<><span>CAMERA {perf.cameraFps||'—'} FPS</span><span>CV {perf.cvFps||'—'} FPS</span><span>AR {perf.arFps||'—'} FPS</span><span>SEG {perf.segFps||'—'} FPS</span><span>RES {perf.sourceW||'—'}×{perf.sourceH||'—'}</span><span>ANALYSIS {perf.analysisW||'—'}×{perf.analysisH||'—'}</span></>}
      {!stream&&<span>IMAGE</span>}<span>LOCK {quality.confidence}%</span><span>{hairStatus}</span>
    </div>
    {!geometry&&<div className="arGuide"><span>Center the head in frame</span><small>Face/head tracking must lock before zones can anchor.</small></div>}
  </div>
}
