import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT=path.resolve(process.cwd());
const OUT=path.join(ROOT,'public','styles');
const BOARDS=[
  path.join(ROOT,'e7aa0b6f-f4b4-4903-8694-16df2601c89b.png'),
  path.join(ROOT,'50 Women’s Hairstyle Variations.png')
];
const COLS=10, ROWS=5, COUNT=50;
const CARD_W=640, CARD_H=800;

function luma(r,g,b){return .2126*r+.7152*g+.0722*b}
function movingMax(arr,r=2){return arr.map((_,i)=>{let m=-Infinity;for(let j=Math.max(0,i-r);j<=Math.min(arr.length-1,i+r);j++)m=Math.max(m,arr[j]);return m})}
function median(arr){const a=[...arr].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]||0}

function edgeScores(data,w,h,channels){
  const xs=new Float64Array(w), ys=new Float64Array(h);
  for(let y=1;y<h;y++){
    let row=0;
    for(let x=1;x<w;x++){
      const i=(y*w+x)*channels, il=(y*w+x-1)*channels, iu=((y-1)*w+x)*channels;
      const p=luma(data[i],data[i+1],data[i+2]);
      const pl=luma(data[il],data[il+1],data[il+2]);
      const pu=luma(data[iu],data[iu+1],data[iu+2]);
      const dx=Math.abs(p-pl),dy=Math.abs(p-pu);
      if(dx>16)xs[x]+=dx;
      if(dy>16)row+=dy;
    }
    ys[y]=row/w;
  }
  for(let x=0;x<w;x++)xs[x]/=h;
  return{xs:Array.from(xs),ys:Array.from(ys)};
}

function localMax(score,pos,r=4){let best=0,bp=pos;for(let i=Math.max(0,Math.round(pos)-r);i<=Math.min(score.length-1,Math.round(pos)+r);i++){if(score[i]>best){best=score[i];bp=i}}return{score:best,pos:bp}}

function findPeriodicLines(score,count,min,max){
  const sm=movingMax(score,2), med=median(sm.slice(Math.floor(min),Math.ceil(max)+1));
  const starts=[],ends=[];
  for(let i=Math.floor(min);i<=Math.floor(min+(max-min)*.30);i++)if(sm[i]>med*1.35)starts.push(i);
  for(let i=Math.floor(min+(max-min)*.70);i<=Math.floor(max);i++)if(sm[i]>med*1.35)ends.push(i);
  starts.sort((a,b)=>sm[b]-sm[a]); ends.sort((a,b)=>sm[b]-sm[a]);
  let best=null;
  for(const a of starts.slice(0,50))for(const b of ends.slice(0,50)){
    if(b<=a)continue;
    const step=(b-a)/(count-1);
    if(step<(max-min)/(count+3)||step>(max-min)/(count-2))continue;
    const pts=[];let total=0;
    for(let k=0;k<count;k++){const p=localMax(sm,a+k*step,Math.max(3,Math.round(step*.045)));pts.push(p.pos);total+=p.score}
    const regularity=pts.slice(1).reduce((sum,p,i)=>sum+Math.abs((p-pts[i])-step),0)/(count-1);
    const value=total/(1+regularity*.08);
    if(!best||value>best.value)best={value,pts,step,med};
  }
  if(!best)throw new Error('Could not detect hairstyle grid boundaries.');
  return best.pts;
}

function innerDividerScore(data,w,h,channels,left,top,right,bottom){
  const y0=Math.round(top+(bottom-top)*.55),y1=Math.round(top+(bottom-top)*.92);
  const scores=[];
  for(let y=y0;y<=y1;y++){
    let total=0,n=0;
    for(let x=Math.round(left+(right-left)*.08);x<Math.round(right-(right-left)*.08);x++){
      const i=(y*w+x)*channels,iu=((y-1)*w+x)*channels;
      total+=Math.abs(luma(data[i],data[i+1],data[i+2])-luma(data[iu],data[iu+1],data[iu+2]));n++;
    }
    scores.push({y,v:total/Math.max(1,n)});
  }
  const med=median(scores.map(x=>x.v));
  scores.sort((a,b)=>b.v-a.v);
  const topHit=scores[0];
  return topHit&&topHit.v>Math.max(5,med*1.55)?topHit.y:Math.round(top+(bottom-top)*.86);
}

