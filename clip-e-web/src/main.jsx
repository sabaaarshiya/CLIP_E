/* Clip-E dashboard refresh v2 */
import React,{useEffect,useRef,useState} from'react';import{createRoot}from'react-dom/client';import{Camera,Upload,ArrowRight,ShieldCheck,Wifi,CheckCircle2,Scissors,Sparkles,Target,Activity,ChevronRight,Mic,Pause,Square,Volume2,Eye,Accessibility,RotateCcw,MessageCircle}from'lucide-react';import'./styles.css';import discoverHeroImage from'../b00d3e39-7083-4054-948f-413744a7d37d.png';import PhoneCamera from'./PhoneCamera.jsx';import PhoneLiveView from'./PhoneLiveView.jsx';import LiveHeadAR from'./LiveHeadAR.jsx';import{DEMO_PERSON_SHEET}from'./demoPerson.js';import{QRCodeCanvas}from'qrcode.react';

const steps=['Discover','Scan','Profile','Styles','Customize','Head Map','Review','Setup','Live Cut','Results','History','Accessibility'];

const womenBoardNames=["Long Layers","Blunt Cut","U Cut","V Cut","Long Shag","Butterfly Cut","Face-Framing Layers","Curtain Bangs","Long Side Bangs","Bottleneck Bangs","Beach Waves","Soft Waves","Hollywood Waves","S Waves","Deep Waves","Loose Curls","Defined Curls","Spiral Curls","Ringlet Curls","Voluminous Curls","Long Bob (Lob)","Blunt Lob","Layered Lob","Wavy Lob","Sleek Lob","Classic Bob","French Bob","Italian Bob","A-Line Bob","Stacked Bob","Pixie Cut","Long Pixie","Textured Pixie","Bixie Cut","Pixie Bob","Modern Shag","Curly Shag","Soft Shag","Wolf Cut","Soft Wolf Cut","Jellyfish Cut","Octopus Cut","Hush Cut","Feather Cut","90s Layers","Side Part","Middle Part","Sleek Straight","Natural Texture","Tousled Texture"];
const menBoardNames=["Textured Crop","Low Fade","Mid Fade","High Fade","Buzz Cut","Crew Cut","French Crop","Caesar Cut","Taper Fade","Waves","Classic Taper","Side Part","Hard Part","Ivy League","Short Quiff","Messy Fringe","Straight Fringe","Curly Fringe","Short Shag","Modern Caesar","Drop Fade","Burst Fade","Skin Fade","Low Taper","High Taper","Pompadour","Quiff","Comb Over","Brush Up","Spiky Texture","Short Curls","Curly Top","Afro Taper","High Top","Twists","Medium Layers","Longer Layers","Surfer Hair","Bro Flow","Medium Shag","Curtain Fringe","Middle Part","Loose Waves","Defined Curls","Tight Curls","Edgar Crop","Mohawk Fade","Faux Hawk","Long Curly Flow","Natural Texture"];

function styleMeta(name,slot,board){
 const n=name.toLowerCase();
 let length=/pixie|buzz|crew|caesar|crop|fade|taper|short|flat top|high top/.test(n)?'SHORT':/long|flow|waves|curls|layers|shag|wolf|jellyfish|octopus|feather|90s/.test(n)?'LONG':'MEDIUM';
 let patterns=/curl|coily|afro|twist/.test(n)?['CURLY','COILY','WAVY']:/wave|texture|shag|wolf|mullet|flow/.test(n)?['WAVY','CURLY','STRAIGHT']:['STRAIGHT','WAVY'];
 let density=/blunt|bob|pixie|buzz|fade|taper/.test(n)?['LOW','MEDIUM','HIGH']:['MEDIUM','HIGH'];
 let maintenance=/buzz|crew|natural texture|tousled|soft shag|bro flow/.test(n)?'LOW':/skin fade|high fade|pompadour|jellyfish|stacked bob|pixie/.test(n)?'HIGH':'MEDIUM';
 const tags=[];
 if(/layer|shag|wolf|butterfly|feather|octopus|jellyfish|flow/.test(n))tags.push('LAYERED');
 if(/texture|crop|shag|wolf|messy|tousled|spiky|curly|waves|twist/.test(n))tags.push('TEXTURED');
 if(/fade|taper|undercut/.test(n))tags.push('FADE/TAPER');
 if(/bang|fringe|curtain/.test(n))tags.push('FRINGE/BANGS');
 if(/bob|lob/.test(n))tags.push('BOB');
 if(maintenance==='LOW')tags.push('LOW MAINTENANCE');
 const assist=length==='SHORT'?['Back','Sides','Around ears','Neckline']:['Back','Sides','Layers'];
 return{name,slot,board,length,patterns,density,maintenance,tags,assist,description:`${name} interpreted as a Clip-E target style using the uploaded reference board.`};
}
const unifiedStyles=[
 ...menBoardNames.map((name,slot)=>styleMeta(name,slot,'men')),
 ...womenBoardNames.map((name,slot)=>styleMeta(name,slot,'women'))
].map((item,index)=>({...item,id:index+1,image:`/styles/style-${String(index+1).padStart(3,'0')}.webp`}));
const styles=unifiedStyles.map(s=>[s.name,s.description]);

const faceAffinity={
 Round:['High Fade','Textured Crop','Side Part','Long Layers','Curtain Bangs','Side Part Waves'],
 Oval:['Classic Taper','Textured Crop','Ivy League','Blunt Cut','Soft Waves','Butterfly Cut'],
 Square:['Low Fade','Curly Top','Bro Flow','Soft Waves','Long Layers','Face Framing'],
 Heart:['Messy Fringe','Classic Taper','Middle Part','Side Part Waves','Face Framing','Soft Waves'],
 Diamond:['Textured Crop','Side Part','Bro Flow','Face Framing','Curtain Bangs','Long Layers'],
 Rectangle:['Curly Top','Messy Fringe','Bro Flow','Soft Waves','Shag','Curtain Bangs']
};

function normalizeHairPattern(value=''){
 const v=String(value).toUpperCase();
 if(v.includes('COILY')||/^4[A-C]/.test(v))return'COILY';
 if(v.includes('CURLY')||/^3[A-C]/.test(v))return'CURLY';
 if(v.includes('WAVY')||/^2[A-C]/.test(v))return'WAVY';
 if(v.includes('STRAIGHT')||/^1[A-C]/.test(v))return'STRAIGHT';
 return'';
}
function personalizedStyles(hair,shape){
 const primary=normalizeHairPattern(hair?.primaryType||hair?.hairPattern);
 const compatible=[...(hair?.styleSignals?.compatiblePatterns||[])].map(normalizeHairPattern).filter(Boolean);
 const observedPatterns=[...new Set([primary,...compatible].filter(Boolean))];
 const length=String(hair?.styleSignals?.lengthCategory||'').toUpperCase();
 const density=String(hair?.density||'').toUpperCase();
 const shapeKey=Object.keys(faceAffinity).find(k=>String(shape||'').toLowerCase().includes(k.toLowerCase()))||'';
 const affinityNames=shapeKey?(faceAffinity[shapeKey]||[]):[];
 return unifiedStyles.map((item,index)=>{
   let earned=0,available=0;
   const reasons=[];
   if(observedPatterns.length){
     available+=40;
     if(observedPatterns.some(p=>item.patterns.includes(p))){earned+=40;reasons.push(`works with your visible ${observedPatterns.join('/').toLowerCase()} pattern`)}
   }
   if(['SHORT','MEDIUM','LONG'].includes(length)){
     available+=25;
     if(item.length===length){earned+=25;reasons.push(`fits your current ${length.toLowerCase()} length range`)}
   }
   if(['LOW','MEDIUM','HIGH'].includes(density)){
     available+=15;
     if(item.density.includes(density)){earned+=15;reasons.push(`supports your apparent ${density.toLowerCase()} density`)}
   }
   if(shapeKey){
     available+=20;
     const faceMatch=affinityNames.some(name=>{
       const a=name.toLowerCase(),b=item.name.toLowerCase();
       return a===b||a.includes(b)||b.includes(a);
     });
     if(faceMatch){earned+=20;reasons.push(`aligns with your ${shapeKey.toLowerCase()} face/head geometry`)}
   }
   const score=available?Math.round(earned/available*100):null;
   return{...item,index,score,matchEvidence:earned,availableEvidence:available,why:reasons.join(' and ')||'No strong profile evidence for this style'};
 }).filter(x=>x.availableEvidence>0).sort((a,b)=>(b.score??-1)-(a.score??-1)||b.matchEvidence-a.matchEvidence||a.name.localeCompare(b.name));
}
function buildRearCutPlan(style,hair){
 const assist=new Set(style?.assist||[]);
 const hairPattern=hair?.primaryType||hair?.hairPattern||'Profile pending';
 const currentLength=hair?.styleSignals?.lengthCategory||hair?.currentLength||'Unable to determine from scan';
 const backWork=assist.has('Back');
 const sideWork=assist.has('Sides');
 const earWork=assist.has('Around ears');
 const necklineWork=assist.has('Neckline');
 const layerWork=assist.has('Layers');
 return[
  {id:'crown',label:'Crown',action:layerWork?'SHAPE / BLEND':'PRESERVE / VERIFY',work:layerWork,observed:hair?.crownBehavior||'Use rear view to verify crown behavior.'},
  {id:'upperBack',label:'Upper back',action:backWork?(layerWork?'BLEND TO TARGET':'REDUCE / BLEND'):'PRESERVE',work:backWork,observed:hair?.backGrowth||'Rear growth becomes visible when the phone camera is connected.'},
  {id:'rearSides',label:'Rear sides',action:sideWork?'BLEND / REFINE':'PRESERVE',work:sideWork,observed:hair?.sideGrowth||'Compare left and right rear-side growth in the live view.'},
  {id:'ears',label:'Behind ears',action:earWork?'TRIM / CLEAN':'PROTECT',work:earWork,observed:hair?.symmetry||'Confirm symmetry before trimming around the ears.'},
  {id:'neckline',label:'Neckline',action:necklineWork?'CLEAN / TAPER':'PRESERVE EDGE',work:necklineWork,observed:hair?.necklineCondition||'Use the phone view to confirm the visible neckline boundary.'}
 ].map(x=>({...x,hairPattern,currentLength,targetLength:style?.length||'—'}))
}
const zones=[['Top','12 mm','4 mm'],['Sides','9 mm','6 mm'],['Back','9 mm','5 mm'],['Neckline','6 mm','3 mm']];

function ConceptHead({view='front',hair='crop',technical=false,active=false,className=''}){return <div className={'conceptHead '+view+' '+hair+' '+(technical?'technical ':'')+(active?'active ':'')+className}><div className="cranium"/><div className="ear earL"/><div className="ear earR"/><div className="facePlane"><i className="brow browL"/><i className="brow browR"/><i className="eye eyeL"/><i className="eye eyeR"/><i className="nose"/><i className="mouth"/><i className="jaw"/></div><div className="neck"/><div className="hairMass"><i/><i/><i/><i/><i/><i/><i/></div><div className="fade fadeL"/><div className="fade fadeR"/>{technical&&<><div className="contour c1"/><div className="contour c2"/><div className="contour c3"/><span className="scanPoint sp1"/><span className="scanPoint sp2"/><span className="scanPoint sp3"/></>}{active&&<div className="cutHeat"/>}</div>}
function Arm({mode='home'}){return <div className={'arm '+mode} aria-label="Clip-E robotic arm visualization"><div className="base"/><div className="joint j1"/><div className="link l1"/><div className="joint j2"/><div className="link l2"/><div className="joint j3"/><div className="tool"><Scissors size={18}/></div><div className="path"/></div>}
function PersonalHeadMap({photo,scanShots,analysis,view,setView,topLength=25,sideLength=6,fadeHeight='Mid'}){const labels=['Front','Left','Right','Back'];const images=[scanShots?.[0]||photo,scanShots?.[1],scanShots?.[2],scanShots?.[3]];const current=images[view]||photo;const blendMax=Math.max(sideLength+8,Math.round(topLength*.7));return <div className="personalHeadMap"><div className="headMapStage">{current?<img src={current} alt={labels[view]+' head scan'}/>:<div className="headMapEmpty"><Camera/><b>Capture the scan views first</b></div>}<div className={'hairZoneOverlay view-'+view+' fade-'+String(fadeHeight).toLowerCase()}><span className="zone topZone">TOP · {topLength} mm</span><span className="zone blendZone">BLEND · {sideLength}–{blendMax} mm</span><span className="zone fadeZone">SIDES · {sideLength} mm</span><span className="zone protectZone">PROTECTED EDGE</span></div>{view===0&&analysis?.points&&<svg className="personalLandmarks" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={analysis.points.filter((_,i)=>[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109].includes(i)).map(p=>p.x*100+','+p.y*100).join(' ')} fill="none" vectorEffect="non-scaling-stroke"/></svg>}</div><div className="headViewRail">{labels.map((label,i)=><button key={label} className={view===i?'active':''} onClick={()=>setView(i)} disabled={!images[i]&&i!==0}><span>{images[i]?<img src={images[i]} alt=""/>:<span className="emptyViewTile"><Camera size={16}/></span>}</span><b>{label}</b></button>)}</div><div className="headMapLegend"><span><i className="hmTop"/>Top target · {topLength} mm</span><span><i className="hmBlend"/>Blend transition</span><span><i className="hmFade"/>Side target · {sideLength} mm</span><span><i className="hmProtect"/>Protected boundary</span></div><div className="mapConfidence"><Target/><span><b>{images.filter(Boolean).length}/4 scan views mapped</b><small>{analysis?.landmarks?analysis.landmarks+' facial landmarks anchor the front view':'Complete the front scan for landmark anchoring'}</small></span></div></div>}
function Header({step,setStep}){const nav=[['DISCOVER',0],['SCAN',1],['PROFILE',2],['STYLES',3],['CLIP-E',5],['HISTORY',10],['ACCESSIBILITY',11]];const active=(step>=5&&step<=9)?5:step===4?3:step;const progressIndex=Math.max(0,nav.findIndex(x=>x[1]===active));return <><header><button className="brand" onClick={()=>setStep(0)}><span className="mark">C</span><span>THE CLIP LAB<small>POWERED BY CLIP-E</small></span></button><span className="status"><i/> PROTOTYPE MODE</span></header><nav className="flowNav">{nav.map(([label,target],i)=><button className={(active===target?'active ':'')+(i<progressIndex?'complete':'')} onClick={()=>setStep(target)} key={label}><span className="flowNode">{i<progressIndex?'✓':String(i+1).padStart(2,'0')}</span><span className="flowLabel">{label}</span></button>)}</nav><div className="progress verticalProgress"><span style={{height:(progressIndex/(nav.length-1)*100)+'%'}}/></div></>}
function Shell({step,setStep,children,title,kicker,desc,guard=false,guardLabel='',nextStep=null,prevStep=null,hidePager=false,onNext=null}){return <main className="stageShell">{kicker&&<div className="eyebrow">{kicker}</div>}{title&&<h1>{title}</h1>}{desc&&<p className="lead">{desc}</p>}{children}{!hidePager&&<div className="pager">{step>0&&<button className="ghost" onClick={()=>setStep(prevStep??step-1)}>Back</button>}{step<steps.length-1&&<button className="primary" disabled={guard} title={guard?guardLabel:''} onClick={()=>{if(guard)return;if(onNext)onNext();else setStep(nextStep??step+1)}}>Continue <ArrowRight size={17}/></button>}</div>}{guard&&guardLabel&&<div className="continueHint"><ShieldCheck/>{guardLabel}</div>}</main>}

