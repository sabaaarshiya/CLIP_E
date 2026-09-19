import crypto from 'crypto';

function secret(){
  const s=process.env.TRIMSYNC_CAMERA_DEVICE_KEY;
  if(!s)throw new Error('Phone camera signing secret is not configured');
  return s;
}
function sign(payload){return crypto.createHmac('sha256',secret()).update(payload).digest('base64url')}

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try{
    const exp=Date.now()+15*60*1000;
    const payload='phone-back-01.'+exp;
    const token=Buffer.from(payload).toString('base64url')+'.'+sign(payload);
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,token,expires_at:exp,device_id:'phone-back-01'});
  }catch(e){return res.status(500).json({error:e?.message||'Token creation failed'})}
}
