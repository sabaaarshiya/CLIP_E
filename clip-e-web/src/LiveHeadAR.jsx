import React,{useEffect,useMemo,useRef,useState} from'react';

const MODEL_URL='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';
const HAIR_MODEL_URL='https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite';
const WASM_URL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

function clamp(v,min=0,max=1){return Math.max(min,Math.min(max,v))}
function smooth(prev,next,a=.28){return prev==null?next:prev+(next-prev)*a}
function pt(p,i){return p?.[i]||null}

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

function geometryToSvg(g,topLength,sideLength,rear=false){
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
  return{
    topPath,leftBlend,rightBlend,leftSide,rightSide,hairline,
    labels:{
      top:{x:X(cx),y:Y((topY+blendTop)/2),text:rear?`CROWN · ${topLength} mm`:`TOP · ${topLength} mm`},
      blend:{x:X(right-.02),y:Y((blendTop+blendBottom)/2),text:rear?'BLEND BAND':'BLEND'},
      side:{x:X(right-.02),y:Y((blendBottom+sideBottom)/2),text:rear?`LOWER BACK · ${sideLength} mm`:`SIDE · ${sideLength} mm`}
    }
  };
}

export default function LiveHeadAR({src='',stream=null,topLength=25,sideLength=6,fadeHeight='Mid',className='',showLandmarks=false,onTracking,rear=false}){
  const imgRef=useRef(null),videoRef=useRef(null),hairCanvasRef=useRef(null),landmarkerRef=useRef(null),segmenterRef=useRef(null),rafRef=useRef(null),lastVideoTime=useRef(-1),lastSegTime=useRef(0),smoothedRef=useRef(null),faceSeenRef=useRef(false);
  const[geometry,setGeometry]=useState(null);
  const[status,setStatus]=useState('LOADING TRACKER');
  const[quality,setQuality]=useState({confidence:0,fps:0});const[hairStatus,setHairStatus]=useState('HAIR MODEL LOADING');
  const[landmarks,setLandmarks]=useState([]);
  const fpsRef=useRef({t:performance.now(),n:0,fps:0});
  const mode=stream?'VIDEO':'IMAGE';

  useEffect(()=>{let cancelled=false;(async()=>{try{
    setStatus('LOADING TRACKER');
    const mod=await import('@mediapipe/tasks-vision');
    const vision=await mod.FilesetResolver.forVisionTasks(WASM_URL);
    const landmarker=await mod.FaceLandmarker.createFromOptions(vision,{
      baseOptions:{modelAssetPath:MODEL_URL,delegate:'CPU'},
      runningMode:mode,
      numFaces:1,
      minFaceDetectionConfidence:.35,
      minFacePresenceConfidence:.35,
      minTrackingConfidence:.35
    });
    if(cancelled){landmarker.close();return}
    landmarkerRef.current=landmarker;setStatus('SEARCHING FOR HEAD');
    try{
      const segmenter=await mod.ImageSegmenter.createFromOptions(vision,{
        baseOptions:{modelAssetPath:HAIR_MODEL_URL,delegate:'CPU'},
        runningMode:mode,
        outputCategoryMask:true,
        outputConfidenceMasks:false
      });
      if(cancelled){segmenter.close();return}
      segmenterRef.current=segmenter;setHairStatus('HAIR MASK READY');
    }catch(segErr){console.warn('Clip-E hair segmenter unavailable',segErr);setHairStatus('HAIR MASK UNAVAILABLE')}
    if(!stream&&imgRef.current?.complete)analyzeImage();
  }catch(e){console.error('Clip-E AR tracker failed',e);setStatus('TRACKER UNAVAILABLE')}})();
  return()=>{cancelled=true;if(rafRef.current)cancelAnimationFrame(rafRef.current);landmarkerRef.current?.close();segmenterRef.current?.close();landmarkerRef.current=null;segmenterRef.current=null}},[mode]);

  function publish(points){
    if(!points?.length){faceSeenRef.current=false;setStatus('FACE NOT DETECTED · USING HAIR MASK');setLandmarks([]);return}faceSeenRef.current=true;
    const raw=deriveHeadGeometry(points,fadeHeight);
    if(!raw){setStatus('LOW CONFIDENCE');return}
    const prev=smoothedRef.current;
    const g={};
    for(const k of Object.keys(raw))g[k]=typeof raw[k]==='number'?smooth(prev?.[k],raw[k]):raw[k];
    smoothedRef.current=g;
    setGeometry(g);setLandmarks(showLandmarks?points:[]);
    setStatus('HEAD LOCKED');
    const boxArea=(g.headRight-g.headLeft)*Math.max(.01,g.sideBottom-g.headTop);
    const confidence=Math.round(clamp((boxArea-.06)/.24,0,1)*100);
    setQuality(q=>({...q,confidence}));
    onTracking?.({tracking:true,confidence,geometry:g});
  }

  function tickFps(){
    const now=performance.now(),f=fpsRef.current;f.n++;
    if(now-f.t>700){f.fps=Math.round(f.n*1000/(now-f.t));f.n=0;f.t=now;setQuality(q=>({...q,fps:f.fps}))}
  }

  function drawHairMask(result){
    const mask=result?.categoryMask,canvas=hairCanvasRef.current;if(!mask||!canvas)return;
    try{
      const data=mask.getAsUint8Array?.();const w=mask.width||imgRef.current?.naturalWidth||videoRef.current?.videoWidth||0;const h=mask.height||imgRef.current?.naturalHeight||videoRef.current?.videoHeight||0;
      if(!data||!w||!h)return;
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');const image=ctx.createImageData(w,h);
      let minX=w,minY=h,maxX=0,maxY=0,hairPixels=0;
      for(let i=0;i<data.length;i++){const hair=data[i]===1;const o=i*4;image.data[o]=42;image.data[o+1]=213;image.data[o+2]=186;image.data[o+3]=hair?72:0;if(hair){const x=i%w,y=Math.floor(i/w);if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;hairPixels++}}
      ctx.putImageData(image,0,0);setHairStatus('HAIR LOCKED');
      if(!faceSeenRef.current&&hairPixels>w*h*.015&&maxX>minX&&maxY>minY){
        const left=minX/w,right=maxX/w,top=minY/h,bottom=maxY/h,bh=bottom-top,bw=right-left,cx=(left+right)/2;
        const raw={cx,headTop:top,headLeft:left,headRight:right,foreheadY:top+bh*.34,blendTop:top+bh*.38,blendBottom:top+bh*.68,sideBottom:bottom,faceH:bh,faceW:bw};
        const prev=smoothedRef.current,g={};for(const k of Object.keys(raw))g[k]=smooth(prev?.[k],raw[k],.22);smoothedRef.current=g;setGeometry(g);setStatus('HAIR LOCKED · REAR');const confidence=Math.round(clamp((hairPixels/(w*h)-.02)/.25,0,1)*100);setQuality(q=>({...q,confidence}));onTracking?.({tracking:true,confidence,geometry:g,source:'hair-mask'});
      }
    }catch(e){console.warn('Hair mask render failed',e);setHairStatus('HAIR MASK RETRYING')}
  }

  function segmentImage(){
    const seg=segmenterRef.current,img=imgRef.current;if(!seg||!img?.complete||!img.naturalWidth)return;
    try{seg.segment(img,drawHairMask)}catch(e){console.warn('Hair image segmentation failed',e)}
  }

  function analyzeImage(){
    const l=landmarkerRef.current,img=imgRef.current;if(!l||!img?.complete||!img.naturalWidth)return;
    try{const r=l.detect(img);publish(r.faceLandmarks?.[0]);segmentImage();tickFps()}catch(e){console.warn('AR image analysis failed',e);setStatus('TRACKER RETRYING')}
  }

  useEffect(()=>{if(!stream)return;const v=videoRef.current;if(!v)return;v.srcObject=stream;v.play().catch(()=>{});
    const loop=()=>{const l=landmarkerRef.current;if(l&&v.readyState>=2&&v.currentTime!==lastVideoTime.current){lastVideoTime.current=v.currentTime;const now=performance.now();try{const r=l.detectForVideo(v,now);publish(r.faceLandmarks?.[0]);tickFps()}catch(e){console.warn('AR video analysis failed',e)}const seg=segmenterRef.current;if(seg&&now-lastSegTime.current>120){lastSegTime.current=now;try{seg.segmentForVideo(v,now,drawHairMask)}catch(e){console.warn('AR hair video segmentation failed',e)}}}rafRef.current=requestAnimationFrame(loop)};
    rafRef.current=requestAnimationFrame(loop);return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current)}
  },[stream,fadeHeight,showLandmarks]);

  useEffect(()=>{if(!stream&&src&&imgRef.current?.complete)analyzeImage()},[src,fadeHeight,showLandmarks]);

  const svg=useMemo(()=>geometryToSvg(geometry,topLength,sideLength,rear),[geometry,topLength,sideLength,rear]);
  return <div className={'liveHeadAR '+className}>
    {stream?<video ref={videoRef} autoPlay playsInline muted/>:<img ref={imgRef} src={src} onLoad={analyzeImage} alt="Clip-E camera with AR cut map"/>}
    <canvas ref={hairCanvasRef} className="arHairMask" aria-hidden="true"/>
    <svg className={'headArSvg '+(geometry?'locked':'')} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      {svg&&<><path className="arTop" d={svg.topPath}/><path className="arBlend" d={svg.leftBlend}/><path className="arBlend" d={svg.rightBlend}/><path className="arSide" d={svg.leftSide}/><path className="arSide" d={svg.rightSide}/><path className={'arHairline '+(rear?'rearEdge':'')} d={svg.hairline}/><text className="arLabel arLabelTop" x={svg.labels.top.x} y={svg.labels.top.y}>{svg.labels.top.text}</text><text className="arLabel" textAnchor="end" x={svg.labels.blend.x} y={svg.labels.blend.y}>{svg.labels.blend.text}</text><text className="arLabel" textAnchor="end" x={svg.labels.side.x} y={svg.labels.side.y}>{svg.labels.side.text}</text></>}
      {landmarks.map((p,i)=><circle key={i} className="arLandmark" cx={p.x*1000} cy={p.y*1000} r="2.5"/>)}
    </svg>
    <div className="arHud"><span className={geometry?'arLive':'arWaiting'}>● {status}</span><span>{mode} · {quality.fps||'—'} FPS</span><span>LOCK {quality.confidence}%</span><span>{hairStatus}</span></div>
    {!geometry&&<div className="arGuide"><span>Center the head in frame</span><small>Face/head tracking must lock before zones can anchor.</small></div>}
  </div>
}