function App(){const[step,setStep]=useState(()=>Number(sessionStorage.getItem('clipStep')||0));const[style,setStyle]=useState(()=>Number(sessionStorage.getItem('clipStyle')||0));const[gender,setGender]=useState('men');const[paused,setPaused]=useState(false);const[voice,setVoice]=useState('idle');const[change,setChange]=useState(false);const[headView,setHeadView]=useState(3);const[planApproved,setPlanApproved]=useState(false);const[sessionRating,setSessionRating]=useState(0);const[armStatus,setArmStatus]=useState({online:false,payload:{}});const[setupChecks,setSetupChecks]=useState({workspace:false,seated:false,stop:false});const[finalPhoto,setFinalPhoto]=useState(()=>sessionStorage.getItem('clipFinalPhoto')||'');const[feedback,setFeedback]=useState([]);
const videoRef=useRef(null),fileRef=useRef(null),backFileRef=useRef(null),finalRef=useRef(null);const[stream,setStream]=useState(null);const[rearStream,setRearStream]=useState(null);const[cameras,setCameras]=useState([]);const[selectedCamera,setSelectedCamera]=useState('');const[selectedRearCamera,setSelectedRearCamera]=useState('');const[calibrationCameraState,setCalibrationCameraState]=useState('idle');const[rearCalibrationCameraState,setRearCalibrationCameraState]=useState('idle');const[photo,setPhoto]=useState(()=>sessionStorage.getItem('clipPhoto')||localStorage.getItem('clipPhoto')||'');const[scanState,setScanState]=useState('Camera ready');const[analysis,setAnalysis]=useState(()=>JSON.parse(sessionStorage.getItem('clipAnalysis')||localStorage.getItem('clipAnalysis')||'null'));const[preview,setPreview]=useState(()=>sessionStorage.getItem('clipPreview')||'');const[previewing,setPreviewing]=useState(false);const[previewError,setPreviewError]=useState('');const[showOriginal,setShowOriginal]=useState(true);const[topLength,setTopLength]=useState(25);const[sideLength,setSideLength]=useState(6);const[fadeHeight,setFadeHeight]=useState('Mid');const[texture,setTexture]=useState('Medium');const[finish,setFinish]=useState('Natural');const[dirty,setDirty]=useState(false);const[faceMap,setFaceMap]=useState(false);const[analysisOpen,setAnalysisOpen]=useState(false);const[scanPose,setScanPose]=useState(0);const[scanShots,setScanShots]=useState(()=>{try{return JSON.parse(sessionStorage.getItem('clipScanShots')||localStorage.getItem('clipScanShots')||'[]')}catch{return[]}});const[analyzing,setAnalyzing]=useState(false);const[analysisError,setAnalysisError]=useState('');const[talkState,setTalkState]=useState('idle');const[userSaid,setUserSaid]=useState('');const[clipSaid,setClipSaid]=useState('Ask me about your cut.');const[robotCameraOnline,setRobotCameraOnline]=useState(false);const[robotFrame,setRobotFrame]=useState(Date.now());const[phoneCameraOnline,setPhoneCameraOnline]=useState(false);const[phoneFrame,setPhoneFrame]=useState(Date.now());const[phoneSignalSeen,setPhoneSignalSeen]=useState(false);const[phoneSessionId,setPhoneSessionId]=useState(()=>{const existing=sessionStorage.getItem('clipPhoneSession');if(existing)return existing;const id='scan-'+Math.random().toString(36).slice(2,10);sessionStorage.setItem('clipPhoneSession',id);return id});const phoneCameraUrl=`${window.location.origin}/phone-camera?session=${phoneSessionId}&mode=scan`;const[clipEPhoneCameraOnline,setClipEPhoneCameraOnline]=useState(false);const[clipEPhoneFrame,setClipEPhoneFrame]=useState(Date.now());const[clipEPhoneSignalSeen,setClipEPhoneSignalSeen]=useState(false);const[clipEPhoneSessionId,setClipEPhoneSessionId]=useState(()=>{const existing=sessionStorage.getItem('clipERearPhoneSession');if(existing)return existing;const id='clipe-'+Math.random().toString(36).slice(2,10);sessionStorage.setItem('clipERearPhoneSession',id);return id});const clipEPhoneCameraUrl=`${window.location.origin}/phone-camera?session=${clipEPhoneSessionId}&mode=clip-e`;const[savedStyles,setSavedStyles]=useState(()=>{try{return JSON.parse(localStorage.getItem('clipSavedSessions')||'[]')}catch{return[]}});const[hairGoal,setHairGoal]=useState('Try something new');const[previewCache,setPreviewCache]=useState({});const[presageState,setPresageState]=useState('standby');const[presageSignal,setPresageSignal]=useState(null);const[scanSignal,setScanSignal]=useState(null);const[hairAnalysis,setHairAnalysis]=useState(()=>{try{return JSON.parse(sessionStorage.getItem('clipHairAnalysis')||'null')}catch{return null}});const[hairAnalyzing,setHairAnalyzing]=useState(false);const[hairAnalysisRetry,setHairAnalysisRetry]=useState(0);const[hairAnalysisError,setHairAnalysisError]=useState('');const[scanAnalysisStage,setScanAnalysisStage]=useState(()=>sessionStorage.getItem('clipScanAnalysisStage')||'');const[profileReady,setProfileReady]=useState(()=>sessionStorage.getItem('clipProfileReady')==='1');const[topMatches,setTopMatches]=useState(()=>{try{return JSON.parse(sessionStorage.getItem('clipTopMatches')||'[]')}catch{return[]}});const[styleQuery,setStyleQuery]=useState(()=>sessionStorage.getItem('clipStyleQuery')||'');const[lengthFilter,setLengthFilter]=useState(()=>sessionStorage.getItem('clipLengthFilter')||'ALL');const[patternFilter,setPatternFilter]=useState(()=>sessionStorage.getItem('clipPatternFilter')||'ALL');const[tagFilters,setTagFilters]=useState(()=>{try{return JSON.parse(sessionStorage.getItem('clipTagFilters')||'[]')}catch{return[]}});const[stylePreviewOpen,setStylePreviewOpen]=useState(false);const[styleTransition,setStyleTransition]=useState('');const[sessionTransition,setSessionTransition]=useState('');const[clipEPhase,setClipEPhase]=useState(()=>sessionStorage.getItem('clipEPhase')||'plan');const[operatorKey,setOperatorKey]=useState(()=>sessionStorage.getItem('clipOperatorKey')||'');const[assistCommandState,setAssistCommandState]=useState('idle');const matchShape=hairAnalysis?.faceProfile?.shape&&hairAnalysis.faceProfile.shape!=='Unable to determine from scan'?hairAnalysis.faceProfile.shape:analysis?.shape;const recommendations=hairAnalysis?personalizedStyles(hairAnalysis,matchShape):[];const topThreeMatches=topMatches.length===3?topMatches:recommendations.slice(0,3);const selectedStyle=unifiedStyles[style]||unifiedStyles[0];const filteredStyles=unifiedStyles.filter(item=>{const q=styleQuery.trim().toLowerCase();const queryOk=!q||item.name.toLowerCase().includes(q)||item.tags.join(' ').toLowerCase().includes(q);const lengthOk=lengthFilter==='ALL'||item.length===lengthFilter;const patternOk=patternFilter==='ALL'||item.patterns.includes(patternFilter);const tagsOk=!tagFilters.length||tagFilters.every(t=>item.tags.includes(t));return queryOk&&lengthOk&&patternOk&&tagsOk});const calibrationCoverageReady=!!stream&&!!rearStream&&!!analysis;const phoneCalibrationState=clipEPhoneCameraOnline?'live':clipEPhoneSignalSeen?'connecting':'waiting';const rearCutPlan=buildRearCutPlan(selectedStyle,hairAnalysis);const rearWorkCount=rearCutPlan.filter(x=>x.work).length;const arduinoCameraSrc='/api/camera/latest?device=camera-01&t='+robotFrame;
useEffect(()=>{if(stream&&videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play().catch(()=>{})}},[stream,step,clipEPhase]);useEffect(()=>()=>stream?.getTracks().forEach(t=>t.stop()),[stream]);useEffect(()=>()=>rearStream?.getTracks().forEach(t=>t.stop()),[rearStream]);useEffect(()=>sessionStorage.setItem('clipStep',String(step)),[step]);useEffect(()=>sessionStorage.setItem('clipStyle',String(style)),[style]);useEffect(()=>{try{sessionStorage.setItem('clipScanShots',JSON.stringify(scanShots));localStorage.setItem('clipScanShots',JSON.stringify(scanShots))}catch{}},[scanShots]);useEffect(()=>sessionStorage.setItem('clipStyleQuery',styleQuery),[styleQuery]);useEffect(()=>sessionStorage.setItem('clipLengthFilter',lengthFilter),[lengthFilter]);useEffect(()=>sessionStorage.setItem('clipPatternFilter',patternFilter),[patternFilter]);useEffect(()=>sessionStorage.setItem('clipTagFilters',JSON.stringify(tagFilters)),[tagFilters]);useEffect(()=>sessionStorage.setItem('clipEPhase',clipEPhase),[clipEPhase]);useEffect(()=>{if(scanAnalysisStage)sessionStorage.setItem('clipScanAnalysisStage',scanAnalysisStage);else sessionStorage.removeItem('clipScanAnalysisStage')},[scanAnalysisStage]);useEffect(()=>{if(profileReady)sessionStorage.setItem('clipProfileReady','1');else sessionStorage.removeItem('clipProfileReady')},[profileReady]);useEffect(()=>{try{sessionStorage.setItem('clipTopMatches',JSON.stringify(topMatches))}catch{}},[topMatches]);useEffect(()=>{if(step===5&&clipEPhase==='calibrate'&&stream)setCalibrationCameraState('live')},[step,clipEPhase,stream]);useEffect(()=>{if(step===5&&clipEPhase==='calibrate'&&rearStream)setRearCalibrationCameraState('live')},[step,clipEPhase,rearStream]);useEffect(()=>{if(operatorKey)sessionStorage.setItem('clipOperatorKey',operatorKey);else sessionStorage.removeItem('clipOperatorKey')},[operatorKey]);useEffect(()=>{if(preview)try{sessionStorage.setItem('clipPreview',preview)}catch{}},[preview]);useEffect(()=>{if(step===4)setStep(3);if(step===6){setClipEPhase('plan');setStep(5)}if(step===7){setClipEPhase('calibrate');setStep(5)}if(step===8){setClipEPhase('assist');setStep(5)}if(step===9){setClipEPhase('verify');setStep(5)}},[step]);useEffect(()=>{if(step!==5&&step!==7&&step!==8)return;let live=true;const poll=async()=>{try{const r=await fetch('/api/camera/status?device=camera-01',{cache:'no-store'}),j=await r.json();if(live)setRobotCameraOnline(!!j.online)}catch{if(live)setRobotCameraOnline(false)}};poll();const statusTimer=setInterval(poll,1000);const frameTimer=setInterval(()=>{if(live&&robotCameraOnline)setRobotFrame(Date.now())},100);return()=>{live=false;clearInterval(statusTimer);clearInterval(frameTimer)}},[step,robotCameraOnline]);useEffect(()=>{if(step!==5&&step!==7&&step!==8)return;let live=true;const poll=async()=>{try{const r=await fetch('/api/arm/latest?device=arm-01',{cache:'no-store'}),j=await r.json();if(live)setArmStatus({online:!!j.online,payload:j.payload||{},last_seen:j.last_seen||null})}catch{if(live)setArmStatus({online:false,payload:{}})}};poll();const t=setInterval(poll,1200);return()=>{live=false;clearInterval(t)}},[step]);useEffect(()=>{if(step!==1)return;let live=true;const poll=async()=>{try{const r=await fetch('/api/camera/status?device=phone-back-01&session='+encodeURIComponent(phoneSessionId),{cache:'no-store'}),j=await r.json();if(live){setPhoneCameraOnline(!!j.online);if(j.online)setPhoneFrame(Date.now())}}catch{if(live)setPhoneCameraOnline(false)}};poll();const t=setInterval(poll,1000);return()=>{live=false;clearInterval(t)}},[step,phoneSessionId]);useEffect(()=>{if(!(step===5||step===7||step===8)){setClipEPhoneCameraOnline(false);return}let live=true;const poll=async()=>{try{const r=await fetch('/api/camera/status?device=phone-back-01&session='+encodeURIComponent(clipEPhoneSessionId),{cache:'no-store'}),j=await r.json();if(live){setClipEPhoneCameraOnline(!!j.online);if(j.online)setClipEPhoneFrame(Date.now())}}catch{if(live)setClipEPhoneCameraOnline(false)}};poll();const t=setInterval(poll,1000);return()=>{live=false;clearInterval(t)}},[step,clipEPhoneSessionId]);useEffect(()=>{if(!(step===5&&clipEPhase==='calibrate')){setClipEPhoneSignalSeen(false);return}let live=true;const poll=async()=>{try{const r=await fetch('/api/camera/signal?session='+encodeURIComponent(clipEPhoneSessionId),{cache:'no-store'}),j=await r.json();const fresh=j.updated_at&&(Date.now()-new Date(j.updated_at).getTime()<15000);if(live)setClipEPhoneSignalSeen(!clipEPhoneCameraOnline&&!!j.offer&&!!fresh)}catch{if(live)setClipEPhoneSignalSeen(false)}};poll();const t=setInterval(poll,900);return()=>{live=false;clearInterval(t)}},[step,clipEPhase,clipEPhoneSessionId,clipEPhoneCameraOnline]);
async function runFullScanAnalysis(images){
  const four=(images||[]).slice(0,4);
  if(four.length<4||four.some(x=>!x)){
    setHairAnalysisError('Clip-E needs Front, Left, Right, and Back before analysis can begin.');
    setProfileReady(false);
    return false;
  }
  setHairAnalyzing(true);
  setHairAnalysisError('');
  setHairAnalysis(null);
  setTopMatches([]);
  setProfileReady(false);
  sessionStorage.removeItem('clipHairAnalysis');
  sessionStorage.removeItem('clipTopMatches');
  sessionStorage.removeItem('clipProfileReady');
  const stages=[
    'Validating four views...',
    'Analyzing facial proportions...',
    'Analyzing hair pattern and texture...',
    'Comparing front, side and rear views...',
    'Building your Clip-E profile...'
  ];
  let stageIndex=0;
  setScanAnalysisStage(stages[0]);
  const stageTimer=setInterval(()=>{
    stageIndex=Math.min(stageIndex+1,stages.length-1);
    setScanAnalysisStage(stages[stageIndex]);
  },900);
  try{
    const r=await fetch('/api/hair-analysis',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        images:four,
        viewLabels:['Front','Left','Right','Back'],
        faceGeometry:analysis?{
          shape:analysis.shape,
          proportion:analysis.proportion,
          jaw:analysis.jaw,
          cheekbones:analysis.cheekbones,
          ratio:analysis.ratio,
          jawRatio:analysis.jawRatio,
          cheekRatio:analysis.cheekRatio,
          foreheadRatio:analysis.foreheadRatio,
          lowerFaceRatio:analysis.lowerFaceRatio
        }:null
      })
    });
    const raw=await r.text();
    let j=null;
    try{j=JSON.parse(raw)}catch{throw Error(r.ok?'Gemini returned an unreadable profile response':(raw?.slice(0,240)||'Profile analysis server error'))}
    if(!r.ok)throw Error(j.error||'Gemini profile analysis failed');
    if(!j.analysis)throw Error('Gemini returned no profile analysis');
    clearInterval(stageTimer);
    setScanAnalysisStage('Finding your strongest hairstyle matches...');
    const returned={...j.analysis,_analysisEngine:j.fallback?'local-scan-fallback':'gemini',_analysisModel:j.model||''};
    const returnedShape=returned?.faceProfile?.shape&&returned.faceProfile.shape!=='Unable to determine from scan'?returned.faceProfile.shape:analysis?.shape;
    const matches=personalizedStyles(returned,returnedShape).slice(0,3);
    if(matches.length<3)throw Error('Clip-E could not determine three evidence-based hairstyle matches from this scan.');
    setHairAnalysis(returned);
    setTopMatches(matches);
    sessionStorage.setItem('clipHairAnalysis',JSON.stringify(returned));
    sessionStorage.setItem('clipTopMatches',JSON.stringify(matches));
    await new Promise(resolve=>setTimeout(resolve,250));
    setProfileReady(true);
    sessionStorage.setItem('clipProfileReady','1');
    setScanAnalysisStage('PROFILE READY ✓');
    setScanState(j.fallback?'Profile ready ✓ · Gemini quota unavailable, local scan geometry used':'Analysis complete ✓ · Continue to Profile');
    return true;
  }catch(e){
    clearInterval(stageTimer);
    console.error('Clip-E full profile analysis failed',e);
    setHairAnalysis(null);
    setTopMatches([]);
    setProfileReady(false);
    sessionStorage.removeItem('clipHairAnalysis');
    sessionStorage.removeItem('clipTopMatches');
    sessionStorage.removeItem('clipProfileReady');
    setScanAnalysisStage('Analysis could not complete');
    setHairAnalysisError(e?.message||'Gemini profile analysis failed');
    setScanState('Analysis needs another attempt');
    return false;
  }finally{
    clearInterval(stageTimer);
    setHairAnalyzing(false);
  }
}

async function refreshHairAnalysis(){
  if((scanShots||[]).filter(Boolean).length<4){
    setHairAnalysisError('Capture all four views before retrying analysis.');
    return;
  }
  await runFullScanAnalysis(scanShots);
}

