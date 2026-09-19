import { getDb } from '../../lib/db.js';

function key(v){
  return String(v||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
}

export default async function handler(req,res){
  const session=key(req.method==='GET'?req.query.session:req.body?.session);
  if(!session)return res.status(400).json({error:'Missing session'});

  try{
    const db=getDb();

    if(req.method==='GET'){
      const q=await db.query(
        `select offer,answer,updated_at from camera_signaling where session_key=$1 limit 1`,
        [session]
      );
      res.setHeader('Cache-Control','no-store');
      if(!q.rowCount)return res.status(200).json({session,offer:null,answer:null});
      return res.status(200).json({session,...q.rows[0]});
    }

    if(req.method==='POST'){
      const type=String(req.body?.type||'');
      const sdp=req.body?.sdp;
      if(!['offer','answer'].includes(type)||!sdp?.type||!sdp?.sdp){
        return res.status(400).json({error:'Expected type=offer|answer and RTCSessionDescription'});
      }

      if(type==='offer'){
        await db.query(
          `insert into camera_signaling(session_key,offer,answer,updated_at)
           values($1,$2::jsonb,null,now())
           on conflict(session_key) do update
           set offer=excluded.offer,answer=null,updated_at=now()`,
          [session,JSON.stringify(sdp)]
        );
      }else{
        await db.query(
          `insert into camera_signaling(session_key,answer,updated_at)
           values($1,$2::jsonb,now())
           on conflict(session_key) do update
           set answer=excluded.answer,updated_at=now()`,
          [session,JSON.stringify(sdp)]
        );
      }
      return res.status(200).json({ok:true,session,type});
    }

    if(req.method==='DELETE'){
      await db.query('delete from camera_signaling where session_key=$1',[session]);
      return res.status(200).json({ok:true});
    }

    return res.status(405).json({error:'Method not allowed'});
  }catch(e){
    console.error('camera signaling failed',e);
    return res.status(500).json({error:e?.message||'Signaling failed'});
  }
}
