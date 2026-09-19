import { GoogleGenAI } from '@google/genai';

const MODEL='gemini-3.1-flash-image';

function detectMime(buf){
  if(buf.length>=3&&buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff)return'image/jpeg';
  if(buf.length>=8&&buf[0]===0x89&&buf[1]===0x50&&buf[2]===0x4e&&buf[3]===0x47)return'image/png';
  if(buf.length>=12&&buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP')return'image/webp';
  return null;
}

function parseImageDataUrl(value,label){
  const m=/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s.exec(value||'');
  if(!m)throw Object.assign(new Error(`${label} is not a supported image data URL`),{code:'INVALID_DATA_URL'});
  const cleaned=m[2].replace(/\s/g,'');
  let bytes;
  try{bytes=Buffer.from(cleaned,'base64')}catch{throw Object.assign(new Error(`${label} base64 could not be decoded`),{code:'INVALID_BASE64'})}
  if(!bytes||bytes.length<128)throw Object.assign(new Error(`${label} image payload is empty or too small`),{code:'EMPTY_IMAGE'});
  const detected=detectMime(bytes);
  if(!detected)throw Object.assign(new Error(`${label} bytes are not a valid JPEG, PNG, or WebP image`),{code:'BAD_IMAGE_BYTES'});
  return{mime:detected,data:bytes.toString('base64'),bytes:bytes.length,declared:m[1]};
}

function findOutputImage(interaction){
  if(interaction?.output_image?.data)return interaction.output_image;
  for(const step of interaction?.steps||[]){
    if(step?.type!=='model_output')continue;
    for(const block of step?.content||[]){
      if(block?.type==='image'&&block?.data)return block;
    }
  }
  return null;
}

export default async function handler(req,res){
  if(req.method==='GET')return res.status(200).json({ok:true,model:MODEL,apiKeyConfigured:!!process.env.GEMINI_API_KEY});
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!process.env.GEMINI_API_KEY)return res.status(503).json({error:'GEMINI_API_KEY is not configured',code:'NO_API_KEY'});

  const started=Date.now();
  try{
    const {baseImage,style,referenceImage,settings={}}=req.body||{};
    const source=parseImageDataUrl(baseImage,'Source photo');
    const reference=referenceImage?parseImageDataUrl(referenceImage,'Hairstyle reference'):null;

    const prompt=`Edit the FIRST image only. Keep the person's identity, face, skin tone, facial expression, body, clothing, pose, camera angle, lighting, and background unchanged. Change only the hair so it realistically matches the hairstyle shown in the SECOND image. This is a virtual hairstyle try-on, similar to a professional salon preview. Preserve the person's natural hairline and head shape, adapt the selected haircut naturally to their head, and make the result photorealistic. Selected hairstyle: ${style||'selected hairstyle'}. Requested settings: top length ${settings.topLength??'default'} mm, side length ${settings.sideLength??'default'} mm, fade height ${settings.fadeHeight??'default'}, texture ${settings.texture??'default'}, finish ${settings.finish??'default'}.`;

    const input=[
      {type:'image',mime_type:source.mime,data:source.data},
      ...(reference?[{type:'image',mime_type:reference.mime,data:reference.data}]:[]),
      {type:'text',text:prompt}
    ];

    const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
    const interaction=await ai.interactions.create({
      model:MODEL,
      input,
      response_format:{type:'image',mime_type:'image/jpeg'}
    });

    const image=findOutputImage(interaction);
    if(!image?.data){
      const text=interaction?.output_text||interaction?.steps?.flatMap(s=>s?.content||[]).find(b=>b?.type==='text')?.text||'';
      throw Object.assign(new Error(text||'Gemini returned no preview image'),{code:'NO_IMAGE_OUTPUT'});
    }

    return res.status(200).json({
      image:`data:${image.mime_type||'image/jpeg'};base64,${image.data}`,
      meta:{model:MODEL,sourceBytes:source.bytes,referenceBytes:reference?.bytes||0,durationMs:Date.now()-started}
    });
  }catch(e){
    const status=Number(e?.status)||Number(e?.code)===429?429:500;
    const message=e?.message||'Preview failed';
    console.error('Clip-E hairstyle preview failed',{
      message,
      code:e?.code||null,
      status:e?.status||null,
      details:e?.details||null,
      durationMs:Date.now()-started
    });
    return res.status(status).json({
      error:message,
      code:e?.code||'PREVIEW_FAILED',
      durationMs:Date.now()-started
    });
  }
}