/* Clip-E conversational camera */
useEffect(()=>{if(!((step===5&&clipEPhase==='assist')||step===8)||stream)return;let cancelled=false;(async()=>{await startCamera();if(cancelled){setStream(current=>{current?.getTracks().forEach(t=>t.stop());return null})}})();return()=>{cancelled=true}},[step]);

async function loadCameras(){try{const warm=await navigator.mediaDevices.getUserMedia({video:true,audio:false});warm.getTracks().forEach(t=>t.stop());const ds=await navigator.mediaDevices.enumerateDevices();const cams=ds.filter(d=>d.kind==='videoinput');setCameras(cams);const frontId=selectedCamera||cams[0]?.deviceId||'';if(!selectedCamera&&frontId)setSelectedCamera(frontId);if(!selectedRearCamera){const rearDefault=cams.find(cam=>cam.deviceId!==frontId)?.deviceId||cams[0]?.deviceId||'';if(rearDefault)setSelectedRearCamera(rearDefault)}return cams}catch(e){setScanState('Camera permission denied — allow camera access in your browser');return[]}}
async function tuneCameraTrack(track,label='camera'){
  if(!track)return;
  try{
    const settings=track.getSettings?.()||{};
    const caps=track.getCapabilities?.()||{};
    console.info('[Clip-E '+label+'] settings',settings);
    console.info('[Clip-E '+label+'] capabilities',caps);
    const maxFps=typeof caps.frameRate?.max==='number'?caps.frameRate.max:30;
    const minFps=typeof caps.frameRate?.min==='number'?caps.frameRate.min:0;
    const target=Math.min(30,Math.max(minFps||0,maxFps||30));
    if(track.applyConstraints&&target){
      const frameRate={ideal:target,max:target};
      if(target>=20)frameRate.min=20;
      try{await track.applyConstraints({frameRate})}catch(e){console.warn('[Clip-E '+label+'] frame-rate constraint not applied',e)}
    }
    console.info('[Clip-E '+label+'] tuned settings',track.getSettings?.()||{});
  }catch(e){console.warn('[Clip-E '+label+'] capability inspection failed',e)}
}
async function openLocalCamera(deviceId=''){
  const preferred={width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,min:20,max:30}};
  if(deviceId)preferred.deviceId={exact:deviceId};
  try{return await navigator.mediaDevices.getUserMedia({video:preferred,audio:false})}
  catch(e){
    console.warn('[Clip-E camera] 30 FPS request unavailable; retrying without hard minimum',e);
    const fallback={width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}};
    if(deviceId)fallback.deviceId={exact:deviceId};
    return await navigator.mediaDevices.getUserMedia({video:fallback,audio:false});
  }
}
async function startCamera(deviceId=selectedCamera){
  try{
    stream?.getTracks().forEach(t=>t.stop());
    const cams=cameras.length?cameras:await loadCameras();
    const id=deviceId||cams[0]?.deviceId||'';
    const s=await openLocalCamera(id);
    const track=s.getVideoTracks()[0];
    await tuneCameraTrack(track,'computer camera');
    setSelectedCamera(track?.getSettings?.()?.deviceId||id||'');
    setStream(s);setScanState('Center your face');return true
  }catch(e){
    console.error('[Clip-E computer camera] failed',e);
    setScanState('Could not open that camera — choose another camera or upload a photo');return false
  }
}
async function startCalibrationCamera(deviceId=selectedCamera){setCalibrationCameraState('initializing');const ok=await startCamera(deviceId);setCalibrationCameraState(ok?'live':'error');return ok}
async function startRearCalibrationCamera(deviceId=selectedRearCamera){
  setRearCalibrationCameraState('initializing');
  try{
    rearStream?.getTracks().forEach(t=>t.stop());
    const cams=cameras.length?cameras:await loadCameras();
    const frontId=selectedCamera||cams[0]?.deviceId||'';
    const id=deviceId||selectedRearCamera||cams.find(cam=>cam.deviceId!==frontId)?.deviceId||cams[0]?.deviceId||'';
    const s=await openLocalCamera(id);
    const track=s.getVideoTracks()[0];
    await tuneCameraTrack(track,'rear camera');
    const actual=track?.getSettings?.()?.deviceId||id||'';
    setSelectedRearCamera(actual);setRearStream(s);setRearCalibrationCameraState('live');return true
  }catch(e){
    console.error('[Clip-E rear camera] failed',e);
    setRearCalibrationCameraState('error');return false
  }
}
async function disconnectAllCameras(){
  const scanSession=phoneSessionId,clipSession=clipEPhoneSessionId;
  stream?.getTracks().forEach(t=>t.stop());
  rearStream?.getTracks().forEach(t=>t.stop());
  if(videoRef.current)videoRef.current.srcObject=null;
  setStream(null);setRearStream(null);setCalibrationCameraState('idle');setRearCalibrationCameraState('idle');
  setPhoneCameraOnline(false);setPhoneSignalSeen(false);
  setClipEPhoneCameraOnline(false);setClipEPhoneSignalSeen(false);
  await Promise.allSettled([
    fetch('/api/camera/signal?session='+encodeURIComponent(scanSession),{method:'DELETE'}),
    fetch('/api/camera/signal?session='+encodeURIComponent(clipSession),{method:'DELETE'})
  ]);
  const nextScan='scan-'+Math.random().toString(36).slice(2,10);
  const nextClip='clipe-'+Math.random().toString(36).slice(2,10);
  sessionStorage.setItem('clipPhoneSession',nextScan);
  sessionStorage.setItem('clipERearPhoneSession',nextClip);
  setPhoneSessionId(nextScan);setClipEPhoneSessionId(nextClip);
}
async function analyzeImage(data){setAnalyzing(true);setAnalysisError('');setScanState('Analyzing your face…');try{const mod=await import('@mediapipe/tasks-vision');const files=await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');const landmarker=await mod.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',delegate:'CPU'},runningMode:'IMAGE',numFaces:1,minFaceDetectionConfidence:.2,minFacePresenceConfidence:.2,minTrackingConfidence:.2});const img=new Image();img.src=data;await img.decode();let r=landmarker.detect(img);if(!r.faceLandmarks?.[0]?.length){const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;const ctx=cv.getContext('2d');ctx.translate(cv.width,0);ctx.scale(-1,1);ctx.drawImage(img,0,0);r=landmarker.detect(cv)}const p=r.faceLandmarks?.[0];if(!p?.length)throw Error('Face not detected');const dist=(a,b)=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y);const length=dist(10,152),width=dist(234,454),jaw=dist(172,397),cheek=dist(93,323),ratio=length/width;let shape=ratio>1.42?'Oblong / Rectangle':ratio<1.12?'Round':jaw/width>.88?'Square':jaw/width<.72?'Heart / Diamond':'Oval';const forehead=dist(103,332),lower=dist(172,397),a={shape,proportion:ratio>1.2?'Slightly elongated':ratio<1.08?'Balanced width and length':'Balanced proportions',jaw:jaw/width<.78?'Soft taper':'Broad / softly tapered',cheekbones:cheek/width>.72?'Prominent':'Balanced',hairline:'Visible / partially visible',faceWidth:width.toFixed(3),jawRatio:(jaw/width).toFixed(2),cheekRatio:(cheek/width).toFixed(2),foreheadRatio:(forehead/width).toFixed(2),lowerFaceRatio:(lower/width).toFixed(2),ratio:ratio.toFixed(2),landmarks:p.length,points:p.map(q=>({x:q.x,y:q.y})),sources:['MediaPipe facial geometry','Front + profile scan views']};setAnalysis(a);sessionStorage.setItem('clipAnalysis',JSON.stringify(a));localStorage.setItem('clipAnalysis',JSON.stringify(a));setScanState('Face analyzed ✓');landmarker.close();return true}catch(e){console.error('Clip-E face analysis failed',e);setAnalysis(null);sessionStorage.removeItem('clipAnalysis');localStorage.removeItem('clipAnalysis');setAnalysisError('Clip-E could not map enough facial landmarks in this frame. Keep your full face, forehead, jaw and both ears in view, then try again.');setScanState('Face not detected — retake front photo');return false}finally{setAnalyzing(false)}}
async function normalizePhoto(data){return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const max=1536,s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.naturalWidth*s));cv.height=Math.max(1,Math.round(img.naturalHeight*s));cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);resolve(cv.toDataURL('image/jpeg',.9))};img.onerror=reject;img.src=data})}
async function savePhoto(data){const clean=await normalizePhoto(data);setPhoto(clean);setHairAnalysis(null);sessionStorage.removeItem('clipHairAnalysis');sessionStorage.setItem('clipPhoto',clean);try{localStorage.setItem('clipPhoto',clean)}catch{}setPreview('');setShowOriginal(true);analyzeImage(clean)}
async function capturePosition(){
  if(scanPose>=4)return;
  if(analyzing||hairAnalyzing)return;
  let data='';
  setAnalyzing(true);
  try{
    if(scanPose===3){
      setScanState('Capturing back of head…');
      let lastError=null;
      for(let attempt=0;attempt<5&&!data;attempt++){
        try{
          const r=await fetch('/api/camera/latest?device=phone-back-01&session='+encodeURIComponent(phoneSessionId)+'&t='+Date.now(),{cache:'no-store'});
          if(!r.ok)throw Error('Back camera frame unavailable');
          const blob=await r.blob();
          if(!blob.size)throw Error('Back camera returned an empty frame');
          data=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(blob)});
          if(!String(data||'').startsWith('data:image/'))throw Error('Back camera frame was not an image');
        }catch(e){
          lastError=e;
          if(attempt<4)await new Promise(r=>setTimeout(r,350));
        }
      }
      if(!data){
        console.warn('[Clip-E scan] rear photo capture failed',lastError);
        setScanState(phoneCameraOnline?'Back frame is still syncing — keep the phone camera aimed at the back and tap CAPTURE again':'Rear phone not synced yet — keep the phone camera open, then tap CAPTURE again');
        return;
      }
    }else{
      const v=videoRef.current;
      if(!v?.videoWidth){setScanState('Camera frame is not ready yet');return}
      const cv=document.createElement('canvas');
      cv.width=v.videoWidth;cv.height=v.videoHeight;
      cv.getContext('2d').drawImage(v,0,0);
      data=cv.toDataURL('image/jpeg',.92);
    }
    data=await normalizePhoto(data);
    if(scanPose===0){
      setScanState('Analyzing front geometry…');
      setPhoto(data);
      sessionStorage.setItem('clipPhoto',data);
      try{localStorage.setItem('clipPhoto',data)}catch{}
      const ok=await analyzeImage(data);
      if(!ok){setScanShots([]);setScanPose(0);return}
    }
    const next=[...scanShots];
    next[scanPose]=data;
    setScanShots(next);
    try{sessionStorage.setItem('clipScanShots',JSON.stringify(next));localStorage.setItem('clipScanShots',JSON.stringify(next))}catch{}
    if(scanPose<3){
      await new Promise(r=>setTimeout(r,220));
      const n=scanPose+1;
      setScanPose(n);
      setScanState(['Look straight ahead','Turn left','Turn right','Open the phone back camera'][n]);
      return;
    }
    setScanPose(4);
    setScanState('SCAN COMPLETE ✓ · 4 OF 4 VIEWS CAPTURED');
    stream?.getTracks().forEach(t=>t.stop());
    setStream(null);
    setAnalyzing(false);
    await runFullScanAnalysis(next);
  }finally{
    setAnalyzing(false);
  }
}
async function captureClipEConversationFrame(){if(!stream)return'';try{const v=document.createElement('video');v.muted=true;v.playsInline=true;v.srcObject=stream;await v.play();if(!v.videoWidth){await new Promise(r=>setTimeout(r,120))}if(!v.videoWidth)return'';const maxW=640,scale=Math.min(1,maxW/v.videoWidth);const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(v.videoWidth*scale));cv.height=Math.max(1,Math.round(v.videoHeight*scale));cv.getContext('2d').drawImage(v,0,0,cv.width,cv.height);v.pause();v.srcObject=null;return cv.toDataURL('image/jpeg',.68)}catch(e){console.warn('Clip-E conversational frame unavailable',e);return''}}
async function sendArmAssist(command,args={}){
  if(!operatorKey){setAssistCommandState('Enter operator key first');return}
  setAssistCommandState('sending');
  try{
    const r=await fetch('/api/arm/operator-command',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-trimsync-operator-key':operatorKey},
      body:JSON.stringify({command,args})
    });
    const j=await r.json();
    if(!r.ok)throw Error(j.error||'Command failed');
    setAssistCommandState(command==='approach_nudge'?(args.forward>0?'forward nudge queued':'back nudge queued'):command+' queued');
  }catch(e){setAssistCommandState(e.message||'Command failed')}
}
async function askClipE(message){if(!message)return;setUserSaid(message);if(/^(pause|pause clip-e)$/i.test(message.trim())){setPaused(true);setClipSaid('Pause requested in the interface. Confirm the physical arm has stopped before continuing.');return}if(/^(stop|stop cut)$/i.test(message.trim())){setPaused(true);setClipSaid('Stop requested in the interface. Use the physical emergency stop if the arm is still moving.');return}setTalkState('thinking');try{const frameDataUrl=await captureClipEConversationFrame();const context={stage:'Live Cut',userProfile:{selectedStyle:styles[style]?.[0]||'Selected style',hairGoal},cutPlan:{topLengthMm:topLength,sideLengthMm:sideLength,fadeHeight,texture,finish,approved:planApproved},robot:{online:armStatus.online,status:paused?'ui-paused':armStatus.payload?.mode||'unknown',armed:Boolean(armStatus.payload?.armed),pcaReady:Boolean(armStatus.payload?.pca_ready),estop:Boolean(armStatus.payload?.estop),jointDeg:Array.isArray(armStatus.payload?.joint_deg)?armStatus.payload.joint_deg.slice(0,5):null},safety:{uiPaused:paused,physicalEstopReported:Boolean(armStatus.payload?.estop),robotCamera:robotCameraOnline?'online':'offline'},cameras:{userFacing:stream?'online':'offline',frontSide:{device:'camera-01',status:robotCameraOnline?'online':'offline',role:'front_side_workspace'},rearHead:{device:'phone-back-01',status:clipEPhoneCameraOnline?'online':'offline',role:'back_head_neckline'}},presage:{available:!!presageSignal,status:presageState,signal:presageSignal||null,note:presageSignal?'Presage is contextual only; do not infer internal emotion, medical state, or safety from it.':'No current Presage signal'},scanAnalysis:analysis?{shape:analysis.shape,proportion:analysis.proportion,jaw:analysis.jaw,cheekbones:analysis.cheekbones,landmarks:analysis.landmarks}:null,conversationEvent:{source:'barber-voice',transcript:message},timestamp:new Date().toISOString()};const r=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,transcript:message,context,frameDataUrl})});const j=await r.json();if(!r.ok)throw Error(j.error||'Clip-E unavailable');setClipSaid(j.text);setTalkState('speaking');const a=await fetch('/api/ai/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:j.text})});if(!a.ok){let detail='ElevenLabs voice failed';try{const ej=await a.json();detail=ej.error||detail}catch{}throw Error(detail)}const blob=await a.blob();const audioUrl=URL.createObjectURL(blob);const audio=new Audio(audioUrl);audio.preload='auto';audio.volume=1;audio.onended=()=>{URL.revokeObjectURL(audioUrl);setTalkState('idle')};audio.onerror=()=>{URL.revokeObjectURL(audioUrl);setClipSaid(j.text+' — Voice playback failed.');setTalkState('idle')};try{await audio.play()}catch(playErr){URL.revokeObjectURL(audioUrl);setClipSaid(j.text+' — Tap Talk to Clip-E again to enable audio playback.');setTalkState('idle')}}catch(e){setClipSaid(e.message);setTalkState('idle')}}function startClipVoice(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setClipSaid('Voice input is not supported in this browser.');return}const r=new SR();r.lang='en-US';r.interimResults=false;setTalkState('listening');r.onresult=e=>askClipE(e.results[0][0].transcript);r.onerror=()=>setTalkState('idle');r.onend=()=>setTalkState(x=>x==='listening'?'idle':x);r.start()}function retake(){stream?.getTracks().forEach(t=>t.stop());setStream(null);setPhoto('');setPreview('');setAnalysis(null);setHairAnalysis(null);setTopMatches([]);setProfileReady(false);setScanAnalysisStage('');setHairAnalysisError('');setScanShots([]);setScanPose(0);setAnalyzing(false);sessionStorage.removeItem('clipPhoto');sessionStorage.removeItem('clipAnalysis');sessionStorage.removeItem('clipHairAnalysis');sessionStorage.removeItem('clipTopMatches');sessionStorage.removeItem('clipProfileReady');sessionStorage.removeItem('clipScanAnalysisStage');sessionStorage.removeItem('clipScanShots');sessionStorage.removeItem('clipFinalPhoto');localStorage.removeItem('clipPhoto');localStorage.removeItem('clipAnalysis');setScanState('Camera ready')}
async function makeDemoPersonScans(){
  const sheet=new Image();
  sheet.src=DEMO_PERSON_SHEET;
  await sheet.decode();

  const cellWidth=Math.floor(sheet.naturalWidth/2);
  const cellHeight=Math.floor(sheet.naturalHeight/2);
  const coords=[
    [0,0],
    [cellWidth,0],
    [0,cellHeight],
    [cellWidth,cellHeight]
  ];

  return coords.map(([sx,sy])=>{
    const cv=document.createElement('canvas');
    cv.width=cellWidth;
    cv.height=cellHeight;
    const ctx=cv.getContext('2d',{alpha:false});
    ctx.drawImage(sheet,sx,sy,cellWidth,cellHeight,0,0,cellWidth,cellHeight);
    return cv.toDataURL('image/jpeg',.94);
  });
}

async function loadDemoPerson(){
  if(hairAnalyzing||analyzing)return;
  try{
    stream?.getTracks().forEach(t=>t.stop());
    setStream(null);
    setHairAnalysis(null);
    setTopMatches([]);
    setProfileReady(false);
    setScanAnalysisStage('');
    setHairAnalysisError('');
    setScanState('Loading demo scan…');

    const demo=await makeDemoPersonScans();
    setPhoto(demo[0]);
    setScanShots(demo);
    setScanPose(4);
    sessionStorage.setItem('clipPhoto',demo[0]);
    sessionStorage.setItem('clipScanShots',JSON.stringify(demo));
    try{localStorage.setItem('clipPhoto',demo[0])}catch{}

    // Photorealistic synthetic demo views. Let MediaPipe try the front image,
    // but Gemini still analyzes all four views even if local landmarks do not resolve.
    const faceMapped=await analyzeImage(demo[0]);
    if(!faceMapped){
      setAnalysis(null);
      sessionStorage.removeItem('clipAnalysis');
      localStorage.removeItem('clipAnalysis');
      setAnalysisError('');
    }
    setScanState('DEMO SCAN LOADED ✓ · 4 OF 4 VIEWS');
    await runFullScanAnalysis(demo);
  }catch(err){
    console.error('Clip-E demo scan failed',err);
    setScanState('Demo scan could not load');
    setHairAnalysisError(err?.message||'Demo scan failed');
  }
}

async function uploadPhoto(e){
  const files=Array.from(e.target.files||[]).filter(file=>file.type.startsWith('image/'));
  e.target.value='';
  if(!files.length)return;

  const readFile=file=>new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });

  try{
    if(files.length>=4){
      setHairAnalysis(null);
      setTopMatches([]);
      setProfileReady(false);
      setScanAnalysisStage('');
      setHairAnalysisError('');
      setScanState('Loading Front, Left, Right, and Back…');

      const selected=files.slice(0,4);
      const raw=await Promise.all(selected.map(readFile));
      const clean=await Promise.all(raw.map(normalizePhoto));

      const front=clean[0];
      setPhoto(front);
      sessionStorage.setItem('clipPhoto',front);
      try{localStorage.setItem('clipPhoto',front)}catch{}

      setScanShots(clean);
      try{sessionStorage.setItem('clipScanShots',JSON.stringify(clean))}catch{}

      setScanPose(4);
      setScanState('4 OF 4 PHOTOS LOADED ✓ · validating front view');

      const ok=await analyzeImage(front);
      if(!ok){
        setScanPose(0);
        setScanState('Front image could not be mapped — upload a clearer Front, Left, Right, Back set');
        return;
      }

      setScanPose(4);
      setScanState('SCAN COMPLETE ✓ · 4 OF 4 VIEWS CAPTURED');
      stream?.getTracks().forEach(t=>t.stop());
      setStream(null);
      await runFullScanAnalysis(clean);
      return;
    }

    // Keep single/multi partial upload support for replacing or filling remaining slots.
    const raw=await Promise.all(files.slice(0,4).map(readFile));
    const clean=await Promise.all(raw.map(normalizePhoto));
    const next=[...scanShots];
    let slot=Math.min(scanPose,3);
    clean.forEach(img=>{
      while(slot<4&&next[slot])slot++;
      if(slot<4){next[slot]=img;slot++}
    });

    setScanShots(next);
    try{sessionStorage.setItem('clipScanShots',JSON.stringify(next))}catch{}

    if(next[0]&&(!photo||scanPose===0)){
      setPhoto(next[0]);
      sessionStorage.setItem('clipPhoto',next[0]);
      try{localStorage.setItem('clipPhoto',next[0])}catch{}
      const ok=await analyzeImage(next[0]);
      if(!ok)return;
    }

    const count=next.filter(Boolean).length;
    if(count===4){
      setScanPose(4);
      setScanState('SCAN COMPLETE ✓ · 4 OF 4 VIEWS CAPTURED');
      await runFullScanAnalysis(next);
    }else{
      const nextMissing=next.findIndex(x=>!x);
      setScanPose(nextMissing<0?4:nextMissing);
      setScanState(`${count} OF 4 PHOTOS LOADED · add ${['Front','Left','Right','Back'][nextMissing]||'remaining view'}`);
    }
  }catch(err){
    console.error('Clip-E multi-photo upload failed',err);
    setScanState('Could not load those photos — try again');
    setHairAnalysisError(err?.message||'Photo upload failed');
  }
}
async function uploadBackPhoto(e){
  const file=e.target.files?.[0];
  e.target.value='';
  if(!file||!file.type.startsWith('image/'))return;
  setHairAnalysis(null);setTopMatches([]);setProfileReady(false);setHairAnalysisError('');setScanAnalysisStage('');
  setScanState('Loading Back photo…');
  try{
    const raw=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
    const clean=await normalizePhoto(raw);
    const next=[...scanShots];
    next[3]=clean;
    setScanShots(next);
    sessionStorage.setItem('clipScanShots',JSON.stringify(next));
    try{localStorage.setItem('clipScanShots',JSON.stringify(next))}catch{}
    const count=next.filter(Boolean).length;
    if(count===4){
      setScanPose(4);
      setScanState('SCAN COMPLETE ✓ · BACK PHOTO SAVED · 4 OF 4 VIEWS CAPTURED');
      stream?.getTracks().forEach(t=>t.stop());setStream(null);
      await runFullScanAnalysis(next);
    }else{
      const missing=next.findIndex(x=>!x);
      setScanPose(missing<0?4:missing);
      setScanState(`Back photo saved ✓ · ${count} OF 4 PHOTOS LOADED · add ${['Front','Left','Right','Back'][missing]||'remaining view'}`);
    }
  }catch(err){
    console.error('Clip-E back-photo upload failed',err);
    setScanState('Could not load the Back photo — try again');
    setHairAnalysisError(err?.message||'Back photo upload failed');
  }
}
function uploadFinalPhoto(e){const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{setFinalPhoto(r.result);try{sessionStorage.setItem('clipFinalPhoto',r.result)}catch{}};r.readAsDataURL(file)}
function toggleFeedback(x){setFeedback(v=>v.includes(x)?v.filter(y=>y!==x):[...v,x])}
async function transitionTo(target,labels){for(const label of labels){setSessionTransition(label);await new Promise(r=>setTimeout(r,360))}setSessionTransition('');setStep(target)}
async function selectStyleForReview(){setStyleTransition('STYLE SELECTED ✓');await new Promise(r=>setTimeout(r,360));setStyleTransition('ANALYZING REQUIRED CHANGES');await new Promise(r=>setTimeout(r,420));setStyleTransition('PREPARING CLIP-E');await new Promise(r=>setTimeout(r,420));setStyleTransition('');setHeadView(3);setClipEPhase('plan');setStep(5)}
function saveSessionProfile(){const session={id:Date.now(),savedAt:Date.now(),date:new Date().toLocaleDateString(),style:selectedStyle.name,styleIndex:style,topLength,sideLength,fadeHeight,texture,finish,hairGoal,rating:sessionRating,feedback,photo:finalPhoto||photo||'',scanPhoto:photo||'',hairAnalysis};const next=[session,...savedStyles].slice(0,12);setSavedStyles(next);localStorage.setItem('clipSavedSessions',JSON.stringify(next));setClipSaid('Session profile saved.');}
async function hairstyleReference(item){
 const res=await fetch(item.image,{cache:'force-cache'});
 if(!res.ok)throw new Error('Style reference image could not be loaded');
 const blob=await res.blob();
 return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})
}
async function generatePreview(nextStyle=style,force=false){const item=unifiedStyles[nextStyle]||unifiedStyles[0];if(!photo)return setPreviewError('Capture or upload a photo first.');const slot=item.slot;const key=[item.board,slot,topLength,sideLength,fadeHeight,texture,finish].join('|');if(!force&&previewCache[key]){setPreview(previewCache[key]);setShowOriginal(false);setPreviewError('');setDirty(false);return}setPreviewing(true);setPreviewError('');try{const referenceImage=await hairstyleReference(item);const res=await fetch('/api/hair-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseImage:photo,referenceImage,style:item.name,referenceSlot:slot,settings:{topLength,sideLength,fadeHeight,texture,finish}})});const j=await res.json();if(!res.ok)throw Error((j.code?'['+j.code+'] ':'')+(j.error||'Preview failed'));if(!j.image)throw Error('[EMPTY_RESPONSE] Preview service returned no image');setPreview(j.image);setPreviewCache(v=>({...v,[key]:j.image}));setShowOriginal(false);setDirty(false)}catch(e){setShowOriginal(true);setPreviewError(e?.message?("Preview error: "+e.message):"Preview couldn't be generated. Try again.")}finally{setPreviewing(false)}}return <div className="app"><Header step={step} setStep={setStep}/>{step===0&&<Shell {...{step,setStep}}><section className="hero discoverHero blindSpotHero"><div className="discoverCopy"><div className="pill"><Sparkles size={16}/> CAMERA VISION · HAIR ANALYSIS · ROBOTIC ASSISTANCE</div><h2>See more.<br/><em>Work with context.</em></h2><p>Clip-E maps hard-to-see regions of your hair, compares your current profile with the style you select, and turns that information into clear guidance for controlled robotic assistance.</p><button className="primary big" onClick={()=>setStep(1)}>Start scan <ArrowRight/></button><div className="features"><span><Camera/>Rear-view mapping</span><span><Target/>Personalized cut plan</span><span><ShieldCheck/>Controlled assistance</span></div></div><div className="blindSpotVisual armLandingVisual"><img src={discoverHeroImage} alt="Clip-E robotic arm concept" className="discoverHeroRepoImage"/></div></section><section className="blindPipeline"><span>CAMERA INPUT</span><ArrowRight/><span>HEAD MAP</span><ArrowRight/><span>TARGET REGION</span><ArrowRight/><span>SAFE PATH</span><ArrowRight/><span>ROBOTIC ASSISTANCE</span></section><section className="whyClipE"><div><span className="miniEyebrow">WHY CLIP-E?</span><h2>Personal grooming gets harder when the work leaves your field of view.</h2><p>Clip-E is designed for practical maintenance: cleaning a neckline between haircuts, checking symmetry, trimming the lower back and sides, maintaining fades or layers, and supporting people who have limited reach or mobility. It is a tool for visibility and assistance—not a replacement for professional stylists.</p></div><div className="useCases">{['Neckline cleanup','Back-of-head maintenance','Symmetry checks','Behind-ear trimming','Fade + layer upkeep','Limited reach support'].map(x=><span key={x}>{x}</span>)}</div></section></Shell>}
{step===1&&<Shell {...{step,setStep}} guard={!profileReady} guardLabel={hairAnalyzing?'Clip-E is analyzing all four scan views.':scanShots.filter(Boolean).length<4?'Capture FRONT, LEFT, RIGHT, and BACK before building your Profile.':hairAnalysisError?'Profile analysis must complete successfully before continuing.':'Analyzing your profile…'} onNext={()=>transitionTo(2,['PROFILE READY ✓'])} kicker="01 / SEE" title="Map what you can’t easily see" desc="Capture front, left, right, and back views so Clip-E can build one continuous scan. The back view is the key reference for blind-spot assistance."><input ref={backFileRef} className="scanBackInput" hidden type="file" accept="image/*" capture="environment" onChange={uploadBackPhoto}/><div className="split"><div className="scanner cameraScanner">{scanPose>=4&&scanShots.filter(Boolean).length===4?<div className="completedScanBoard">{['Front','Left','Right','Back'].map((label,i)=><figure key={label}><img src={scanShots[i]} alt={label+' captured scan'}/><figcaption><CheckCircle2 size={13}/><b>{label}</b></figcaption></figure>)}</div>:scanPose===3?<div className="backCaptureStage"><PhoneLiveView session={phoneSessionId} fallbackSrc={phoneCameraOnline?'/api/camera/latest?device=phone-back-01&session='+encodeURIComponent(phoneSessionId)+'&t='+phoneFrame:''} topLength={topLength} sideLength={sideLength} fadeHeight={fadeHeight} showMap={false}/>{!phoneCameraOnline&&<button type="button" className="primary backCaptureDirect" onClick={()=>backFileRef.current?.click()}><Camera/> Take / Choose Back Photo</button>}</div>:stream?<video ref={videoRef} autoPlay playsInline muted/>:scanShots.filter(Boolean).length?<img className="latestScanPhoto" src={[...scanShots].reverse().find(Boolean)} alt="Latest captured scan"/>:photo?<img src={photo} alt="Your captured scan"/>:<div className="cameraEmpty scanWelcome"><div className="simpleScanCircle"/><b>Ready to scan</b><span>Start your camera, then center your face.</span></div>}{analyzing&&<div className="analyzingFace"><div className="analysisSweep"/><Target/><b>Analyzing your face…</b><span>Mapping visible facial geometry</span></div>}<div className="poseGuide"><b>{stream?['Look straight ahead','Turn left','Turn right','Center the back of your head'][scanPose]||'Scan complete':scanState}</b>{stream&&<div className="poseChecks">{['Front','Left','Right','Back'].map((x,i)=><span className={i<scanPose?'done':''}>{i<scanPose?'✓ ':''}{x}</span>)}</div>}</div><div className="scanPhotoRail">{['Front','Left','Right','Back'].map((label,i)=>i===3?<button type="button" key={label} className={'scanPhotoSlot '+(scanShots[i]?'filled ':'')+(scanPose===i?'current':'')} onClick={()=>backFileRef.current?.click()}>{scanShots[i]?<img src={scanShots[i]} alt={label+' scan thumbnail'}/>:<span><Camera size={15}/></span>}<b>{scanShots[i]?'✓ ':''}{label}</b></button>:<div key={label} className={'scanPhotoSlot '+(scanShots[i]?'filled ':'')+(scanPose===i?'current':'')}>{scanShots[i]?<img src={scanShots[i]} alt={label+' scan thumbnail'}/>:<span><Camera size={15}/></span>}<b>{scanShots[i]?'✓ ':''}{label}</b></div>)}</div><small>{scanState}</small></div><div className="panel"><h3>Capture input</h3><div className="visionSystem"><span className="miniEyebrow">VISION SYSTEM</span><div><b>MEDIAPIPE — GEOMETRY</b><em className={analysis?'ok':analyzing?'working':'wait'}>{analysis?'● Tracking':analyzing?'● Mapping':'○ Waiting'}</em></div><div><b>PRESAGE — CONTEXT</b><em className={presageState==='active'?'ok':'wait'}>{presageState==='active'?'● Connected':'○ Standby'}</em></div><div><b>GEMINI — HAIR ANALYSIS</b><em className={hairAnalysis?'ok':'wait'}>{hairAnalysis?'● Ready':'○ After scan'}</em></div></div><div className="phonePair"><div><span>PHONE BACK CAMERA</span><b>{phoneCameraOnline?'● CONNECTED':'○ WAITING'}</b></div>{!phoneCameraOnline?<div className="phoneQrBlock"><div className="phoneQrCard"><QRCodeCanvas value={phoneCameraUrl} size={168} bgColor="#ffffff" fgColor="#071d31" includeMargin={false}/></div><div className="phoneQrText"><strong>Scan back view</strong><p>This QR is only for the Scan step. Allow camera access and capture the back of the head.</p><small>{phoneCameraUrl}</small></div></div>:<div className="phoneConnectedMsg"><b>✓ Phone connected</b><span>Rear camera is ready for the back-of-head scan.</span></div>}</div>{cameras.length>1&&<label className="cameraPicker">Computer camera<select value={selectedCamera} onChange={e=>{setSelectedCamera(e.target.value);startCamera(e.target.value)}}>{cameras.map((cam,i)=><option key={cam.deviceId} value={cam.deviceId}>{cam.label||`Camera ${i+1}`}</option>)}</select></label>}{!stream?<button className="primary wide" onClick={()=>startCamera()}><Camera/> Use Computer Camera</button>:<button className="primary wide" onClick={capturePosition} disabled={analyzing}><Camera/> Capture {['Front','Left','Right','Back'][scanPose]||'Position'}</button>}{photo&&<button className="ghost wide retakeBtn" onClick={retake}><RotateCcw/> Retake Photos</button>}<button className="ghost wide" onClick={()=>fileRef.current?.click()}><Upload/> Upload All 4 Photos</button><input ref={fileRef} hidden type="file" accept="image/*" multiple onChange={uploadPhoto}/><button className="ghost wide" onClick={()=>backFileRef.current?.click()}><Camera/> Take / Upload Back Photo</button><div className="uploadOrderHint"><b>Batch upload order:</b> Front → Left → Right → Back · You can replace the Back view separately at any time.</div><hr/><h4>Give Clip-E a clear view</h4><p>Keep the hairline, ears, neckline, and back boundary visible. The camera is building a reference for the areas you cannot easily inspect yourself.</p>{analysisError&&<div className="scanError">{analysisError}</div>}<div className="privacy"><ShieldCheck/> Your captured images stay in this browser session and are used to build your Clip-E hair profile and cut map.</div></div></div>{scanPose>=4&&<section className={'scanAnalysisPanel '+(profileReady?'ready':'')}><div className="scanAnalysisHead"><div><span className="miniEyebrow">SCAN COMPLETE ✓</span><h2>4 OF 4 VIEWS CAPTURED</h2><p>{profileReady?'Your real scan analysis is complete. Review the profile when you are ready.':'Clip-E is analyzing the four captured views before it unlocks your Profile.'}</p></div>{profileReady?<CheckCircle2/>:<Activity/>}</div><div className="scanAnalysisSteps">{['Validating four views...','Analyzing facial proportions...','Analyzing hair pattern and texture...','Comparing front, side and rear views...','Building your Clip-E profile...','Finding your strongest hairstyle matches...'].map((label,i)=>{const order=['Validating four views...','Analyzing facial proportions...','Analyzing hair pattern and texture...','Comparing front, side and rear views...','Building your Clip-E profile...','Finding your strongest hairstyle matches...'];const active=scanAnalysisStage===label;const complete=profileReady||order.indexOf(scanAnalysisStage)>i;return <div key={label} className={(active?'active ':'')+(complete?'complete':'')}><span>{complete?'✓':String(i+1).padStart(2,'0')}</span><b>{label}</b></div>})}</div>{hairAnalysisError&&!profileReady&&<div className="scanAnalysisError"><b>Analysis did not finish.</b><p>{hairAnalysisError}</p><button className="ghost" onClick={()=>runFullScanAnalysis(scanShots)} disabled={hairAnalyzing}>{hairAnalyzing?'Retrying…':'Retry analysis'}</button></div>}{profileReady&&<div className="scanReadyPrompt"><CheckCircle2/><div><b>YOUR CLIP-E PROFILE IS READY</b><span>{hairAnalysis?._analysisEngine==='local-scan-fallback'?'Gemini quota was unavailable, so Clip-E used your real scan geometry without inventing hair traits. Your Top 3 uses the evidence that is available.':'Gemini returned the profile and Clip-E found your top 3 matches.'} Use Continue below to review it.</span></div></div>}</section>}</Shell>}
{step===2&&<Shell {...{step,setStep}} guard={!profileReady||topThreeMatches.length<3} guardLabel="The four-view Gemini profile and top 3 matches must be ready before continuing." onNext={()=>transitionTo(3,['PROFILE COMPLETE ✓','MATCHING YOUR HAIR','STYLES READY'])} kicker="02 / PROFILE" title="Your Hair Profile" desc="Clip-E combines local face/head geometry with Gemini vision analysis of your actual scan images. Visual observations are separated from things that cannot be determined reliably from a photo."><div className="profileStack"><div className="premiumAnalysis"><section className="faceHero"><div className="photoMapTabs"><button className={!faceMap?'active':''} onClick={()=>setFaceMap(false)}>PHOTO</button><button className={faceMap?'active':''} onClick={()=>setFaceMap(true)}>FACE MAP</button></div>{photo?<div className="faceMapPhoto"><img src={photo} alt="Front scan"/>{faceMap&&analysis?.points&&<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={analysis.points.filter((_,i)=>[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109].includes(i)).map(p=>p.x*100+','+p.y*100).join(' ')} fill="none" vectorEffect="non-scaling-stroke"/><line x1="50" y1="15" x2="50" y2="86"/><line x1="20" y1="48" x2="80" y2="48"/></svg>}</div>:<div className="previewEmpty"><Camera/><b>Scan your hair first</b></div>}</section><section className="profileSummary"><span className="miniEyebrow">HEAD GEOMETRY</span>{(analysis||hairAnalysis?.faceProfile)?<><div className="shapeCallout"><small>FACE / HEAD SHAPE</small><strong>{hairAnalysis?.faceProfile?.shape||analysis.shape}</strong></div><div className="profileCards"><article><small>Jawline</small><b>{hairAnalysis?.faceProfile?.jawline||analysis.jaw}</b></article><article><small>Face length</small><b>{hairAnalysis?.faceProfile?.proportion||analysis.proportion}</b></article><article><small>Cheekbones</small><b>{hairAnalysis?.faceProfile?.cheekbones||analysis.cheekbones}</b></article><article><small>Hairline</small><b>{analysis.hairline}</b></article><article><small>Blind-spot focus</small><b>Back + neckline</b></article><article><small>Assistance zone</small><b>Sides / behind ears</b></article></div>{analysis&&<button className="analysisToggle" onClick={()=>setAnalysisOpen(!analysisOpen)}>View geometry <ChevronRight size={15}/></button>}{analysis&&analysisOpen&&<div className="techDetails"><span>Length / width ratio <b>{analysis.ratio}</b></span><span>Jaw / width ratio <b>{analysis.jawRatio}</b></span><span>Cheek / width ratio <b>{analysis.cheekRatio}</b></span><span>Forehead / width ratio <b>{analysis.foreheadRatio}</b></span><span>Landmarks analyzed <b>{analysis.landmarks}</b></span></div>}</>:<p>Complete a scan to build head geometry.</p>}</section></div>

<section className="hairProfilePanel"><div className="hairProfileHeader"><div><span className="miniEyebrow">GEMINI VISION · YOUR HAIR</span><h2>Visible hair analysis</h2><p>Based on the actual scan views captured in this session. Clip-E only reports characteristics that appear visually supportable.</p></div><div className={"hairConfidence "+String(hairAnalysis?.confidence?.overall||'').toLowerCase()}><small>ANALYSIS CONFIDENCE</small><b>{hairAnalyzing?'ANALYZING…':hairAnalysis?.confidence?.overall||'PENDING'}</b></div></div>{hairAnalyzing?<div className="hairAnalyzing"><Activity/><div><b>Looking across your scan views…</b><span>Checking pattern, density, length, crown, sides, back, neckline, and regional differences.</span></div></div>:hairAnalysis?<><div className="hairPatternHero"><div><small>HAIR PATTERN</small><h3>{hairAnalysis.hairPattern}{hairAnalysis.primaryType&&hairAnalysis.primaryType!=='Unable to determine from scan'?<em> — Type {hairAnalysis.primaryType}</em>:null}</h3><p>{hairAnalysis.patternExplanation}</p>{hairAnalysis.secondaryType&&hairAnalysis.secondaryType!=='None'&&hairAnalysis.secondaryType!=='Unable to determine from scan'&&<span>Secondary pattern: <b>{hairAnalysis.secondaryType}</b></span>}</div><div className="hairQuickFacts"><article><small>APPARENT COARSENESS</small><b>{hairAnalysis.coarseness}</b></article><article><small>APPARENT DENSITY</small><b>{hairAnalysis.density}</b></article><article><small>CURRENT LENGTH</small><b>{hairAnalysis.currentLength}</b></article><article><small>VOLUME</small><b>{hairAnalysis.volume}</b></article></div></div><div className="hairDetailGrid"><article><small>Wave / curl definition</small><b>{hairAnalysis.definition}</b></article><article><small>Visible growth pattern</small><b>{hairAnalysis.growthPattern}</b></article><article><small>Crown behavior</small><b>{hairAnalysis.crownBehavior}</b></article><article><small>Frizz / flyaways</small><b>{hairAnalysis.frizzFlyaways}</b></article><article><small>Symmetry</small><b>{hairAnalysis.symmetry}</b></article><article><small>Current cut / shape</small><b>{hairAnalysis.currentCutShape}</b></article><article><small>Neckline</small><b>{hairAnalysis.necklineCondition}</b></article><article><small>Side growth</small><b>{hairAnalysis.sideGrowth}</b></article><article><small>Back growth</small><b>{hairAnalysis.backGrowth}</b></article></div>{hairAnalysis.regionalPatterns?.length>0&&<div className="regionalHair"><h3>Texture by region</h3>{hairAnalysis.regionalPatterns.map((x,i)=><div key={i}><span>{x.region}</span><b>{x.pattern}</b><p>{x.observation}</p></div>)}</div>}{hairAnalysis.observableLimits?.length>0&&<div className="analysisLimits"><ShieldCheck/><div><b>What the scan cannot confirm</b><p>{hairAnalysis.observableLimits.join(' · ')}</p></div></div>}</>:<div className="hairAnalysisEmpty"><Activity/><div><b>Hair analysis unavailable</b><p>{hairAnalysisError||'Clip-E needs at least one clear scan image to analyze visible hair characteristics.'}</p><button className="ghost" onClick={refreshHairAnalysis}>Retry analysis</button></div></div>}</section>

<section className="growthPanel"><div><span className="miniEyebrow">HAIR GROWTH</span><h2>{savedStyles.length?'Since your last saved session':'First session'}</h2>{savedStyles.length?<><div className="growthFacts"><article><small>LAST CUT</small><b>{savedStyles[0].date||'Saved session'}</b></article><article><small>TIME SINCE LAST CUT</small><b>{savedStyles[0].savedAt?Math.max(0,Math.floor((Date.now()-savedStyles[0].savedAt)/86400000))+' days':'Previous session date only'}</b></article><article><small>VISIBLE GROWTH</small><b>{savedStyles[0].hairAnalysis&&hairAnalysis?'Profile comparison available':'Unable to determine from saved data'}</b></article><article><small>AREAS WITH MOST CHANGE</small><b>{savedStyles[0].hairAnalysis&&hairAnalysis?(hairAnalysis.backGrowth||hairAnalysis.sideGrowth||'Review scan comparison'):'Needs comparable previous scan'}</b></article></div><p>Clip-E only reports growth when a previous session contains comparable scan/profile data. It does not invent a growth measurement.</p></>:<p>Growth tracking begins after this scan. Save a completed session so Clip-E has a real previous reference next time.</p>}</div></section>

<section className="profileStyleMatches"><div className="dashTitle"><div><span className="miniEyebrow">YOUR TOP 3</span><h2>Strongest matches from the 100-style library</h2><p>These three are ranked only after Gemini finishes your four-view hair + face profile. The score uses visible pattern, length, apparent density, and measured/observed face geometry.</p></div></div>{topThreeMatches.length===3?<div className="profileMatchRow topThree">{topThreeMatches.map((r,i)=><article key={r.board+'-'+r.slot} className="profileMatchCard"><span className="matchRank">{'0'+(i+1)}</span><img className="hairstyleImage" src={r.image} alt={r.name} loading="eager" decoding="async"/><div><small>{r.score}% PROFILE MATCH</small><b>{r.name}</b><p>{r.why}</p></div></article>)}</div>:<div className="recommendationsPending"><Activity/><span>Top 3 matches are not available until the real scan analysis completes.</span></div>}<button className="primary" onClick={()=>transitionTo(3,['PROFILE COMPLETE ✓','OPENING STYLE LIBRARY'])} disabled={topThreeMatches.length<3}>Explore all styles <ArrowRight size={16}/></button></section></div></Shell>}
{step===3&&<Shell {...{step,setStep}} nextStep={5} kicker="03 / STYLES" title="Explore your style" desc="Browse the existing Clip-E style library visually. Your Top 3 comes from the completed four-view profile analysis; the library cards themselves are not selection buttons."><div className="stylesExperience">
<section className="recommendedStrip"><div className="sectionHeading"><div><span className="miniEyebrow">RECOMMENDED FOR YOU</span><h2>Profile-driven matches</h2><p>{hairAnalysis?`Using your ${hairAnalysis.primaryType||hairAnalysis.hairPattern} pattern, ${hairAnalysis.currentLength.toLowerCase()} current length, ${hairAnalysis.density.toLowerCase()} apparent density, and ${analysis?.shape?.toLowerCase()||'head'} geometry.`:'Complete visible hair analysis to personalize this row.'}</p></div></div>{topThreeMatches.length===3?<div className="recommendedCarousel">{topThreeMatches.map((r,i)=><article key={r.board+'-'+r.slot} className="libraryCard recommended staticStyleCard"><em>TOP {'0'+(i+1)} MATCH</em><img className="hairstyleImage" src={r.image} alt={r.name} loading="eager" decoding="async"/><div className="cardHoverMeta"><b>{r.name}</b><span>Best for: {r.patterns.join(' • ')}</span><span>Ideal Length: {r.length}</span><span>Density: {r.density.join(' • ')}</span><span>Maintenance: {r.maintenance}</span><span>Clip-E Assistance: {r.assist.join(' • ')}</span><p><strong>WHY IT MATCHES YOU</strong>{r.why}</p></div><div className="libraryCardCopy"><small>{r.score}% MATCH</small><b>{r.name}</b><p>{r.length[0]+r.length.slice(1).toLowerCase()} • {r.patterns.map(x=>x[0]+x.slice(1).toLowerCase()).join('/')} • {r.maintenance[0]+r.maintenance.slice(1).toLowerCase()} Maintenance</p></div></article>)}</div>:<div className="recommendationsPending"><Activity/><span>Your top 3 matches appear here after the four-view profile analysis completes.</span></div>}</section>

<section className="allStylesSection"><div className="sectionHeading"><div><span className="miniEyebrow">EXPLORE ALL STYLES</span><h2>One Clip-E Style Library</h2><p>No gender split. Filter the same library by length, visible hair pattern, or cut characteristics.</p></div><span className="libraryCount">{filteredStyles.length} / {unifiedStyles.length} LOADED STYLES</span></div>{!hairAnalysis&&<div className="profileLibraryNotice"><Sparkles/><span><b>Complete your Hair Profile to unlock personalized recommendations.</b><small>The full 100-style library remains available to browse.</small></span></div>}<div className="styleFilters"><label className="styleSearch"><span>Search styles…</span><input value={styleQuery} onChange={e=>setStyleQuery(e.target.value)} placeholder="Search styles..."/></label><div className="filterGroup">{['ALL','SHORT','MEDIUM','LONG'].map(x=><button key={x} className={lengthFilter===x?'active':''} onClick={()=>setLengthFilter(x)}>{x}</button>)}</div><div className="filterGroup">{['ALL','STRAIGHT','WAVY','CURLY','COILY'].map(x=><button key={x} className={patternFilter===x?'active':''} onClick={()=>setPatternFilter(x)}>{x}</button>)}</div><div className="filterGroup secondary">{['LAYERED','TEXTURED','FADE/TAPER','FRINGE/BANGS','BOB','LOW MAINTENANCE'].map(x=><button key={x} className={tagFilters.includes(x)?'active':''} onClick={()=>setTagFilters(v=>v.includes(x)?v.filter(t=>t!==x):[...v,x])}>{x}</button>)}</div></div><div className="unifiedStyleGrid">{filteredStyles.map(item=>{const idx=unifiedStyles.findIndex(s=>s.slot===item.slot&&s.board===item.board);const match=recommendations.find(x=>x.slot===item.slot&&x.board===item.board);return <article key={item.board+'-'+item.slot} className="libraryCard staticStyleCard"><img className="hairstyleImage" src={item.image} alt={item.name} loading={idx<10?'eager':'lazy'} decoding="async"/><div className="cardHoverMeta"><b>{item.name}</b><span>Best for: {item.patterns.join(' • ')}</span><span>Ideal Length: {item.length}</span><span>Density: {item.density.join(' • ')}</span><span>Maintenance: {item.maintenance}</span><span>Clip-E Assistance: {item.assist.join(' • ')}</span>{hairAnalysis&&match&&<p><strong>PROFILE NOTE</strong>{match.why}</p>}</div><div className="libraryCardCopy"><b>{item.name}</b><p>{item.length[0]+item.length.slice(1).toLowerCase()} • {item.patterns.map(x=>x[0]+x.slice(1).toLowerCase()).join('/')} • {item.maintenance[0]+item.maintenance.slice(1).toLowerCase()} Maintenance</p></div></article>})}</div></section>

{stylePreviewOpen&&<section className="stylePreviewPanel"><div className="previewPanelTop"><div><span className="miniEyebrow">YOUR HAIR + THIS STYLE</span><h2>{selectedStyle.name}</h2><p>Reference style on the left. Your scan and optional AI visualization on the right.</p></div><button className="ghost" onClick={()=>setStylePreviewOpen(false)}>Close</button></div><div className="previewCompare"><div className="referencePreview"><img className="hairstyleImage" src={selectedStyle.image} alt={selectedStyle.name} loading="eager" decoding="async"/><b>REFERENCE STYLE</b></div><div className="userStylePreview">{photo?<img src={!showOriginal&&preview?preview:photo} alt="Your hairstyle preview"/>:<div className="previewEmpty"><Camera/><b>Scan first</b></div>}{previewing&&<div className="previewLoading"><Sparkles/> Creating preview…</div>}<div className="previewMode"><button className={showOriginal?'active':''} onClick={()=>setShowOriginal(true)}>CURRENT</button><button className={!showOriginal?'active':''} disabled={!preview} onClick={()=>setShowOriginal(false)}>AI PREVIEW</button></div></div></div>{previewError&&<p className="previewError">{previewError}</p>}<div className="previewProfileGrid"><article><small>COMPATIBILITY</small><b>{personalizedStyles(hairAnalysis,analysis?.shape).find(x=>x.slot===selectedStyle.slot&&x.board===selectedStyle.board)?.score||'—'}% profile fit</b></article><article><small>HAIR TYPE REQUIREMENTS</small><b>{selectedStyle.patterns.join(' • ')}</b></article><article><small>CURRENT → TARGET LENGTH</small><b>{hairAnalysis?.styleSignals?.lengthCategory||'Unknown'} → {selectedStyle.length}</b></article><article><small>MAINTENANCE</small><b>{selectedStyle.maintenance}</b></article><article><small>AMOUNT OF CHANGE</small><b>{hairAnalysis?.styleSignals?.lengthCategory&&hairAnalysis.styleSignals.lengthCategory.toUpperCase()===selectedStyle.length?'Lower':'Moderate–High'}</b></article><article><small>CLIP-E ASSISTANCE</small><b>{selectedStyle.assist.join(' • ')}</b></article></div><div className="whyMatches"><Sparkles/><div><b>WHY IT MATCHES YOU</b><p>{personalizedStyles(hairAnalysis,analysis?.shape).find(x=>x.slot===selectedStyle.slot&&x.board===selectedStyle.board)?.why||'Clip-E will compare this target against your current scan before building the cut map.'}</p></div></div><div className="previewPanelActions"><button className="ghost" onClick={()=>generatePreview(style,true)} disabled={!photo||previewing}>{previewing?'Generating…':'Preview on me'}</button><button className="primary" onClick={selectStyleForReview}>Select this style <ArrowRight size={16}/></button></div></section>}

{styleTransition&&<div className="styleTransitionOverlay"><Sparkles/><b>{styleTransition}</b><span>{styleTransition==='STYLE SELECTED'?'Target locked.':styleTransition==='ANALYZING REQUIRED CHANGES'?'Comparing your visible hair profile to the selected target.':'Translating differences into the Review cut map.'}</span></div>}
</div></Shell>}
{step===5&&<Shell {...{step,setStep}} prevStep={3} nextStep={10} hidePager kicker="05 / CLIP-E" title="One workspace. Four phases." desc="Clip-E keeps the selected style, scan, cameras, voice, safety state, and robotic context in one continuous workspace."><div className="clipEWorkspace">
<div className="clipEPhaseNav">{[['plan','PLAN'],['calibrate','CALIBRATE'],['assist','ASSIST'],['verify','VERIFY']].map(([id,label],i)=><button key={id} className={(clipEPhase===id?'active ':'')+((id==='calibrate'&&planApproved)||(id==='assist'&&planApproved&&setupChecks.workspace&&setupChecks.seated&&setupChecks.stop)||(id==='verify'&&finalPhoto)?'complete':'')} onClick={()=>setClipEPhase(id)}><span>{String(i+1).padStart(2,'0')}</span><b>{label}</b></button>)}</div>

<div className="clipEPhaseBody">
{clipEPhase==='plan'&&<div className="clipEUnifiedGrid phasePlan"><section className="dashPanel cutMapPanel"><div className="dashTitle"><div><span className="miniEyebrow">PLAN</span><h3>Current hair → target style</h3><p>The selected style becomes a target. Clip-E maps where change is needed, with the back and rear sides prioritized.</p></div><span className="trackingBadge">TARGET LOCKED</span></div><div className="seg"><b>BACK-OF-HEAD MAP</b><span>Target regions</span><span>Protected regions</span></div><PersonalHeadMap photo={photo} scanShots={scanShots} analysis={analysis} view={headView} setView={setHeadView} topLength={topLength} sideLength={sideLength} fadeHeight={fadeHeight}/><div className="mapped"><b>Working context</b><span><i className="dot orange"/>Target · {selectedStyle.name}</span><span><i className="dot blue"/>Assist · {selectedStyle.assist.join(' / ')}</span><span><i className="dot rust"/>Hair · {hairAnalysis?.primaryType||hairAnalysis?.hairPattern||'Needs profile'}</span><span><i className="dot pale"/>No-cut edges · protected</span></div><div className="hairBehaviorMap"><span className="miniEyebrow">VISIBLE HAIR BEHAVIOR</span><p>{hairAnalysis?.hairPattern==='Curly'||hairAnalysis?.hairPattern==='Coily'?'Curl/coil contraction is considered when interpreting resting length. ':hairAnalysis?.hairPattern==='Wavy'?'Wave movement is preserved when interpreting the visible boundary. ':hairAnalysis?.hairPattern==='Straight'?'Straight resting geometry can be read more directly from the visible boundary. ':''}Final physical dimensions still require calibration before motion.</p></div></section><aside className="dashPanel details"><div className="dashTitle"><div><h3>Required changes</h3><p>Clip-E advises. You approve.</p></div><button className="ghost" onClick={()=>setStep(3)}>Edit style</button></div><div className="styleSummary"><img className="hairstyleImage" src={selectedStyle.image} alt={selectedStyle.name} loading="eager" decoding="async"/><div><b>{selectedStyle.name}</b><small>{selectedStyle.length} · {selectedStyle.patterns.join(' / ')}</small><p>{selectedStyle.description}</p></div></div><div className="changeRegionList">{['Back','Neckline','Around ears','Crown','Front'].map(region=>{const active=selectedStyle.assist.some(x=>x.toLowerCase().includes(region.toLowerCase().split(' ')[0]));return <div key={region}><span>{region}</span><b>{active?'WORK / BLEND':'PRESERVE / VERIFY'}</b></div>})}</div><div className="visionSystem compact"><span className="miniEyebrow">VISION SYSTEM</span><div><b>MEDIAPIPE — GEOMETRY</b><em className={analysis?'ok':'wait'}>{analysis?'● Tracking':'○ Needs scan'}</em></div><div><b>PRESAGE — CONTEXT</b><em className={presageState==='active'?'ok':'wait'}>{presageState==='active'?'● Connected':'○ Standby'}</em></div><div><b>GEMINI — HAIR ANALYSIS</b><em className={hairAnalysis?'ok':'wait'}>{hairAnalysis?'● Ready':'○ Pending'}</em></div></div><button className={"primary wide "+(planApproved?'approved':'')} onClick={()=>{setPlanApproved(true);setTimeout(()=>setClipEPhase('calibrate'),320)}}>{planApproved?<><CheckCircle2/> Plan approved</>:<>Approve plan <ArrowRight/></>}</button></aside></div>}

{clipEPhase==='calibrate'&&<div className="clipEUnifiedGrid phaseCalibrate"><section className="dashPanel setupOverview"><div className="dashTitle"><div><span className="miniEyebrow">CALIBRATE</span><h3>Physical setup + calibration</h3><p>Verify the real prototype, camera coverage, workspace, and user position before any assisted movement.</p></div><span className={calibrationCoverageReady?'trackingBadge':'cameraOffline'}>● {calibrationCoverageReady?'CAMERA COVERAGE COMPLETE':'CAMERA SETUP'}</span></div><div className="deviceReadiness">{[['Cut plan',planApproved,'Approved'],['Arm link',armStatus.online,armStatus.online?'arm-01 online':'Waiting for arm-01'],['PCA9685',!!armStatus.payload?.pca_ready,armStatus.payload?.pca_ready?'Controller ready':'No ready signal'],['Emergency stop',armStatus.payload?.estop===false,armStatus.payload?.estop?'E-stop active':'No E-stop flag'],['Computer Camera',!!stream,stream?'Ready ✓':'Camera access required'],['Phone Rear Camera',!!rearStream,rearStream?'Ready ✓':'Choose rear camera source'],['Head Tracking',!!analysis,analysis?'Ready ✓':'Needs tracked scan'],['Rear Coverage',!!rearStream,rearStream?'Ready ✓':'Rear camera required']].map(x=><div key={x[0]} className={'readinessRow '+(x[1]?'ok':'wait')}><i>{x[1]?'✓':'·'}</i><span><b>{x[0]}</b><small>{x[2]}</small></span></div>)}</div><div className="telemetryStrip"><span><small>MODE</small><b>{armStatus.payload?.mode||'—'}</b></span><span><small>ARMED</small><b>{armStatus.payload?.armed?'YES':'NO'}</b></span><span><small>WIFI</small><b>{armStatus.payload?.wifi_rssi??'—'} dBm</b></span><span><small>JOINTS</small><b>{Array.isArray(armStatus.payload?.joint_deg)?armStatus.payload.joint_deg.slice(0,5).map(v=>Math.round(v)).join(' · '):'—'}</b></span></div></section><aside className="dashPanel setupChecklist"><h3>Human setup checks</h3>{[['workspace','Workspace is clear','No loose objects, cables, hands, or tools inside the arm path.'],['seated','User position confirmed','Head and chair are aligned with the planned workspace.'],['stop','Physical stop verified','Hardware E-stop / power cutoff has been tested.']].map(x=><button key={x[0]} className={'manualCheck '+(setupChecks[x[0]]?'checked':'')} onClick={()=>setSetupChecks(v=>({...v,[x[0]]:!v[x[0]]}))}><i>{setupChecks[x[0]]?'✓':''}</i><span><b>{x[1]}</b><small>{x[2]}</small></span></button>)}<div className="setupWarning"><ShieldCheck/><p><b>Physical safety remains independent.</b> Browser controls do not replace a hardware emergency stop or tested motion limits.</p></div></aside><section className="dashPanel setupCamera calibrationCoverage"><div className="dashTitle"><div><h3>Camera coverage</h3><p>Front/side coverage plus a dedicated rear view. The computer sees the user; the phone sees the blind spot.</p></div><span className={calibrationCoverageReady?'live':'cameraOffline'}>● {calibrationCoverageReady?'COMPLETE':'SETUP IN PROGRESS'}</span></div><div className="dualCameraGrid calibrationDualGrid"><div className="cameraRoleCard calibrationCameraCard"><div className="cameraRoleHead"><div><small>FRONT / SIDE</small><b>Computer Camera</b></div><span className={stream?'cameraFeedLive':'cameraFeedWaiting'}>{stream?'● LIVE':calibrationCameraState==='initializing'?'● INITIALIZING':'○ WAITING'}</span></div><div className="calibrationFeed">{stream?<LiveHeadAR stream={stream} topLength={topLength} sideLength={sideLength} fadeHeight={fadeHeight} className="calibrationComputerAR"/>:<div className="calibrationPermissionState"><Camera/><h3>Computer Camera</h3><p>Camera access is required for front and side coverage.</p><button className="primary" disabled={calibrationCameraState==='initializing'} onClick={()=>startCalibrationCamera()}>{calibrationCameraState==='initializing'?'Initializing camera…':'Enable camera'}</button></div>}</div>{cameras.length>1&&<label className="cameraPicker calibrationPicker">Camera Source<select value={selectedCamera} onChange={e=>{setSelectedCamera(e.target.value);startCalibrationCamera(e.target.value)}}>{cameras.map((cam,i)=><option key={cam.deviceId} value={cam.deviceId}>{cam.label||`Camera ${i+1}`}</option>)}</select></label>}<div className="cameraUse"><small>USED FOR</small><b>Front • Left • Right • Positioning</b></div></div><div className="cameraRoleCard rearHeadCard calibrationCameraCard"><div className="cameraRoleHead"><div><small>BACK / NAPE / REAR SIDES</small><b>Phone Rear Camera</b></div><span className={rearStream?'cameraFeedLive':'cameraFeedWaiting'}>{rearStream?'● LIVE':rearCalibrationCameraState==='initializing'?'● INITIALIZING':'○ WAITING'}</span></div><div className="calibrationFeed">{rearStream?<LiveHeadAR stream={rearStream} topLength={topLength} sideLength={sideLength} fadeHeight={fadeHeight} rear rearPlan={rearCutPlan} className="calibrationComputerAR rearHeadAR"/>:<div className="calibrationPermissionState"><Camera/><h3>Phone Rear Camera</h3><p>Select the phone or virtual-camera source independently from the computer camera.</p><button className="primary" disabled={rearCalibrationCameraState==='initializing'} onClick={()=>startRearCalibrationCamera()}>{rearCalibrationCameraState==='initializing'?'Initializing camera…':'Enable rear camera'}</button></div>}</div>{cameras.length>1&&<label className="cameraPicker calibrationPicker">Rear Camera Source<select value={selectedRearCamera} onChange={e=>{setSelectedRearCamera(e.target.value);startRearCalibrationCamera(e.target.value)}}>{cameras.map((cam,i)=><option key={cam.deviceId} value={cam.deviceId}>{cam.label||`Camera ${i+1}`}{cam.deviceId===selectedCamera?' · FRONT IN USE':''}</option>)}</select></label>}<div className="cameraUse"><small>USED FOR</small><b>Back • Nape • Rear Sides</b></div></div></div><div className={'coverageReadyBar '+(calibrationCoverageReady?'ready':'')}><div><span>Computer Camera</span><b>{stream?'READY ✓':'WAITING'}</b></div><div><span>Phone Rear Camera</span><b>{rearStream?'READY ✓':'WAITING'}</b></div><div><span>Head Tracking</span><b>{analysis?'READY ✓':'WAITING'}</b></div><div><span>Rear Coverage</span><b>{rearStream?'READY ✓':'WAITING'}</b></div>{calibrationCoverageReady&&<strong>CAMERA COVERAGE COMPLETE</strong>}</div><button className="disconnectCamerasBtn" onClick={disconnectAllCameras}>Disconnect all cameras</button></section><section className="dashPanel rearMappingSection"><div className="dashTitle"><div><span className="miniEyebrow">REAR CAMERA MAP</span><h3>What needs work</h3><p>The phone rear camera gives Clip-E the blind-spot view. The map below combines that rear view with the selected style and your visible hair profile to show which regions should be worked on, blended, or protected.</p></div><span className={rearStream?'trackingBadge':'cameraOffline'}>● {rearStream?'REAR VIEW LIVE':'REAR VIEW NEEDED'}</span></div><div className="rearMappingGrid"><div className="rearMapVisual"><div className="rearFeedMap">{rearStream?<LiveHeadAR stream={rearStream} topLength={topLength} sideLength={sideLength} fadeHeight={fadeHeight} rear rearPlan={rearCutPlan} className="rearWorkMapAR"/>:scanShots?.[3]?<LiveHeadAR src={scanShots[3]} topLength={topLength} sideLength={sideLength} fadeHeight={fadeHeight} rear rearPlan={rearCutPlan} className="rearWorkMapAR"/>:<div className="rearMapEmpty"><Camera/><b>Enable the rear camera</b><span>Clip-E will lock the overlay to detected head / hair geometry before showing work zones.</span></div>}<div className="rearMapLegend"><span><i className="work"/>Work / blend</span><span><i className="protect"/>Protect / preserve</span></div></div><div className="rearMapCaption"><Target/><span><b>PLANNED TARGET OVERLAY</b><small>This is a style + profile guide aligned to the rear camera view. It does not claim pixel-accurate depth or autonomous tracking; final physical positioning is confirmed during calibration.</small></span></div></div><div className="rearWorkPanel"><div className="rearTargetHeader"><div><small>SELECTED TARGET</small><b>{selectedStyle.name}</b></div><div><small>REGIONS REQUIRING WORK</small><b>{rearWorkCount} / {rearCutPlan.length}</b></div></div><div className="rearCurrentTarget"><div><small>CURRENT HAIR</small><b>{hairAnalysis?.primaryType||hairAnalysis?.hairPattern||'Profile pending'}</b><span>{hairAnalysis?.styleSignals?.lengthCategory||hairAnalysis?.currentLength||'Length not confirmed'}</span></div><ArrowRight/><div><small>TARGET STYLE</small><b>{selectedStyle.name}</b><span>{selectedStyle.length} · {selectedStyle.maintenance} maintenance</span></div></div><div className="rearRegionList">{rearCutPlan.map(region=><article key={region.id} className={region.work?'work':'protect'}><div><i/><span><b>{region.label}</b><small>{region.observed}</small></span></div><strong>{region.action}</strong></article>)}</div><div className="rearCutMetrics"><span><small>TOP TARGET</small><b>{topLength} mm</b></span><span><small>SIDE TARGET</small><b>{sideLength} mm</b></span><span><small>FADE</small><b>{fadeHeight}</b></span><span><small>ASSISTANCE</small><b>{selectedStyle.assist.join(' · ')}</b></span></div></div></div></section><div className="phaseActions"><button className="ghost" onClick={()=>setClipEPhase('plan')}>Back to plan</button><button className="primary" disabled={!(planApproved&&setupChecks.workspace&&setupChecks.seated&&setupChecks.stop&&calibrationCoverageReady)} title={!calibrationCoverageReady?'Computer camera, rear camera, and head tracking must all be ready first.':''} onClick={()=>setClipEPhase('assist')}>Begin assisted workspace <ArrowRight/></button></div></div>}

{clipEPhase==='assist'&&<div className="clipEUnifiedGrid phaseAssist"><section className="dashPanel liveHero"><div className="dashTitle"><div><span className="miniEyebrow">ASSIST</span><h3>Clip-E session</h3><p>{armStatus.online?'Live arm telemetry · arm-01':'Waiting for physical arm telemetry'}</p></div><span className={paused?'pausedBadge':armStatus.online?'trackingBadge':'cameraOffline'}>{paused?'● UI PAUSED':armStatus.online?'● ARM ONLINE':'● ARM OFFLINE'}</span></div><div className="liveHeroScene liveHeroCamera arduinoAssistFeed">{robotCameraOnline?<><LiveHeadAR src={arduinoCameraSrc} topLength={topLength} sideLength={sideLength} fadeHeight={fadeHeight} className="sessionCameraAR"/><div className="arduinoCameraBadge"><span>ARDUINO CAMERA</span><b>CAMERA-01 · LIVE</b></div></>:<div className="cameraPlaceholder"><Camera size={42}/><b>ARDUINO CAMERA OFFLINE</b><span>Waiting for camera-01 from the ESP32-S3 / Arducam mounted on Clip-E.</span><code>/api/camera/latest?device=camera-01</code></div>}</div><div className="taskBar"><span><small>CURRENT MODE</small><b>{armStatus.payload?.mode||'Awaiting telemetry'}</b></span><span><small>TARGET</small><b>{selectedStyle.name}</b></span><span><small>ARMED</small><b>{armStatus.payload?.armed?'YES':'NO'}</b></span></div></section><aside className="dashPanel sessionSafety"><h3>Safety</h3>{[['Arm link',armStatus.online?'Online':'Offline'],['PCA',armStatus.payload?.pca_ready?'Ready':'Not ready'],['E-stop',armStatus.payload?.estop?'ACTIVE':'Clear'],['Arduino camera',robotCameraOnline?'camera-01 active':'Offline'],['Rear phone',clipEPhoneCameraOnline?'Active':'Offline'],['Presage',presageState==='active'?'Context active':'Standby']].map(x=><div key={x[0]} className="miniStatus"><CheckCircle2/><span>{x[0]}</span><b>{x[1]}</b></div>)}<button className="pauseBtn" onClick={()=>setPaused(!paused)}><Pause/> {paused?'Resume Clip-E':'Pause Clip-E'}</button><button className="stopBtn" onClick={()=>{setPaused(true);setClipSaid('Stop requested. Confirm the physical arm is stopped.')}}><Square/> Request Stop</button></aside><section className="dashPanel voicePanel"><div className="dashTitle"><div><h3>Talk to Clip-E</h3><p>Voice guidance focuses on the area you cannot see.</p></div><Mic/></div><button className={'micOrb '+(talkState==='listening'?'listening':'')} onClick={startClipVoice} disabled={talkState==='thinking'||talkState==='speaking'}><Mic/><span>{talkState==='listening'?'Listening…':talkState==='thinking'?'Thinking…':talkState==='speaking'?'Clip-E speaking…':'Talk to Clip-E'}</span></button><div className="voiceTranscript"><MessageCircle/><div><small>YOU</small><b>{userSaid||'Ask about the current region.'}</b><small>CLIP-E</small><b>{clipSaid}</b></div></div><div className="quickCommands">{['Pause','How much longer?','What are you cutting?','Show back target','Keep the neckline','Original cut'].map(x=><button key={x} onClick={()=>askClipE(x)}>{x}</button>)}</div></section><section className="dashPanel clipSpeaks"><div className="dashTitle"><h3>Clip-E communication</h3><Volume2/></div>{['Back profile captured.','Target line identified.','Camera position confirmed.','Keep your head still while I remap this area.'].map((x,i)=><div key={x} className={'speech '+(i===0?'current':'')}><Volume2/><span>{x}</span></div>)}</section><section className="dashPanel approachAssist"><div className="dashTitle"><div><span className="miniEyebrow">CAMERA-GUIDED POSITIONING</span><h3>Approach assist</h3><p>The rear camera shows the mapped work zone while you use the arm joystick to move toward it. Clip-E does not autonomously drive the clipper into the head from a single monocular camera.</p></div><Target/></div><div className="approachGrid"><PhoneLiveView session={clipEPhoneSessionId} fallbackSrc={clipEPhoneCameraOnline?'/api/camera/latest?device=phone-back-01&session='+encodeURIComponent(clipEPhoneSessionId)+'&t='+clipEPhoneFrame:''} topLength={topLength} sideLength={sideLength} fadeHeight={fadeHeight} rearPlan={rearCutPlan} showMap/><div className="approachInstructions"><div className="approachStatus"><span>REAR CAMERA</span><b>{clipEPhoneCameraOnline?'READY':'WAITING'}</b></div><div className="approachStatus"><span>ARM LINK</span><b>{armStatus.online?'READY':'WAITING'}</b></div><div className="approachStatus"><span>E-STOP</span><b>{armStatus.payload?.estop?'ACTIVE':'CLEAR'}</b></div><div className="approachStep"><b>1</b><span>Use the arm's forward/back joystick to approach the highlighted region.</span></div><div className="approachStep"><b>2</b><span>Use CLIPPER-ONLY GYRO to aim Wrist Pitch + Wrist Roll.</span></div><div className="approachStep"><b>3</b><span>Stop at your calibrated physical standoff. The camera overlay is guidance, not depth sensing.</span></div><div className="approachLegend"><span><i className="lgTop"/>Crown / top</span><span><i className="lgBlend"/>Blend band</span><span><i className="lgLower"/>Lower back</span><span><i className="lgProtect"/>Protected / no-cut edge</span></div><div className="armAssistControls"><label>Operator key<input type="password" value={operatorKey} onChange={e=>setOperatorKey(e.target.value)} placeholder="Operator key"/></label><div className="row"><button className="primary" disabled={!armStatus.online||armStatus.payload?.estop} onClick={()=>sendArmAssist('approach_nudge',{forward:.12})}>NUDGE FORWARD</button><button className="ghost" disabled={!armStatus.online||armStatus.payload?.estop} onClick={()=>sendArmAssist('approach_nudge',{forward:-.12})}>NUDGE BACK</button><button className="warn" onClick={()=>sendArmAssist('retreat')}>SAFE RETREAT</button><button className="stop" onClick={()=>sendArmAssist('hold')}>HOLD</button></div><small>{assistCommandState==='idle'?'Each nudge is deliberately small and still constrained by the arm firmware safe limits.':assistCommandState}</small></div></div></div></section><div className="phaseActions"><button className="ghost" onClick={()=>setClipEPhase('calibrate')}>Calibration</button><button className="primary" onClick={()=>setClipEPhase('verify')}>Verify result <ArrowRight/></button></div></div>}

{clipEPhase==='verify'&&<div className="clipEUnifiedGrid phaseVerify"><section className="dashPanel resultCompare"><div className="dashTitle"><div><span className="miniEyebrow">VERIFY</span><h3>Before + after</h3><p>Use an actual post-session photo. Clip-E does not invent an after result.</p></div></div><div className="beforeAfter">{photo&&<figure><img src={photo}/><figcaption>Before</figcaption></figure>}{finalPhoto?<figure><img src={finalPhoto}/><figcaption>After</figcaption></figure>:<button className="afterPlaceholder" onClick={()=>finalRef.current?.click()}><Camera/><b>Add final photo</b><span>Capture or upload the real result.</span></button>}<input ref={finalRef} hidden type="file" accept="image/*" onChange={uploadFinalPhoto}/></div>{finalPhoto&&<button className="ghost replaceFinal" onClick={()=>finalRef.current?.click()}><RotateCcw/> Replace final photo</button>}</section><aside className="dashPanel feedbackPanel"><h3>Session verification</h3><div className="ratingRow">{[1,2,3,4,5].map(n=><button key={n} aria-label={n+' star rating'} className={sessionRating>=n?'active':''} onClick={()=>setSessionRating(n)}>★</button>)}</div><div className="feedbackChips">{['Back line right','Neckline right','Blend smooth','Motion comfortable','Needs refinement'].map(x=><button key={x} className={feedback.includes(x)?'active':''} onClick={()=>toggleFeedback(x)}>{feedback.includes(x)?'✓ ':''}{x}</button>)}</div><button className="primary wide" disabled={!sessionRating} onClick={saveSessionProfile}><CheckCircle2/> Save session profile</button><p>Saved sessions become the real reference for future growth tracking.</p></aside><section className="dashPanel sessionSummary"><h3>Session profile</h3>{[['Style',selectedStyle.name],['Hair pattern',hairAnalysis?.primaryType||hairAnalysis?.hairPattern||'Unknown'],['Top',topLength+' mm'],['Sides',sideLength+' mm'],['Fade',fadeHeight],['Finish',finish]].map(x=><div key={x[0]} className="reviewMetric"><span>{x[0]}</span><b>{x[1]}</b></div>)}</section><div className="phaseActions"><button className="ghost" onClick={()=>setClipEPhase('assist')}>Back to assist</button><button className="primary" onClick={()=>setStep(10)}>Open hair history <ArrowRight/></button></div></div>}
</div></div></Shell>}
{step===6&&<Shell {...{step,setStep}} guard={!planApproved} guardLabel="Approve the cut plan before opening robot setup." kicker="06 / REVIEW" title="Review + approve" desc="Confirm the preview, mapped lengths and protected boundaries. Approval unlocks setup; it does not directly command robot motion."><div className="reviewGrid"><section className="dashPanel reviewPreview"><div className="dashTitle"><div><h3>Before + planned result</h3><p>Use the same scan that generated your head map.</p></div><span className="trackingBadge">PLAN READY</span></div><div className="beforeAfter">{photo?<figure><img src={photo}/><figcaption>Original scan</figcaption></figure>:<div className="previewEmpty"><Camera/><b>No scan yet</b></div>}{preview?<figure><img src={preview}/><figcaption>Haircut preview</figcaption></figure>:<div className="previewEmpty"><Sparkles/><b>Preview not generated</b><span>Return to Styles to create one.</span></div>}</div></section><aside className="dashPanel approvalPanel"><h3>Cut plan summary</h3>{[['Top target',topLength+' mm'],['Side target',sideLength+' mm'],['Fade height',fadeHeight],['Texture',texture],['Finish',finish]].map(x=><div className="reviewMetric"><span>{x[0]}</span><b>{x[1]}</b></div>)}<div className="approvalChecks">{['Head map generated','Target zones defined','Protected edges marked','Manual pause available','Emergency stop ready'].map(x=><span><CheckCircle2/>{x}</span>)}</div><button className={'primary wide approvePlan '+(planApproved?'approved':'')} onClick={()=>setPlanApproved(true)}>{planApproved?<><CheckCircle2/> Plan approved</>:<><ShieldCheck/> Approve plan</>}</button><p className="approvalNote">Approval unlocks setup. It does not command physical motion by itself.</p></aside><section className="dashPanel reviewHeadMap"><div className="dashTitle"><div><h3>Your mapped head</h3><p>Actual captured views with cut zones layered on top.</p></div></div><PersonalHeadMap photo={photo} scanShots={scanShots} analysis={analysis} view={headView} setView={setHeadView} topLength={topLength} sideLength={sideLength} fadeHeight={fadeHeight}/></section></div></Shell>}
{step===7&&<Shell {...{step,setStep}} guard={!(planApproved&&armStatus.online&&robotCameraOnline&&setupChecks.workspace&&setupChecks.seated&&setupChecks.stop)} guardLabel="Setup must be fully verified before entering Live Cut." kicker="07 / SETUP" title="Robot setup + calibration" desc="Verify the physical prototype, camera, workspace and user position. This page reads live status; it does not silently assume hardware is ready."><div className="setupGrid"><section className="dashPanel setupOverview"><div className="dashTitle"><div><h3>Prototype readiness</h3><p>Live state from arm-01 and camera-01.</p></div><span className={armStatus.online&&robotCameraOnline?'trackingBadge':'cameraOffline'}>● {armStatus.online&&robotCameraOnline?'CONNECTED':'CHECK HARDWARE'}</span></div><div className="deviceReadiness">{[['Cut plan',planApproved,'Approved'],['Arm link',armStatus.online,armStatus.online?'arm-01 online':'Waiting for arm-01'],['PCA9685',!!armStatus.payload?.pca_ready,armStatus.payload?.pca_ready?'Controller ready':'No ready signal'],['Emergency stop',armStatus.payload?.estop===false,armStatus.payload?.estop?'E-stop active':'No E-stop flag'],['Robot camera',robotCameraOnline,robotCameraOnline?'camera-01 online':'Waiting for camera-01']].map(x=><div className={'readinessRow '+(x[1]?'ok':'wait')}><i>{x[1]?'✓':'·'}</i><span><b>{x[0]}</b><small>{x[2]}</small></span></div>)}</div><div className="telemetryStrip"><span><small>MODE</small><b>{armStatus.payload?.mode||'—'}</b></span><span><small>ARMED</small><b>{armStatus.payload?.armed?'YES':'NO'}</b></span><span><small>WIFI</small><b>{armStatus.payload?.wifi_rssi??'—'} dBm</b></span><span><small>JOINTS</small><b>{Array.isArray(armStatus.payload?.joint_deg)?armStatus.payload.joint_deg.slice(0,5).map(v=>Math.round(v)).join(' · '):'—'}</b></span></div></section><aside className="dashPanel setupChecklist"><h3>Human setup checks</h3>{[['workspace','Workspace is clear','No loose objects, cables, hands or tools inside the arm path.'],['seated','User position confirmed','Head and chair are aligned with the planned workspace.'],['stop','Physical stop verified','The hardware E-stop / power cutoff has been tested before the session.']].map(x=><button className={'manualCheck '+(setupChecks[x[0]]?'checked':'')} onClick={()=>setSetupChecks(v=>({...v,[x[0]]:!v[x[0]]}))}><i>{setupChecks[x[0]]?'✓':''}</i><span><b>{x[1]}</b><small>{x[2]}</small></span></button>)}<div className="setupWarning"><ShieldCheck/><p><b>Physical safety remains independent.</b> Browser controls are not a replacement for a hardware emergency stop or tested motion limits.</p></div></aside><section className="dashPanel setupCamera"><div className="dashTitle"><div><h3>Dual workspace cameras</h3><p>Arducam watches the front/side workspace. Your phone watches the back of the head and neckline.</p></div><span className={(robotCameraOnline&&phoneCameraOnline)?'live':'cameraOffline'}>● {(robotCameraOnline&&phoneCameraOnline)?'BOTH LIVE':'CHECK CAMERAS'}</span></div><div className="dualCameraGrid"><div className="cameraRoleCard"><div className="cameraRoleHead"><div><small>FRONT / SIDE</small><b>Arducam · camera-01</b></div><span className={robotCameraOnline?'live':'cameraOffline'}>{robotCameraOnline?'● LIVE':'○ WAITING'}</span></div><div className="robotCamWrap">{robotCameraOnline?<img className="robotCamStream" src={'/api/camera/latest?device=camera-01&t='+robotFrame} alt="Arducam front and side workspace view"/>:<div className="robotCamSetup"><Camera/><h3>camera-01 not online</h3><p>Keep the existing ESP32-S3 Arducam online. Its API and upload path are unchanged.</p></div>}</div></div><div className="cameraRoleCard rearHeadCard"><div className="cameraRoleHead"><div><small>BACK OF HEAD</small><b>Phone · phone-back-01</b></div><span className={phoneCameraOnline?'live':'cameraOffline'}>{phoneCameraOnline?'● LIVE':'○ WAITING'}</span></div><div className="robotCamWrap">{phoneCameraOnline?<img className="robotCamStream" src={'/api/camera/latest?device=phone-back-01&t='+phoneFrame} alt="Phone back-of-head and neckline view"/>:<div className="robotCamSetup"><Camera/><h3>Rear phone camera not online</h3><p>Open the phone camera page, point the rear camera at the back of the head, and keep the neckline and both ears visible.</p><a className="cameraLaunchLink" href={phoneCameraUrl} target="_blank" rel="noreferrer">Open phone rear camera</a></div>}</div></div></div></section><section className="dashPanel setupPlan"><h3>Approved plan</h3>{[['Style',styles[style]?.[0]||'Selected style'],['Goal',hairGoal],['Top',topLength+' mm'],['Sides',sideLength+' mm'],['Fade',fadeHeight],['Texture',texture]].map(x=><div className="reviewMetric"><span>{x[0]}</span><b>{x[1]}</b></div>)}</section></div></Shell>}
{step===8&&<Shell {...{step,setStep}} kicker="07 / MOVE" title="Live Cut" desc="One workspace for the current robot task, mapped cutting zone, progress, voice communication and safety controls."><div className="liveCutGrid">
<section className="dashPanel liveHero"><div className="dashTitle"><div><h3>Clip-E Session</h3><p>{armStatus.online?'Live arm telemetry · arm-01':'Waiting for physical arm telemetry'}</p></div><span className={paused?'pausedBadge':armStatus.online?'trackingBadge':'cameraOffline'}>{paused?'● UI PAUSED':armStatus.online?'● ARM ONLINE':'● ARM OFFLINE'}</span></div><div className="liveHeroScene liveHeroCamera">{robotCameraOnline?<><img className="sessionCamStream" src={'/api/camera/latest?device=camera-01&t='+robotFrame} alt="Arducam front and side cutting view"/><div className="sessionCamOverlay"><span>FRONT / SIDE · CAMERA-01</span><b>ARDUCAM LIVE</b></div>{phoneCameraOnline&&<div className="rearPip"><img src={'/api/camera/latest?device=phone-back-01&t='+phoneFrame} alt="Phone rear-head view"/><div><span>BACK OF HEAD</span><b>PHONE LIVE</b></div></div>}</>:<><div className="cameraPlaceholder"><Camera size={42}/><b>ARDUCAM FEED</b><span>Connect camera-01 to view the working region.</span></div><Arm mode={paused?'home':'map'}/><div className="cutArc"/><div className="connectCamInline"><Camera/> Waiting for camera-01</div>{phoneCameraOnline&&<div className="rearPip"><img src={'/api/camera/latest?device=phone-back-01&t='+phoneFrame} alt="Phone rear-head view"/><div><span>BACK OF HEAD</span><b>PHONE LIVE</b></div></div>}</>}</div><div className="taskBar"><span><small>CURRENT MODE</small><b>{armStatus.payload?.mode||'Awaiting telemetry'}</b></span><span><small>SIDE TARGET</small><b>{sideLength} mm</b></span><span><small>ARMED</small><b>{armStatus.payload?.armed?'YES':'NO'}</b></span></div><div className="progressTrack"><i/></div></section>
<aside className="dashPanel sessionSafety"><h3>Safety</h3>{[['Arm link',armStatus.online?'Online':'Offline'],['PCA',armStatus.payload?.pca_ready?'Ready':'Not ready'],['E-stop',armStatus.payload?.estop?'ACTIVE':'Clear'],['Arducam',robotCameraOnline?'Front/side active':'Offline'],['Rear phone',phoneCameraOnline?'Back-head active':'Offline'],['Presage',presageState==='active'?'Context active':'Standby']].map(x=><div className="miniStatus"><CheckCircle2/><span>{x[0]}</span><b>{x[1]}</b></div>)}<button className="pauseBtn" onClick={()=>setPaused(!paused)}><Pause/> {paused?'Resume Clip-E':'Pause Clip-E'}</button><button className="stopBtn" onClick={()=>{setPaused(true);setClipSaid('Stop requested. Confirm the physical arm is stopped.')}}><Square/> Request Stop</button></aside>
<section className="dashPanel voicePanel"><div className="dashTitle"><div><h3>Talk to Clip-E</h3><p>Clip-E acts as a technical assistant for the area you cannot see. Guidance stays concise while the camera and robot are active.</p></div><Mic/></div><button className={'micOrb '+(talkState==='listening'?'listening':'')} onClick={startClipVoice} disabled={talkState==='thinking'||talkState==='speaking'}><Mic/><span>{talkState==='listening'?'Listening…':talkState==='thinking'?'Thinking…':talkState==='speaking'?'Clip-E speaking…':'Talk to Clip-E'}</span></button><div className="voiceTranscript"><MessageCircle/><div><small>YOU</small><b>{userSaid||'Say something about your cut.'}</b><small>CLIP-E</small><b>{clipSaid}</b></div></div><div className="changeCard"><span>CHANGE DETECTED · SIDE LENGTH</span><div><p>Current<b>6 mm</b></p><ArrowRight/><p>Requested<b>4 mm</b></p></div>{!change?<button className="primary wide" onClick={()=>setChange(true)}>Confirm change</button>:<div className="confirmed"><CheckCircle2/> Change confirmed · plan will update before motion resumes.</div>}</div><div className="quickCommands">{['Pause','How much longer?','What are you cutting?','Leave the top longer','Show back target','Original cut'].map(x=><button onClick={()=>askClipE(x)}>{x}</button>)}</div></section>
<section className="dashPanel clipSpeaks"><div className="dashTitle"><h3>Clip-E Communication</h3><Volume2/></div>{['Back profile captured.','Target line identified.','Camera position confirmed.','Keep your head still while I remap this area.'].map((x,i)=><div className={'speech '+(i===0?'current':'')}><Volume2/><span>{x}</span></div>)}</section>
<section className="dashPanel liveCamera"><div className="presageStrip"><span>PRESAGE · SMARTSPECTRA</span><b>{presageState==='active'?'CONTEXT ACTIVE':'READY FOR CAMERA PROCESSOR'}</b><p>Facial metrics are contextual only. The Arducam remains the front/side workspace source while phone-back-01 is reserved for the rear head and neckline.</p></div><div className="dashTitle"><div><h3>Camera Coverage</h3><p>Two independent Clip-E camera devices · same existing camera API</p></div><span className={(robotCameraOnline&&phoneCameraOnline)?'live':'cameraOffline'}>● {(robotCameraOnline&&phoneCameraOnline)?'DUAL VIEW':'PARTIAL VIEW'}</span></div><div className="dualCameraGrid"><div className="cameraRoleCard"><div className="cameraRoleHead"><div><small>FRONT / SIDE WORKSPACE</small><b>Arducam · camera-01</b></div><span className={robotCameraOnline?'live':'cameraOffline'}>{robotCameraOnline?'● LIVE':'○ WAITING'}</span></div><div className="robotCamWrap">{robotCameraOnline?<img className="robotCamStream" src={'/api/camera/latest?device=camera-01&t='+robotFrame} alt="Clip-E Arducam front side view"/>:<div className="robotCamSetup"><Camera size={38}/><h3>Waiting for camera-01</h3><p>The ESP32-S3 keeps using the original authenticated Arducam upload API.</p><code>/api/camera/upload</code></div>}</div></div><div className="cameraRoleCard rearHeadCard"><div className="cameraRoleHead"><div><small>BACK / NAPE / REAR SIDES</small><b>Phone · phone-back-01</b></div><span className={phoneCameraOnline?'live':'cameraOffline'}>{phoneCameraOnline?'● LIVE':'○ WAITING'}</span></div><div className="robotCamWrap">{phoneCameraOnline?<img className="robotCamStream" src={'/api/camera/latest?device=phone-back-01&t='+phoneFrame} alt="Clip-E rear head phone view"/>:<div className="robotCamSetup"><Camera size={38}/><h3>Waiting for phone-back-01</h3><p>Place the phone behind the person with the rear camera aimed at the back of the head. Keep the nape, both ears, and rear hairline visible.</p><a className="cameraLaunchLink" href={phoneCameraUrl} target="_blank" rel="noreferrer">Open phone rear camera</a></div>}</div></div></div></section>
</div></Shell>}
{step===9&&<Shell {...{step,setStep}} kicker="09 / RESULTS" title="Session complete" desc="Capture the actual result, compare it with the original scan, and save what should carry into the next session."><div className="resultsGrid"><section className="dashPanel resultCompare"><div className="dashTitle"><div><h3>Before + after</h3><p>Use an actual post-cut photo for the after view.</p></div></div><div className="beforeAfter">{photo&&<figure><img src={photo}/><figcaption>Before</figcaption></figure>}{finalPhoto?<figure><img src={finalPhoto}/><figcaption>After</figcaption></figure>:<button className="afterPlaceholder" onClick={()=>finalRef.current?.click()}><Camera/><b>Add final photo</b><span>Upload a post-cut image to complete this session.</span></button>}<input ref={finalRef} hidden type="file" accept="image/*" onChange={uploadFinalPhoto}/></div>{finalPhoto&&<button className="ghost replaceFinal" onClick={()=>finalRef.current?.click()}><RotateCcw/> Replace final photo</button>}</section><aside className="dashPanel feedbackPanel"><h3>How did Clip-E do?</h3><div className="ratingRow">{[1,2,3,4,5].map(n=><button key={n} aria-label={n+' star rating'} className={sessionRating>=n?'active':''} onClick={()=>setSessionRating(n)}>★</button>)}</div><div className="feedbackChips">{['Fade height right','Top length right','Blend smooth','Motion comfortable','Needs refinement'].map(x=><button key={x} className={feedback.includes(x)?'active':''} onClick={()=>toggleFeedback(x)}>{feedback.includes(x)?'✓ ':''}{x}</button>)}</div><button className="primary wide" disabled={!sessionRating} onClick={saveSessionProfile}><CheckCircle2/> Save session profile</button><p>Your rating, dimensions and selected feedback are stored locally with this prototype profile.</p></aside><section className="dashPanel sessionSummary"><h3>Session profile</h3>{[['Style',styles[style]?.[0]||'Selected style'],['Goal',hairGoal],['Top',topLength+' mm'],['Sides',sideLength+' mm'],['Fade',fadeHeight],['Finish',finish]].map(x=><div className="reviewMetric"><span>{x[0]}</span><b>{x[1]}</b></div>)}</section></div></Shell>}
{step===10&&<Shell {...{step,setStep}} prevStep={5} kicker="06 / HISTORY" title="Your Hair Journey" desc="Saved Clip-E sessions keep your preferred dimensions, feedback and direction together so the next plan does not have to start from zero."><div className="historyLayout"><div className="panel passport"><h3>Hair Passport</h3><div className="avatar">SK</div><b>Current direction</b><h2>{styles[style]?.[0]||'Your style'}</h2><div className="tags"><span>{hairGoal}</span><span>{finish}</span><span>{topLength} mm top</span><span>{sideLength} mm sides</span></div></div><section className="savedSessions"><div className="dashTitle"><div><h3>Saved sessions</h3><p>{savedStyles.length?savedStyles.length+' recent session'+(savedStyles.length===1?'':'s'):'Save a completed session to build history.'}</p></div></div>{savedStyles.length?savedStyles.map((x,i)=><article className="sessionCard" key={x.id||i}>{x.photo?<img src={x.photo} alt="Saved haircut"/>:<div className="sessionNoPhoto"><Scissors/></div>}<div><small>{x.date}</small><h3>{x.style}</h3><p>{x.topLength} mm top · {x.sideLength} mm sides · {x.fadeHeight} fade</p><div className="sessionStars">{'★★★★★'.slice(0,x.rating||0)}<span>{'★★★★★'.slice(x.rating||0)}</span></div>{x.feedback?.length>0&&<small>{x.feedback.join(' · ')}</small>}</div><button className="ghost" onClick={()=>{setTopLength(x.topLength);setSideLength(x.sideLength);setFadeHeight(x.fadeHeight);setTexture(x.texture);setFinish(x.finish);setHairGoal(x.hairGoal||'Maintain');setStep(3)}}>Reuse</button></article>):<div className="emptyHistory"><Scissors/><b>No saved sessions yet</b><p>Complete Results and save a session profile. It will appear here.</p></div>}</section></div><section className="future"><h2>Camera vision + AI understanding + physical assistance.</h2><p>The current prototype focuses on difficult-to-see regions of the head. The larger idea can extend to different hair types, textures, styling techniques, tools, and accessibility needs without changing the core system: see, understand, guide, assist.</p><div>{['PRECISION CLIPPER','ADJUSTABLE GUARD','COMB / SECTIONING','TENSION CONTROL','TEXTURE-SPECIFIC TOOLS'].map(x=><span>{x}</span>)}</div></section></Shell>}
{sessionTransition&&<div className="sessionTransition"><CheckCircle2/><b>{sessionTransition}</b><span>Keeping your Clip-E session active.</span></div>}{step===11&&<Shell {...{step,setStep}} prevStep={10} kicker="07 / ACCESSIBILITY" title="Why Clip-E?" desc="The core problem is visibility and reach. Clip-E explores how camera vision, AI understanding, and physical assistance can make difficult-to-see grooming tasks clearer and more manageable."><div className="accessIntro"><div><Accessibility/><h2>See the area. Understand the target. Assist where reach gets difficult.</h2><p>A camera-assisted system may be especially useful when someone cannot comfortably see the back of their head, coordinate multiple mirrors, maintain arm position, or reach certain areas while using a grooming tool.</p></div><div className="accessHead"><div className="assistDiagram"><Camera/><ArrowRight/><Target/><ArrowRight/><Arm mode="ready"/></div></div></div><div className="applicationGrid">{[
['Independent Grooming','A potential future tool for people who face physical barriers to independently cutting or maintaining their hair.','01'],
['Limited Hand or Arm Mobility','Automated positioning and cutting could reduce reliance on the fine hand movements required by traditional grooming tools.','02'],
['Communication Support','Visual controls, voice interaction and explicit confirmations provide multiple ways to communicate preferences.','03'],
['Consistent Maintenance Cuts','A saved haircut profile could help recreate the same dimensions and style during future sessions.','04'],
['Remote or Limited-Service Environments','Future versions could provide standardized grooming options where professional services are difficult to access.','05'],
['Personalized Hair Care','Users could track haircut history, goals, preferred lengths and style changes over time.','06']
].map(x=><article><span>{x[2]}</span><h3>{x[0]}</h3><p>{x[1]}</p><ArrowRight/></article>)}</div><div className="designPrinciple"><ShieldCheck/><div><b>DESIGNED TO EXPLORE, NOT OVERCLAIM</b><p>Accessibility needs vary widely. Clip-E’s future development would require testing with users, adaptable controls, different tools and sensing strategies, and appropriate safety validation for each intended use.</p></div></div></Shell>}
</div>}createRoot(document.getElementById('root')).render(location.pathname==='/phone-camera'?<PhoneCamera/>:<App/>);