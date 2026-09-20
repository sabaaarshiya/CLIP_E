const PRIMARY_MODEL=process.env.GEMINI_VISION_MODEL||'gemini-3.8-flash';
const MODEL_CANDIDATES=[...new Set([
  PRIMARY_MODEL,
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash'
].filter(Boolean))];

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

function localFallbackProfile(faceGeometry){
  const shape=faceGeometry?.shape||'Unable to determine from scan';
  const proportion=faceGeometry?.proportion||'Unable to determine from scan';
  const jawline=faceGeometry?.jaw||'Unable to determine from scan';
  const cheekbones=faceGeometry?.cheekbones||'Unable to determine from scan';
  const geometryAvailable=!!(faceGeometry&&Object.keys(faceGeometry).length);
  return{
    faceProfile:{
      shape,
      proportion,
      jawline,
      cheekbones,
      forehead:faceGeometry?.foreheadRatio?('Measured forehead ratio '+faceGeometry.foreheadRatio):'Unable to determine from scan',
      profileNotes:geometryAvailable?'Profile generated from the real front-scan MediaPipe geometry because Gemini quota was unavailable. Hair-specific traits remain unassigned rather than guessed.':'Gemini quota was unavailable and local face geometry was not available.',
      confidence:geometryAvailable?'Medium':'Low'
    },
    hairPattern:'Unable to determine from scan',
    primaryType:'Unable to determine from scan',
    secondaryType:'Unable to determine from scan',
    patternExplanation:'Gemini visual analysis was unavailable because the API quota was exhausted. Clip-E did not guess a hair pattern.',
    coarseness:'Unable to determine from scan',
    density:'Unable to determine from scan',
    currentLength:'Unable to determine from scan',
    volume:'Unable to determine from scan',
    definition:'Unable to determine from scan',
    growthPattern:'Unable to determine from scan',
    crownBehavior:'Unable to determine from scan',
    frizzFlyaways:'Unable to determine from scan',
    symmetry:faceGeometry?.ratio?'Front facial geometry measured locally; hair symmetry was not inferred.':'Unable to determine from scan',
    currentCutShape:'Unable to determine from scan',
    necklineCondition:'Unable to determine from scan',
    sideGrowth:'Unable to determine from scan',
    backGrowth:'Unable to determine from scan',
    regionalPatterns:[
      {region:'Front',pattern:'Local geometry available',observation:geometryAvailable?'Face/head geometry was measured from the real front scan.':'Local geometry unavailable.'},
      {region:'Left',pattern:'Captured',observation:'Image captured and preserved; visual hair interpretation deferred while Gemini quota is unavailable.'},
      {region:'Right',pattern:'Captured',observation:'Image captured and preserved; visual hair interpretation deferred while Gemini quota is unavailable.'},
      {region:'Back',pattern:'Captured',observation:'Image captured and preserved; visual hair interpretation deferred while Gemini quota is unavailable.'}
    ],
    observableLimits:[
      'Gemini visual quota unavailable during this run',
      'Hair pattern, density, coarseness, and growth behavior were not guessed'
    ],
    styleSignals:{
      lengthCategory:'Unable to determine',
      maintenanceTolerance:'Unknown',
      compatiblePatterns:[],
      usefulAssistanceAreas:[]
    },
    confidence:{
      overall:geometryAvailable?'Medium':'Low',
      notes:'Fallback uses real scan geometry only. Unknown hair traits remain explicitly unknown.'
    }
  };
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const GEMINI_KEYS=[...new Set([
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2
  ].filter(Boolean))];
  if(!GEMINI_KEYS.length)return res.status(503).json({error:'No Gemini API key is configured'});
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

    let g=null,out=null,lastMessage='',usedModel='',usedKeySlot=0;
    const failures=[];
    outer:
    for(let keyIndex=0;keyIndex<GEMINI_KEYS.length;keyIndex++){
      const apiKey=GEMINI_KEYS[keyIndex];
      for(const model of MODEL_CANDIDATES){
        for(let attempt=0;attempt<2;attempt++){
          g=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,{
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
          if(g.ok){
            usedModel=model;
            usedKeySlot=keyIndex+1;
            break outer;
          }

          lastMessage=out?.error?.message||`Gemini profile analysis failed with status ${g.status}`;
          failures.push({keySlot:keyIndex+1,model,status:g.status,message:lastMessage});

          // Bad/unsupported model: try next model on the same key.
          if([400,404].includes(g.status))break;

          // Auth/permission issue: stop using this key and move to the next key.
          if([401,403].includes(g.status))break;

          // Quota/server errors: retry once, then continue through models/keys.
          if(![429,500,502,503,504].includes(g.status))break;
          if(attempt===0)await new Promise(resolve=>setTimeout(resolve,450));
        }

        // If this key itself is unauthorized/forbidden, skip its remaining models.
        if([401,403].includes(g?.status))break;
      }
    }

    if(!g?.ok){
      const quotaLike=failures.some(f=>f.status===429||/quota|free_tier|rate limit/i.test(f.message||''));
      if(quotaLike){
        const fallback=localFallbackProfile(faceGeometry);
        return res.status(200).json({
          analysis:fallback,
          model:'local-mediapipe-fallback',
          fallback:true,
          fallbackReason:'Gemini quota unavailable',
          viewsUsed:4,
          viewLabels:['Front','Left','Right','Back'],
          geminiFailures:failures.map(f=>({keySlot:f.keySlot,model:f.model,status:f.status}))
        });
      }
      throw new Error(lastMessage||'Gemini profile analysis request failed');
    }

    const raw=out?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
    if(!raw)throw new Error('Gemini returned no hair analysis');
    let parsed;
    try{parsed=JSON.parse(raw)}catch{throw new Error('Gemini returned invalid structured hair-analysis JSON')}
    return res.status(200).json({analysis:parsed,model:usedModel,keySlot:usedKeySlot,viewsUsed:4,viewLabels:['Front','Left','Right','Back']});
  }catch(e){
    console.error('Clip-E hair analysis error',e);
    const message=e?.message||'Profile analysis failed';
    const retryable=/high demand|overload|temporar|429|503|quota/i.test(message);
    return res.status(retryable?503:500).json({error:message,retryable});
  }
}
