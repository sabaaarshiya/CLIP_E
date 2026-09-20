export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  // Live Chat voice is intentionally server-controlled.
  // The browser never chooses a voice ID: production always uses the
  // ELEVENLABS_VOICE_ID configured in the Vercel environment.
  const apiKey=String(process.env.ELEVENLABS_API_KEY||'').trim();
  const voiceId=String(process.env.ELEVENLABS_VOICE_ID||'').trim();

  if(!apiKey)return res.status(503).json({error:'ELEVENLABS_API_KEY is not configured in Vercel'});
  if(!voiceId)return res.status(503).json({error:'ELEVENLABS_VOICE_ID is not configured in Vercel'});

  const {text}=req.body||{};
  if(!String(text||'').trim())return res.status(400).json({error:'Missing text'});

  try{
    const r=await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method:'POST',
        headers:{
          'xi-api-key':apiKey,
          'Content-Type':'application/json',
          'Accept':'audio/mpeg'
        },
        body:JSON.stringify({
          text:String(text).trim(),
          model_id:'eleven_flash_v2_5'
        })
      }
    );

    if(!r.ok){
      const detail=await r.text();
      throw Error(detail||'Speech request failed');
    }

    const audio=Buffer.from(await r.arrayBuffer());
    if(!audio.length)throw Error('ElevenLabs returned empty audio');

    res.setHeader('Content-Type','audio/mpeg');
    res.setHeader('Content-Length',String(audio.length));
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Clip-E-Voice-Source','vercel-env');
    return res.status(200).end(audio);
  }catch(e){
    console.error('Clip-E ElevenLabs speech failed',e);
    return res.status(500).json({error:e?.message||'Speech request failed'});
  }
}