async function extractBoard(boardPath,boardIndex){
  const src=sharp(boardPath,{limitInputPixels:false});
  const {data,info}=await src.clone().removeAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h,channels}=info;
  const {xs,ys}=edgeScores(data,w,h,channels);

  // Detect the actual repeated card borders. The source artwork is 10 columns x 5 rows,
  // but title/header margins are intentionally excluded by the periodic-line solver.
  const vx=findPeriodicLines(xs,COLS+1,0,w-1);
  const hy=findPeriodicLines(ys,ROWS+1,Math.floor(h*.06),h-1);

  const manifest=[];
  for(let row=0;row<ROWS;row++){
    for(let col=0;col<COLS;col++){
      const local=row*COLS+col;
      const global=boardIndex*COUNT+local+1;
      const left=Math.min(vx[col],vx[col+1]),right=Math.max(vx[col],vx[col+1]);
      const top=Math.min(hy[row],hy[row+1]),bottom=Math.max(hy[row],hy[row+1]);
      const cw=right-left,ch=bottom-top;
      const insetX=Math.max(5,Math.round(cw*.075)),insetTop=Math.max(4,Math.round(ch*.045));
      const divider=innerDividerScore(data,w,h,channels,left,top,right,bottom);
      const cropLeft=Math.max(0,left+insetX);
      const cropTop=Math.max(0,top+insetTop);
      const cropRight=Math.min(w,right-insetX);
      const portraitLimit=Math.round(top+ch*.735);
      const cropBottom=Math.max(cropTop+20,Math.min(portraitLimit,divider-Math.round(ch*.055)));
      const cropW=Math.max(20,cropRight-cropLeft),cropH=Math.max(20,cropBottom-cropTop);
      const out=path.join(OUT,`style-${String(global).padStart(3,'0')}.webp`);

      await sharp(boardPath,{limitInputPixels:false})
        .extract({left:cropLeft,top:cropTop,width:cropW,height:cropH})
        .resize({width:CARD_W,height:CARD_H,fit:'contain',position:'north',background:{r:7,g:31,b:48,alpha:1},withoutEnlargement:false})
        .webp({quality:92,smartSubsample:true})
        .toFile(out);

      const st=await sharp(out).stats();
      const mean=(st.channels[0].mean+st.channels[1].mean+st.channels[2].mean)/3;
      const dev=(st.channels[0].stdev+st.channels[1].stdev+st.channels[2].stdev)/3;
      if(dev<7||mean<3)throw new Error(`Generated style ${global} appears blank or invalid.`);
      manifest.push({id:global,file:`/styles/style-${String(global).padStart(3,'0')}.webp`,board:boardIndex+1,row:row+1,column:col+1,source:{left:cropLeft,top:cropTop,width:cropW,height:cropH}});
    }
  }
  return{width:w,height:h,vertical:vx,horizontal:hy,styles:manifest};
}

await fs.rm(OUT,{recursive:true,force:true});
await fs.mkdir(OUT,{recursive:true});
const boards=[];
for(let i=0;i<BOARDS.length;i++)boards.push(await extractBoard(BOARDS[i],i));
const styles=boards.flatMap(b=>b.styles);
if(styles.length!==100)throw new Error(`Expected 100 hairstyle images, generated ${styles.length}.`);
await fs.writeFile(path.join(OUT,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),count:styles.length,boards},null,2));
console.log(`Clip-E hairstyle extraction complete: ${styles.length} individual WebP files generated in public/styles.`);
