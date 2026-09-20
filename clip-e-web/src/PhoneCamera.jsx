import React,{useEffect,useRef,useState} from 'react';
import {Camera,RefreshCw,Wifi,WifiOff} from 'lucide-react';

export default function PhoneCamera(){
  const videoRef=useRef(null),canvasRef=useRef(null),timerRef=useRef(null),streamRef=useRef(null),pcRef=useRef(null),answerTimerRef=useRef(null),frameCallbackRef=useRef(null),captureFpsRef=useRef({t:performance.now(),n:0}),seqRef=useRef(0),tokenRef=useRef(''),expiresAtRef=useRef(0),uploadBusyRef=useRef(false);
  const [running,setRunning]=useState(false);
  const [status,setStatus]=useState('Ready');
  const [seq,setSeq]=useState(0);
  const [fps,setFps]=useState(2);
  const [captureFps,setCaptureFps]=useState(0);
  const [cameraSettings,setCameraSettings]=useState({width:0,height:0,frameRate:0});
  const [token,setToken]=useState('');
  const [expiresAt,setExpiresAt]=useState(0);
  const params=new URLSearchParams(location.search);
  const session=params.get('session')||'demo';
  const mode=params.get('mode')==='clip-e'?'clip-e':'scan';
  const modeLabel=mode==='clip-e'?'CLIP-E REAR ASSIST CAMERA':'SCAN REAR CAMERA';
  const rtcConfig={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};

  function waitIce(pc,timeout=3500){
    if(pc.iceGatheringState==='complete')return Promise.resolve();
    return new Promise(resolve=>{
      const done=()=>{pc.removeEventListener('icegatheringstatechange',check);resolve()};
      const check=()=>{if(pc.iceGatheringState==='complete')done()};
      pc.addEventListener('icegatheringstatechange',check);
      setTimeout(done,timeout);
    });
  }

  async function startWebRTC(stream){
    pcRef.current?.close();
    if(answerTimerRef.current)clearInterval(answerTimerRef.current);

    const pc=new RTCPeerConnection(rtcConfig);
    pcRef.current=pc;
    stream.getTracks().forEach(track=>{
      const sender=pc.addTrack(track,stream);
      if(track.kind==='video'){
        try{
          const p=sender.getParameters();p.encodings=p.encodings?.length?p.encodings:[{}];
          p.encodings[0]={...p.encodings[0],maxFramerate:30,maxBitrate:2500000};
          p.degradationPreference='maintain-framerate';
          sender.setParameters(p).catch(()=>{});
        }catch{}
      }
    });
    pc.onconnectionstatechange=()=>{
      if(pc.connectionState==='connected')setStatus('WebRTC live · rear-head stream connected');
      if(pc.connectionState==='failed')setStatus('WebRTC unavailable · snapshot fallback active');
    };

    const offer=await pc.createOffer({offerToReceiveAudio:false,offerToReceiveVideo:false});
    await pc.setLocalDescription(offer);
    await waitIce(pc);

    const post=await fetch('/api/camera/signal',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({session,type:'offer',sdp:pc.localDescription})
    });
    if(!post.ok)throw Error('Could not publish live-camera offer');

    answerTimerRef.current=setInterval(async()=>{
      try{
        const r=await fetch('/api/camera/signal?session='+encodeURIComponent(session),{cache:'no-store'});
        const j=await r.json();
        if(j.answer&&pc.signalingState==='have-local-offer'){
          await pc.setRemoteDescription(j.answer);
          clearInterval(answerTimerRef.current);
          answerTimerRef.current=null;
        }
      }catch{}
    },800);
  }

  async function getToken(){
    const r=await fetch('/api/camera/phone-token',{cache:'no-store'});
    const j=await r.json();
    if(!r.ok)throw Error(j.error||'Could not authorize phone camera');
    tokenRef.current=j.token;expiresAtRef.current=j.expires_at;setToken(j.token);setExpiresAt(j.expires_at);return j.token;
  }

  async function start(){
    try{
      stop();
      setStatus('Requesting rear camera…');
      let s;
      try{
        s=await navigator.mediaDevices.getUserMedia({
          video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,min:20,max:30}},
          audio:false
        });
      }catch(e){
        console.warn('[Clip-E phone] 30 FPS minimum unavailable; retrying flexible request',e);
        s=await navigator.mediaDevices.getUserMedia({
          video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},
          audio:false
        });
      }
      streamRef.current=s;
      const track=s.getVideoTracks()[0];
      try{
        const caps=track?.getCapabilities?.()||{},settings=track?.getSettings?.()||{};
        console.info('[Clip-E phone] settings',settings);
        console.info('[Clip-E phone] capabilities',caps);
        const maxFps=typeof caps.frameRate?.max==='number'?caps.frameRate.max:30;
        const target=Math.min(30,maxFps||30);
        if(track?.applyConstraints&&target){
          const frameRate={ideal:target,max:target};if(target>=20)frameRate.min=20;
          await track.applyConstraints({frameRate}).catch(()=>{});
        }
        const tuned=track?.getSettings?.()||settings;
        setCameraSettings({width:tuned.width||0,height:tuned.height||0,frameRate:tuned.frameRate||0});
        console.info('[Clip-E phone] tuned settings',tuned);
      }catch(e){console.warn('[Clip-E phone] track tuning failed',e)}
      if(videoRef.current){videoRef.current.srcObject=s;await videoRef.current.play();}
      await getToken();
      await startWebRTC(s).catch(()=>setStatus('Snapshot fallback active'));
      setRunning(true);if(pcRef.current?.connectionState!=='connected')setStatus('Rear camera active · waiting for computer');
    }catch(e){setStatus(e.message||'Camera permission failed');setRunning(false)}
  }

  function stop(){
    if(timerRef.current)clearInterval(timerRef.current);
    timerRef.current=null;
    if(frameCallbackRef.current&&videoRef.current?.cancelVideoFrameCallback)videoRef.current.cancelVideoFrameCallback(frameCallbackRef.current);
    frameCallbackRef.current=null;
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null;
    pcRef.current?.close();pcRef.current=null;
    if(answerTimerRef.current)clearInterval(answerTimerRef.current);answerTimerRef.current=null;
    setRunning(false);
  }

  async function uploadFrame(){
    if(uploadBusyRef.current)return;
    const v=videoRef.current,c=canvasRef.current;
    if(!v?.videoWidth||!c)return;
    uploadBusyRef.current=true;
    try{
      c.width=640;c.height=Math.max(1,Math.round(640*v.videoHeight/v.videoWidth));
      c.getContext('2d',{alpha:false,desynchronized:true}).drawImage(v,0,0,c.width,c.height);
      const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',0.72));
      if(!blob?.size)return;
      let auth=tokenRef.current;
      if(!auth||Date.now()>expiresAtRef.current-60000)auth=await getToken();
      const next=seqRef.current+1;
      const r=await fetch('/api/camera/phone-upload',{
        method:'POST',
        headers:{
          'Content-Type':'image/jpeg',
          'x-trimsync-phone-token':auth,
          'x-trimsync-device-id':'phone-back-01',
          'x-trimsync-frame-seq':String(next),
          'x-trimsync-session-id':session
        },
        body:blob,
        cache:'no-store'
      });
      if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Upload failed')}
      seqRef.current=next;setSeq(next);setStatus('Live · frame '+next);
    }finally{
      uploadBusyRef.current=false;
    }
  }

  useEffect(()=>{
    if(!running||!videoRef.current)return;
    const v=videoRef.current;let stopped=false;
    const onFrame=()=>{
      if(stopped)return;
      const now=performance.now(),m=captureFpsRef.current;m.n++;
      if(now-m.t>=900){setCaptureFps(Math.round(m.n*1000/(now-m.t)));m.n=0;m.t=now}
      if(v.requestVideoFrameCallback)frameCallbackRef.current=v.requestVideoFrameCallback(onFrame);
    };
    if(v.requestVideoFrameCallback)frameCallbackRef.current=v.requestVideoFrameCallback(onFrame);
    return()=>{stopped=true;if(frameCallbackRef.current&&v.cancelVideoFrameCallback)v.cancelVideoFrameCallback(frameCallbackRef.current)}
  },[running]);

  useEffect(()=>{
    if(!running)return;
    uploadFrame().catch(e=>setStatus(e.message));
    timerRef.current=setInterval(()=>uploadFrame().catch(e=>setStatus(e.message)),Math.max(200,1000/fps));
    return()=>{if(timerRef.current)clearInterval(timerRef.current)}
  },[running,fps]);

  useEffect(()=>{
    // Try immediately so Android/Chrome can show the permission prompt on page load.
    // Browsers that require a user gesture simply fall back to the large START button.
    const t=setTimeout(()=>{if(!streamRef.current)start()},250);
    return()=>{clearTimeout(t);stop()};
  },[]);

  return <div className="phoneCamPage">
    <header className="phoneCamHeader"><div><b>CLIP-E</b><span>{modeLabel}</span></div><span className={running?'phoneLive':'phoneIdle'}>{running?<Wifi size={15}/>:<WifiOff size={15}/>} {running?'LIVE':'OFFLINE'}</span></header>
    <main className="phoneCamMain">
      <section className="phoneCamStage">
        <video ref={videoRef} autoPlay playsInline muted/>
        <canvas ref={canvasRef} hidden/>
        <div className="backGuide"><div className="headGuide"/><b>{mode==='clip-e'?'Frame the back of the head':'Frame the back of your head'}</b><span>{mode==='clip-e'?'Place this phone behind the user. Keep the crown, nape, both ears, and rear sides visible for Clip-E calibration and assistance.':'Keep the crown, nape, both ears, and rear hairline visible for the back scan.'}</span></div>
      </section>
      <section className="phoneCamControls">
        <div><span>SESSION</span><b>{session}</b></div>
        <div><span>PHONE CAPTURE</span><b>{captureFps||'—'} FPS</b></div>
        <div><span>CAMERA MODE</span><b>{cameraSettings.width||'—'}×{cameraSettings.height||'—'} · {cameraSettings.frameRate?Math.round(cameraSettings.frameRate)+' FPS':'—'}</b></div>
        <div><span>SNAPSHOT UPLOAD</span><b>{fps} FPS</b></div>
        <input type="range" min="1" max="5" value={fps} onChange={e=>setFps(Number(e.target.value))}/>
        <p>{status}</p>
        {!running?<button className="primary big" onClick={start}><Camera size={18}/> Start rear camera</button>:<button className="ghost big" onClick={stop}><RefreshCw size={18}/> Stop camera</button>}
        <div className="phoneMountChecklist"><b>{mode==='clip-e'?'Dedicated CLIP-E rear view':'Back scan view'}</b>{mode==='clip-e'?<><span>1. Place this phone behind the user.</span><span>2. Aim at the back, nape, and rear sides.</span><span>3. Keep both ears and the full rear hairline visible.</span><span>4. Leave this phone fixed during calibration and assistance.</span></>:<><span>1. Hold or place the phone behind the user.</span><span>2. Keep the full back of the head visible.</span><span>3. Capture crown, nape, rear sides, and both ears.</span><span>4. Return to the computer when the scan registers.</span></>}</div><small>{mode==='clip-e'?'This camera session is separate from the Scan phone connection.':'This camera session is used only for the Scan back view.'}</small>
      </section>
    </main>
  </div>
}
