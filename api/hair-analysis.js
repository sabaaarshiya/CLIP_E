const MODEL=process.env.GEMINI_VISION_MODEL||'gemini-3.8-flash';

const schema={
  type:'object',
  properties:{
    faceProfile:{type:'object',properties:{
      shape:{type:'string',enum:['Oval','Round','Square','Heart','Diamond','Oblong / Rectangle','Unable to determine from scan']},
      proportion:{type:'string'},
      jawline:{type:'string'},
      cheekbones:{type:'string'},
      forehead:{type:'string'},
      profileNotes:{type:'string'},
      confidence:{type:'string',enum:['Low','Medium','High']}
    },required:['shape','proportion','jawline','cheekbones','forehead','profileNotes','confidence']},
    hairPattern:{type:'string',enum:['Straight','Wavy','Curly','Coily','Unable to determine from scan']},
    primaryType:{type:'string'},
    secondaryType:{type:'string'},
    patternExplanation:{type:'string'},
    coarseness:{type:'string',enum:['Fine','Medium','Coarse','Needs user input','Unable to determine from scan']},
    density:{type:'string',enum:['Low','Medium','High','Unable to determine from scan']},
    currentLength:{type:'string'},
    volume:{type:'string'},
    definition:{type:'string'},
    growthPattern:{type:'string'},
    crownBehavior:{type:'string'},
    frizzFlyaways:{type:'string'},
    symmetry:{type:'string'},
    currentCutShape:{type:'string'},
    necklineCondition:{type:'string'},
    sideGrowth:{type:'string'},
    backGrowth:{type:'string'},
    regionalPatterns:{type:'array',items:{type:'object',properties:{region:{type:'string'},pattern:{type:'string'},observation:{type:'string'}},required:['region','pattern','observation']}},
    observableLimits:{type:'array',items:{type:'string'}},
    styleSignals:{type:'object',properties:{
      lengthCategory:{type:'string',enum:['Short','Medium','Long','Unable to determine']},
      maintenanceTolerance:{type:'string',enum:['Low','Medium','High','Unknown']},
      compatiblePatterns:{type:'array',items:{type:'string'}},
      usefulAssistanceAreas:{type:'array',items:{type:'string'}}
    },required:['lengthCategory','maintenanceTolerance','compatiblePatterns','usefulAssistanceAreas']},
    confidence:{type:'object',properties:{overall:{type:'string',enum:['Low','Medium','High']},notes:{type:'string'}},required:['overall','notes']}
  },
  required:['faceProfile','hairPattern','primaryType','secondaryType','patternExplanation','coarseness','density','currentLength','volume','definition','growthPattern','crownBehavior','frizzFlyaways','symmetry','currentCutShape','necklineCondition','sideGrowth','backGrowth','regionalPatterns','observableLimits','styleSignals','confidence']
};

function parseDataUrl(value,label){
  const m=/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/s.exec(value||'');
  if(!m)throw new Error(`${label} is not a supported image`);
  const data=m[2].replace(/\s/g,'');
  if(data.length<100)throw new Error(`${label} is empty`);
  return{mimeType:m[1]==='image/jpg'?'image/jpeg':m[1],data};
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!process.env.GEMINI_API_KEY)return res.status(503).json({error:'GEMINI_API_KEY is not configured'});
  try{
    const {images=[],viewLabels=[],faceGeometry=null}=req.body||{};
    const usable=(images||[]).slice(0,4);
    if(usable.length<4||usable.some(x=>!x))return res.status(400).json({error:'Front, Left, Right, and Back scan images are all required before profile analysis'});
    const labels=['FRONT','LEFT','RIGHT','BACK'];
    const parts=usable.flatMap((img,i)=>[
      {text:`SCAN VIEW ${i+1}: ${String(viewLabels?.[i]||labels[i]).toUpperCase()}`},
      {inlineData:parseDataUrl(img,`Scan view ${i+1} (${labels[i]})`)}
    ]);
    parts.push({text:`You are the visual profile-analysis module for Clip-E, a robotic grooming prototype. You are receiving exactly four real scan images in this order: FRONT, LEFT, RIGHT, BACK. Analyze ALL FOUR together. Do not ignore a view and do not invent information that is not visible.

Return one careful grooming-oriented FACE + HAIR profile. Do not diagnose health conditions and do not infer exact porosity, scalp health, medical hair loss, ethnicity, or any hidden characteristic. If an attribute cannot be determined visually, explicitly use "Needs user input" or "Unable to determine from scan".

For hair pattern, use Straight / Wavy / Curly / Coily, and when image quality supports it use the common 1A–4C notation. Hair can be mixed. If mixed, identify primary and secondary patterns and where they appear. Describe visible regional differences such as crown, sides, and back. Base every explanation on visible evidence such as S-waves, ringlets, coil tightness, lay, volume, density appearance, cut shape, neckline, side/back growth, symmetry, and clearly visible flyaways.

Approximate coarseness only when visually supportable; otherwise say Needs user input. For current length, use a practical visual description rather than fabricated millimeters.

Supporting local MediaPipe face/head geometry from the real FRONT scan:
${JSON.stringify(faceGeometry||{})}

Use that geometry as quantitative support for faceProfile. Do not randomly assign a face shape. If the images and geometry do not support a clear shape, return "Unable to determine from scan". Compare the LEFT and RIGHT views when describing symmetry/proportions and use the BACK view for crown, rear growth, neckline, and rear density/texture observations.

The result will drive a deterministic hairstyle-matching system across Clip-E's existing 100 styles, so make styleSignals useful but conservative and evidence-based.`});

    let g=null,out=null,lastMessage='';
    for(let attempt=0;attempt<3;attempt++){
      g=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          contents:[{role:'user',parts}],
          generationConfig:{
            responseMimeType:'application/json',
            responseSchema:schema
          }
        })
      });
      out=await g.json().catch(()=>({}));
      if(g.ok)break;
      lastMessage=out?.error?.message||`Gemini profile analysis failed with status ${g.status}`;
      if(![429,500,502,503,504].includes(g.status)||attempt===2)break;
      await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)));
    }
    if(!g?.ok)throw new Error(lastMessage||'Gemini profile analysis request failed');
    const raw=out?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
    if(!raw)throw new Error('Gemini returned no hair analysis');
    let parsed;
    try{parsed=JSON.parse(raw)}catch{throw new Error('Gemini returned invalid structured hair-analysis JSON')}
    return res.status(200).json({analysis:parsed,model:MODEL,viewsUsed:4,viewLabels:['Front','Left','Right','Back']});
  }catch(e){
    console.error('Clip-E hair analysis error',e);
    const message=e?.message||'Profile analysis failed';
    const retryable=/high demand|overload|temporar|429|503|quota/i.test(message);
    return res.status(retryable?503:500).json({error:message,retryable});
  }
}
