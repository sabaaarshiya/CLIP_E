import crypto from 'crypto';
import { put } from '@vercel/blob';
import { cleanDeviceId,getDb } from '../../lib/db.js';

export const config={api:{bodyParser:false}};

async function raw(req){const chunks=[];for await(const chunk of req)chunks.push(chunk);return Buffer.concat(chunks)}
function verify(token){
  const secret=process.env.TRIMSYNC_CAMERA_DEVICE_KEY;
  if(!secret||!token)return false;
  const [enc,sig]=String(token).split('.');
  if(!enc||!sig)return false;
  let payload;try{payload=Buffer.from(enc,'base64url').toString('utf8')}catch{return false}
  const expected=crypto.createHmac('sha256',secret).update(payload).digest('base64url');
  if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;
  const [device,exp]=payload.split('.');
  return device==='phone-back-01'&&Number(exp)>Date.now();
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!verify(req.headers['x-trimsync-phone-token']))return res.status(401).json({error:'Invalid or expired phone camera token'});
  try{
    const device=cleanDeviceId(req.headers['x-trimsync-device-id'],'phone-back-01');
    if(device!=='phone-back-01')return res.status(400).json({error:'Invalid phone camera device'});
    const seq=Number(req.headers['x-trimsync-frame-seq']||Date.now());
    const sessionId=cleanDeviceId(req.headers['x-trimsync-session-id'],'demo');
    const jpeg=await raw(req);
    if(!jpeg.length)return res.status(400).json({error:'Empty frame'});

    const started=Date.now();
    const blob=await put(`trimsync/${device}/${sessionId}/latest.jpg`,jpeg,{
      access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'image/jpeg'
    });
    const uploadMs=Date.now()-started;
    const db=getDb();
    await db.query('BEGIN');
    try{
      await db.query(
        `insert into device_state(device_id,device_type,online,last_seen,payload)
         values($1,'camera',true,now(),$2::jsonb)
         on conflict(device_id) do update set online=true,last_seen=now(),payload=excluded.payload`,
        [device,JSON.stringify({frame_seq:seq,image_url:blob.url,role:'back_head',session_id:sessionId})]
      );
      await db.query(
        `insert into camera_telemetry(device_id,frame_seq,upload_ms,image_url,width,height,payload)
         values($1,$2,$3,$4,640,480,$5::jsonb)`,
        [device,seq,uploadMs,blob.url,JSON.stringify({bytes:jpeg.length,role:'back_head',session_id:sessionId})]
      );
      await db.query('COMMIT');
    }catch(e){await db.query('ROLLBACK');throw e}
    return res.status(200).json({ok:true,device,frame_seq:seq,upload_ms:uploadMs});
  }catch(e){console.error('phone camera upload failed',e);return res.status(500).json({error:e?.message||'Phone camera upload failed'})}
}
