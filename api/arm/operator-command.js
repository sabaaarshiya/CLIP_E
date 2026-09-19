import { getDb } from '../../lib/db.js';

const allowed=new Set(['approach_nudge','hold','retreat']);

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const expected=process.env.TRIMSYNC_OPERATOR_KEY||process.env.TRIMSYNC_ARM_DEVICE_KEY;
  const supplied=req.headers['x-trimsync-operator-key'];
  if(!expected||supplied!==expected)return res.status(401).json({error:'Invalid operator key'});

  const command=String(req.body?.command||'');
  if(!allowed.has(command))return res.status(400).json({error:'Command not allowed from browser'});

  let args=req.body?.args||{};
  if(command==='approach_nudge'){
    const forward=Number(args.forward);
    if(!Number.isFinite(forward))return res.status(400).json({error:'Missing forward value'});
    args={forward:Math.max(-0.20,Math.min(0.20,forward))};
  }else{
    args={};
  }

  try{
    const db=getDb();
    const q=await db.query(
      `insert into arm_commands(device_id,command,args,state)
       values('arm-01',$1,$2::jsonb,'pending')
       returning id,command,args,created_at`,
      [command,JSON.stringify(args)]
    );
    return res.status(200).json({ok:true,queued:q.rows[0]});
  }catch(e){
    console.error('operator arm command failed',e);
    return res.status(500).json({error:e?.message||'Could not queue arm command'});
  }
}
