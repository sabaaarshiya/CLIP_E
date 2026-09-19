const MODEL=process.env.GEMINI_VISION_MODEL||'gemini-3.8-flash';

const schema={
  type:'object',
  properties:{
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
  required:['hairPattern','primaryType','secondaryType','patternExplanation','coarseness','density','currentLength','volume','definition','growthPattern','crownBehavior','frizzFlyaways','symmetry','currentCutShape','necklineCondition','sideGrowth','backGrowth','regionalPatterns','observableLimits','styleSignals','confidence']
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
    const {images=[],faceGeometry=null}=req.body||{};
    const usable=(images||[]).filter(Boolean).slice(0,4);
    if(!usable.length)return res.status(400).json({error:'No scan images were provided'});

    const parts=usable.map((img,i)=>({inlineData:parseDataUrl(img,`Scan view ${i+1}`)}));
    parts.push({text:`You are the visual hair-analysis module for Clip-E, a robotic grooming prototype. Analyze ONLY characteristics that are reasonably visible in the supplied scan images. The images may include front, left, right, and back views.

Return a careful grooming-oriented hair profile. Do not diagnose health conditions and do not infer exact porosity, scalp health, medical hair loss, ethnicity, or any hidden characteristic. If an attribute cannot be determined visually, explicitly use "Needs user input" or "Unable to determine from scan".

For hair pattern, use Straight / Wavy / Curly / Coily, and when image quality supports it use the common 1A–4C notation. Hair can be mixed. If mixed, identify primary and secondary patterns and where they appear. Describe visible regional differences such as crown, sides, and back. Base every explanation on visible evidence such as S-waves, ringlets, coil tightness, lay, volume, density appearance, cut shape, neckline, side/back growth, symmetry, and clearly visible flyaways.

Approximate coarseness only when visually supportable; otherwise say Needs user input. For current length, use a practical visual description rather than fabricated millimeters.

Supporting local face/head geometry:
${JSON.stringify(faceGeometry||{})}

The result will drive hairstyle recommendations and the cut-map explanation, so make styleSignals useful but conservative.`});

    const g=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,{
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

    const out=await g.json();
    if(!g.ok)throw new Error(out?.error?.message||'Gemini hair analysis request failed');
    const raw=out?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
    if(!raw)throw new Error('Gemini returned no hair analysis');
    let parsed;
    try{parsed=JSON.parse(raw)}catch{throw new Error('Gemini returned invalid structured hair-analysis JSON')}
    return res.status(200).json({analysis:parsed,model:MODEL});
  }catch(e){
    console.error('Clip-E hair analysis error',e);
    return res.status(500).json({error:e?.message||'Hair analysis failed'});
  }
}
