const MODEL='gemini-3.1-flash-image';
function parseDataUrl(s){const m=/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(s||'');if(!m)throw new Error('Invalid image');return{mime:m[1],data:m[2]}}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.GEMINI_API_KEY)return res.status(503).json({error:'GEMINI_API_KEY is not configured'});
 try{
  const {baseImage,style,referenceImage,settings={}}=req.body||{};const base=parseDataUrl(baseImage);const ref=referenceImage?parseDataUrl(referenceImage):null;
  const prompt=`Create a virtual hairstyle preview. The FIRST image is the source photo. The SECOND image is the hairstyle reference. Apply the hairstyle from the second image to the subject in the first image while keeping the source photograph consistent. Modify the hair for the hairstyle preview and adapt it naturally to the head position, lighting and perspective. Use the second image only as the hairstyle reference. Selected hairstyle: ${style}. Top length: ${settings.topLength} mm. Side length: ${settings.sideLength} mm. Fade height: ${settings.fadeHeight}. Texture: ${settings.texture}. Finish: ${settings.finish}.`;
  const parts=[{text:prompt},{inline_data:{mime_type:base.mime,data:base.data}}];if(ref)parts.push({inline_data:{mime_type:ref.mime,data:ref.data}});
  const g=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:'POST',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseModalities:['TEXT','IMAGE']}})});
  const out=await g.json();if(!g.ok)throw new Error(out?.error?.message||'Gemini request failed');
  const returned=out?.candidates?.[0]?.content?.parts||[];const img=returned.find(p=>(p.inlineData||p.inline_data)&&!(p.thought));const data=img?.inlineData||img?.inline_data;
  if(!data?.data){const reason=out?.candidates?.[0]?.finishReason||out?.promptFeedback?.blockReason||returned.find(p=>p.text)?.text||'Gemini returned no preview image';throw new Error(String(reason).slice(0,500))}
  return res.status(200).json({image:`data:${data.mimeType||data.mime_type||'image/png'};base64,${data.data}`});
 }catch(e){console.error('Clip-E preview error',e);return res.status(500).json({error:e.message||'Preview failed'})}
}