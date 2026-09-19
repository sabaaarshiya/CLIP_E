import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

const MODEL='gemini-3.1-flash-image';

function parseDataUrl(value,label){
  const m=/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s.exec(value||'');
  if(!m)throw Object.assign(new Error(`${label} is not a supported image data URL`),{code:'INVALID_DATA_URL'});
  const cleaned=m[2].replace(/\s/g,'');
  const bytes=Buffer.from(cleaned,'base64');
  if(!bytes?.length)throw Object.assign(new Error(`${label} could not be decoded from base64`),{code:'INVALID_BASE64'});
  return bytes;
}

async function normalizeForGemini(bytes,label){
  try{
    const image=sharp(bytes,{failOn:'error'});
    const meta=await image.metadata();
    if(!meta.width||!meta.height)throw new Error('missing dimensions');
    const out=await image
      .rotate()
      .resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true})
      .flatten({background:'#ffffff'})
      .jpeg({quality:90,chromaSubsampling:'4:4:4'})
      .toBuffer();
    return{mime:'image/jpeg',data:out.toString('base64'),bytes:out.length,width:meta.width,height:meta.height};
  }catch(err){
    throw Object.assign(new Error(`${label} could not be decoded before sending to Gemini: ${err.message}`),{code:'SERVER_IMAGE_DECODE_FAILED'});
  }
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

    const source=await normalizeForGemini(parseDataUrl(baseImage,'Source photo'),'Source photo');
    const reference=referenceImage
      ? await normalizeForGemini(parseDataUrl(referenceImage,'Hairstyle reference'),'Hairstyle reference')
      : null;

    const prompt=`Create a photorealistic virtual hairstyle try-on using the FIRST image as the person to preserve and the SECOND image only as the hairstyle reference. Keep the person's identity, face, facial features, skin tone, expression, body, clothing, pose, camera angle, lighting, and background unchanged. Change only the hair. Recreate the hairstyle from the reference image naturally on the source person's head, preserving the source person's head shape and natural hairline. Selected hairstyle: ${style||'selected hairstyle'}. Settings: top length ${settings.topLength??'default'} mm, side length ${settings.sideLength??'default'} mm, fade height ${settings.fadeHeight??'default'}, texture ${settings.texture??'default'}, finish ${settings.finish??'default'}.`;

    const input=[
      {type:'text',text:prompt},
      {type:'image',mime_type:source.mime,data:source.data},
      ...(reference?[{type:'image',mime_type:reference.mime,data:reference.data}]:[])
    ];

    const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
    const interaction=await ai.interactions.create({
      model:MODEL,
      input
    });

    const image=findOutputImage(interaction);
    if(!image?.data){
      const text=interaction?.output_text||interaction?.steps?.flatMap(s=>s?.content||[]).find(b=>b?.type==='text')?.text||'';
      throw Object.assign(new Error(text||'Gemini returned no preview image'),{code:'NO_IMAGE_OUTPUT'});
    }

    return res.status(200).json({
      image:`data:${image.mime_type||'image/png'};base64,${image.data}`,
      meta:{
        model:MODEL,
        sourceBytes:source.bytes,
        referenceBytes:reference?.bytes||0,
        sourceSize:`${source.width}x${source.height}`,
        referenceSize:reference?`${reference.width}x${reference.height}`:null,
        durationMs:Date.now()-started
      }
    });
  }catch(e){
    const status=Number(e?.status)===429||Number(e?.code)===429?429:500;
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
