import React,{useEffect,useRef,useState} from 'react';
import {Camera,RefreshCw,Wifi,WifiOff} from 'lucide-react';

export default function PhoneCamera(){
  const videoRef=useRef(null),canvasRef=useRef(null),timerRef=useRef(null),streamRef=useRef(null),pcRef=useRef(null),answerTimerRef=useRef(null);
  const [running,setRunning]=useState(false);
  const [status,setStatus]=useState('Ready');
  const [seq,setSeq]=useState(0);
  const [fps,setFps]=useState(2);
  const [token,setToken]=useState('');
  const [expiresAt,setExpiresAt]=useState(0);
  const session=new URLSearchParams(location.search).get('session')||'demo';
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
    stream.getTracks().forEach(track=>pc.addTrack(track,stream));
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
    setToken(j.token);setExpiresAt(j.expires_at);return j.token;
  }

  async function start(){
    try{
      stop();
      setStatus('Requesting rear camera…');
      const s=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},
        audio:false
      });
      streamRef.current=s;
      if(videoRef.current){videoRef.current.srcObject=s;await videoRef.current.play();}
      await getToken();
      await startWebRTC(s).catch(()=>setStatus('Snapshot fallback active'));
      setRunning(true);if(pcRef.current?.connectionState!=='connected')setStatus('Rear camera active · waiting for computer');
    }catch(e){setStatus(e.message||'Camera permission failed');setRunning(false)}
  }

  function stop(){
    if(timerRef.current)clearInterval(timerRef.current);
    timerRef.current=null;
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null;
    pcRef.current?.close();pcRef.current=null;
    if(answerTimerRef.current)clearInterval(answerTimerRef.current);answerTimerRef.current=null;
    setRunning(false);
  }

  async function uploadFrame(){
    const v=videoRef.current,c=canvasRef.current;
    if(!v?.videoWidth||!c)return;
    c.width=640;c.height=Math.round(640*v.videoHeight/v.videoWidth);
    c.getContext('2d').drawImage(v,0,0,c.width,c.height);
    const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',0.68));
    if(!blob)return;
    let auth=token;
    if(!auth||Date.now()>expiresAt-60000)auth=await getToken();
    const next=seq+1;
    const r=await fetch('/api/camera/phone-upload',{
      method:'POST',
      headers:{
        'Content-Type':'image/jpeg',
        'x-trimsync-phone-token':auth,
        'x-trimsync-device-id':'phone-back-01',
        'x-trimsync-frame-seq':String(next),
        'x-trimsync-session-id':session
      },
      body:blob
    });
    if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Upload failed')}
    setSeq(next);setStatus('Live · frame '+next);
  }

  useEffect(()=>{
    if(!running)return;
    uploadFrame().catch(e=>setStatus(e.message));
    timerRef.current=setInterval(()=>uploadFrame().catch(e=>setStatus(e.message)),Math.max(200,1000/fps));
    return()=>{if(timerRef.current)clearInterval(timerRef.current)}
  },[running,fps,token,expiresAt]);

  useEffect(()=>{
    // Try immediately so Android/Chrome can show the permission prompt on page load.
    // Browsers that require a user gesture simply fall back to the large START button.
    const t=setTimeout(()=>{if(!streamRef.current)start()},250);
    return()=>{clearTimeout(t);stop()};
  },[]);

  return <div className="phoneCamPage">
    <header className="phoneCamHeader"><div><b>CLIP-E</b><span>FIXED REAR WORKSPACE CAMERA</span></div><span className={running?'phoneLive':'phoneIdle'}>{running?<Wifi size={15}/>:<WifiOff size={15}/>} {running?'LIVE':'OFFLINE'}</span></header>
    <main className="phoneCamMain">
      <section className="phoneCamStage">
        <video ref={videoRef} autoPlay playsInline muted/>
        <canvas ref={canvasRef} hidden/>
        <div className="backGuide"><div className="headGuide"/><b>Frame HEAD + CLIPPER together</b><span>Mount the phone behind the arm. Keep the crown, nape, both ears, and clipper/tool tip visible in the same frame.</span></div>
      </section>
      <section className="phoneCamControls">
        <div><span>SESSION</span><b>{session}</b></div>
        <div><span>UPLOAD RATE</span><b>{fps} FPS</b></div>
        <input type="range" min="1" max="5" value={fps} onChange={e=>setFps(Number(e.target.value))}/>
        <p>{status}</p>
        {!running?<button className="primary big" onClick={start}><Camera size={18}/> Start rear camera</button>:<button className="ghost big" onClick={stop}><RefreshCw size={18}/> Stop camera</button>}
        <div className="phoneMountChecklist"><b>Mount once, then leave it fixed</b><span>1. Place the phone behind and slightly above the arm.</span><span>2. Aim toward the back of the head.</span><span>3. Keep the clipper/tool tip visible in the same frame.</span><span>4. Do not move the phone during the assisted session.</span></div><small>This fixed view is used for the rear head map and operator-guided approach. WebRTC carries the live video; JPEG snapshots continue in parallel for scan capture and fallback.</small>
      </section>
    </main>
  </div>
}
