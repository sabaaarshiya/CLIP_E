const MODEL='gemini-3.1-flash-image';
function parseDataUrl(s){const m=/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s.exec(s||'');if(!m)throw new Error('Invalid image data');return{mime:m[1],data:m[2].replace(/\s/g,'')}}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.GEMINI_API_KEY)return res.status(503).json({error:'GEMINI_API_KEY is not configured'});
 try{
  const {baseImage,style,referenceImage,settings={}}=req.body||{};const base=parseDataUrl(baseImage);const ref=referenceImage?parseDataUrl(referenceImage):null;
  const input=[
   {type:'text',text:`Create a virtual hairstyle preview. The first image is the source photo and the second image is the hairstyle reference. Apply the referenced hairstyle to the subject in the source photo while keeping the source photograph consistent. Adapt the hair naturally to the head position, lighting and perspective. Selected hairstyle: ${style}. Top length ${settings.topLength} mm; side length ${settings.sideLength} mm; fade height ${settings.fadeHeight}; texture ${settings.texture}; finish ${settings.finish}.`},
   {type:'image',mime_type:base.mime,data:base.data}
  ];
  if(ref)input.push({type:'image',mime_type:ref.mime,data:ref.data});
  const g=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,input})});
  const out=await g.json();if(!g.ok)throw new Error(out?.error?.message||'Gemini request failed');
  let img=out.output_image;
  if(!img)for(const step of out.steps||[])for(const block of step.content||[])if(block.type==='image'&&!block.thought)img=block;
  if(!img?.data)throw new Error('Gemini returned no preview image');
  return res.status(200).json({image:`data:${img.mime_type||'image/jpeg'};base64,${img.data}`});
 }catch(e){console.error('Clip-E preview error',e);return res.status(500).json({error:e.message||'Preview failed'})}
}