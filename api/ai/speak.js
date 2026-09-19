export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).end();

  const apiKey=String(process.env.ELEVENLABS_API_KEY||'').trim();
  const voiceId=String(process.env.ELEVENLABS_VOICE_ID||'').trim();

  if(!apiKey)return res.status(503).json({error:'ElevenLabs API key is not configured'});
  if(!voiceId)return res.status(503).json({error:'ElevenLabs voice ID is not configured'});

  const {text}=req.body||{};
  if(!text)return res.status(400).json({error:'Missing text'});

  try{
    const r=await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method:'POST',
        headers:{
          'xi-api-key':apiKey,
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          text,
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
    return res.status(200).end(audio);
  }catch(e){
    return res.status(500).json({error:e.message});
  }
}
