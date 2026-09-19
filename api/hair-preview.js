const MODEL='gemini-3.1-flash-image';
function parseDataUrl(s){const m=/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(s||'');if(!m)throw new Error('Invalid image');return{mime:m[1],data:m[2]}}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.GEMINI_API_KEY)return res.status(503).json({error:'GEMINI_API_KEY is not configured'});
 try{
  const {baseImage,style,referenceImage,settings={}}=req.body||{};const base=parseDataUrl(baseImage);
  const input=[{type:'text',text:`Create a virtual hairstyle preview. IMAGE 1 is the source photo and IMAGE 2 is the hairstyle reference. Apply the hairstyle shown in IMAGE 2 to the subject in IMAGE 1. Keep the source photograph consistent and modify the hair for the hairstyle preview. Adapt the hairstyle naturally to the head position, lighting, perspective, and visible hairline of IMAGE 1. Use IMAGE 2 only as the visual hairstyle reference; do not substitute the reference subject. Selected hairstyle: ${style}. Customization: top length ${settings.topLength} mm; side length ${settings.sideLength} mm; fade height ${settings.fadeHeight}; texture ${settings.texture}; finish ${settings.finish}.`},{type:'image',mime_type:base.mime,data:base.data}];
  if(referenceImage){const ref=parseDataUrl(referenceImage);input.push({type:'image',mime_type:ref.mime,data:ref.data})}
  const g=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,input,response_format:{type:'image'}})});
  const out=await g.json();if(!g.ok)throw new Error(out?.error?.message||'Gemini request failed');
  let img=out.output_image; if(!img)for(const st of out.steps||[])for(const b of st.content||[])if(b.type==='image')img=b;
  if(!img?.data)throw new Error('No image returned');return res.status(200).json({image:`data:${img.mime_type||'image/png'};base64,${img.data}`});
 }catch(e){return res.status(500).json({error:e.message||'Preview failed'})}
}