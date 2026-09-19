import { createClient } from '@supabase/supabase-js';
export const config={api:{bodyParser:false}};
const supa=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
async function raw(req){const chunks=[];for await(const chunk of req)chunks.push(chunk);return Buffer.concat(chunks)}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.TRIMSYNC_CAMERA_DEVICE_KEY||req.headers['x-trimsync-device-key']!==process.env.TRIMSYNC_CAMERA_DEVICE_KEY)return res.status(401).json({error:'Unauthorized camera'});
 const device=String(req.headers['x-trimsync-device-id']||'camera-01').replace(/[^a-zA-Z0-9_-]/g,'');const seq=Number(req.headers['x-trimsync-frame-seq']||Date.now());
 try{const jpeg=await raw(req);if(!jpeg.length)return res.status(400).json({error:'Empty frame'});const path=`${device}/latest.jpg`;const db=supa();const up=await db.storage.from('camera-frames').upload(path,jpeg,{contentType:'image/jpeg',upsert:true,cacheControl:'0'});if(up.error)throw up.error;const now=new Date().toISOString();const st=await db.from('camera_status').upsert({device_id:device,online:true,frame_seq:seq,latest_path:path,latest_frame_at:now,updated_at:now});if(st.error)throw st.error;return res.status(200).json({ok:true,device,frame_seq:seq})}catch(e){return res.status(500).json({error:e.message||'Upload failed'})}
}