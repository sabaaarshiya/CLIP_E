import React,{useEffect,useRef,useState} from 'react';
import {Camera,Wifi,Target} from 'lucide-react';

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

export default function PhoneLiveView({
  session,
  fallbackSrc='',
  topLength=25,
  sideLength=6,
  fadeHeight='Mid',
  showMap=true,
  compact=false
}){
  const videoRef=useRef(null);
  const pcRef=useRef(null);
  const [state,setState]=useState('connecting');
  const [usingWebRTC,setUsingWebRTC]=useState(false);

  useEffect(()=>{
    let cancelled=false,timer=null,lastOffer='';

    async function connect(){
      try{
        const r=await fetch('/api/camera/signal?session='+encodeURIComponent(session),{cache:'no-store'});
        const j=await r.json();
        if(cancelled||!j.offer)return;
        const fingerprint=j.offer?.sdp||'';
        if(!fingerprint||fingerprint===lastOffer)return;
        lastOffer=fingerprint;

        pcRef.current?.close();
        const pc=new RTCPeerConnection(rtcConfig);
        pcRef.current=pc;
        pc.ontrack=e=>{
          if(cancelled)return;
          const stream=e.streams?.[0]||new MediaStream([e.track]);
          if(videoRef.current){
            videoRef.current.srcObject=stream;
            videoRef.current.play().catch(()=>{});
          }
          setUsingWebRTC(true);
          setState('live');
        };
        pc.onconnectionstatechange=()=>{
          if(cancelled)return;
          if(pc.connectionState==='connected'){setUsingWebRTC(true);setState('live')}
          if(['failed','disconnected','closed'].includes(pc.connectionState)){
            setUsingWebRTC(false);setState('fallback')
          }
        };

        await pc.setRemoteDescription(j.offer);
        const answer=await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitIce(pc);
        await fetch('/api/camera/signal',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({session,type:'answer',sdp:pc.localDescription})
        });
        setState('negotiating');
      }catch{
        setUsingWebRTC(false);setState('fallback');
      }
    }

    connect();
    timer=setInterval(connect,1200);
    return()=>{cancelled=true;clearInterval(timer);pcRef.current?.close();pcRef.current=null};
  },[session]);

  const blendMax=Math.max(sideLength+8,Math.round(topLength*.7));
  return <div className={'phoneLiveView '+(compact?'compact ':'')+(usingWebRTC?'webrtc':'fallback')}>
    <video ref={videoRef} autoPlay playsInline muted className={usingWebRTC?'visible':''}/>
    {!usingWebRTC&&fallbackSrc&&<img src={fallbackSrc} alt="Rear phone camera fallback"/>}
    {!usingWebRTC&&!fallbackSrc&&<div className="phoneLiveEmpty"><Camera/><b>Waiting for rear camera</b></div>}
    {showMap&&<div className={'rearCutMap fade-'+String(fadeHeight).toLowerCase()}>
      <div className="cutZone crown"><span>CROWN</span><b>{topLength} mm</b></div>
      <div className="cutZone blend"><span>BLEND BAND</span><b>{sideLength}–{blendMax} mm</b></div>
      <div className="cutZone lower"><span>LOWER BACK</span><b>{sideLength} mm</b></div>
      <div className="cutZone nape"><span>NECKLINE</span><b>PROTECTED EDGE</b></div>
      <div className="earGuard left">NO-CUT</div>
      <div className="earGuard right">NO-CUT</div>
      <div className="mapCrosshair"><Target size={18}/></div>
    </div>}
    <div className="phoneLiveBadge"><Wifi size={13}/><span>{usingWebRTC?'WEBRTC LIVE':state==='negotiating'?'CONNECTING':'SNAPSHOT FALLBACK'}</span></div>
  </div>
}
