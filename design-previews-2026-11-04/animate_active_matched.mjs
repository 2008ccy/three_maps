import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from '/Users/changyichen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';

// Video texture animation: retain the original composition and move only its
// particle regions. No text or interface element is redrawn.
const root=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(root,'scheme-09-motion-v2');await fs.mkdir(out,{recursive:true});
const width=1280, count=180, delay=60;
const {data:source,info}=await sharp(path.join(root,'09-active-theory-particles.png')).resize({width}).removeAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,S=W/1487,B=W*H*3;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{v=clamp((v-a)/(b-a),0,1);return v*v*(3-2*v);};
const segmentDistance=(x,y,x1,y1,x2,y2)=>{
 const dx=x2-x1,dy=y2-y1,t=clamp(((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy),0,1);
 return Math.hypot(x-x1-t*dx,y-y1-t*dy);
};
const uiRects=[[800,123,857,151],[1300,268,1360,309],[716,479,778,512],[65,170,662,485],[67,520,415,600]];
const leaders=[[849,146,883,146],[883,146,916,194],[1305,291,1274,291],[1274,291,1229,357],[766,502,791,502],[791,502,821,566]];
const nodes=[[916,194],[1229,357],[821,566]];
const mask=new Float32Array(W*H);
let animatedPixels=0;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const X=x/S,Y=y/S;
 const left=680-390*smooth(515,665,Y);
 let a=smooth(left,left+105,X)*smooth(91,130,Y)*(1-smooth(719,749,Y));
 if(a>0){
  for(const [x1,y1,x2,y2] of uiRects){
   const dist=Math.hypot(Math.max(x1-X,0,X-x2),Math.max(y1-Y,0,Y-y2));
   a*=smooth(0,12,dist);
  }
  if(a>0)for(const l of leaders)a*=smooth(4,12,segmentDistance(X,Y,...l));
  if(a>0)for(const n of nodes)a*=smooth(7,17,Math.hypot(X-n[0],Y-n[1]));
 }
 mask[y*W+x]=a;if(a>0)animatedPixels++;
}

let seed=932617;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const modes=Array.from({length:3},()=>Array.from({length:9},(_,k)=>({
 kx:(.0018+rand()*.008)*(rand()>.5?1:-1),ky:(.003+rand()*.012)*(rand()>.5?1:-1),
 freq:1+Math.floor(rand()*4),phase:rand()*Math.PI*2,
 amp:(1.1+rand()*1.3)/(1+k*.16)
})));
const step=22,GX=Math.ceil(W/step)+1,GY=Math.ceil(H/step)+1;
function fieldAt(t){
 const vx=new Float32Array(GX*GY),vy=new Float32Array(GX*GY),phase=t*Math.PI*2;
 for(let gy=0;gy<GY;gy++)for(let gx=0;gx<GX;gx++){
  const X=gx*step/S,Y=gy*step/S;
  const centers=[205-25*Math.sin(X*.005),380-25*Math.sin(X*.006+1),603+36*Math.sin(X*.005+2)];
  const bands=centers.map((c,j)=>Math.exp(-.5*((Y-c)/[60,93,105][j])**2));
  const norm=bands.reduce((a,b)=>a+b,0)+1e-9;
  let dx=0,dy=0;
  for(let j=0;j<3;j++){
   let ux=0,uy=0;
   for(const m of modes[j]){
    const base=X*m.kx+Y*m.ky+m.phase;
    const delta=Math.sin(base+phase*m.freq)-Math.sin(base);
    // A spatial curl field creates local currents instead of synchronized waves.
    const normK=Math.hypot(m.kx,m.ky);
    ux+=delta*m.amp*m.ky/normK;
    uy-=delta*m.amp*m.kx/normK;
   }
   // Several unequal, slowly shifting vortices add local roll and separation.
   const cx=[925,1230,1040][j]+28*Math.sin(phase+j*1.6);
   const cy=centers[j]+13*Math.sin(phase*2+j);
   const ex=X-cx,ey=Y-cy;
   const q=Math.exp(-(ex*ex/54000+ey*ey/5500));
   const strength=.022*(Math.sin(phase+j*.9)-Math.sin(j*.9));
   ux+=-ey*q*strength;uy+=ex*q*strength;
   const w=bands[j]/norm;
   dx+=ux*w;dy+=uy*w;
  }
  vx[gy*GX+gx]=dx*S;vy[gy*GX+gx]=dy*S;
 }
 return [vx,vy];
}
function render(t){
 const frame=Buffer.from(source),[vx,vy]=fieldAt(t);
 if(t===0)return frame;
 for(let y=90*S|0;y<Math.min(H,750*S);y++){
  const gy=y/step,iy=Math.floor(gy),fy=gy-iy;
  for(let x=240*S|0;x<W;x++){
   const at=y*W+x,a=mask[at];if(a===0)continue;
   const gx=x/step,ix=Math.floor(gx),fx=gx-ix,ga=iy*GX+ix;
   const v00=(1-fx)*(1-fy),v10=fx*(1-fy),v01=(1-fx)*fy,v11=fx*fy;
   const dx=(vx[ga]*v00+vx[ga+1]*v10+vx[ga+GX]*v01+vx[ga+GX+1]*v11)*a;
   const dy=(vy[ga]*v00+vy[ga+1]*v10+vy[ga+GX]*v01+vy[ga+GX+1]*v11)*a;
   const sx=clamp(x+dx,0,W-1.001),sy=clamp(y+dy,0,H-1.001);
   const xx=Math.floor(sx),yy=Math.floor(sy),rx=sx-xx,ry=sy-yy;
   const s00=(yy*W+xx)*3,s10=s00+3,s01=s00+W*3,s11=s01+3,dst=at*3;
   const w00=(1-rx)*(1-ry),w10=rx*(1-ry),w01=(1-rx)*ry,w11=rx*ry;
   for(let c=0;c<3;c++)frame[dst+c]=Math.round(source[s00+c]*w00+source[s10+c]*w10+source[s01+c]*w01+source[s11+c]*w11);
  }
 }
 return frame;
}

const arg=process.argv[2];
if(arg==='--stills'){
 for(const [i,t] of [0,.25,.5,.75].entries()){
  const data=render(t);await sharp(data,{raw:{width:W,height:H,channels:3}}).png().toFile(path.join(out,`check-${i}.png`));
 }
 await sharp(source,{raw:{width:W,height:H,channels:3}}).png().toFile(path.join(out,'reference-scaled.png'));
 console.log('stills ready',out);process.exit(0);
}
const packed=Buffer.allocUnsafe(B*count);
let protectedDelta=0,frameDelta=0;
for(let i=0;i<count;i++){
 const data=render(i/count);data.copy(packed,i*B);
 if(i===0||i===45||i===90||i===135)await sharp(data,{raw:{width:W,height:H,channels:3}}).png().toFile(path.join(out,`preview-${String(i).padStart(3,'0')}.png`));
 if(i===90)for(let q=0;q<mask.length;q++)for(let c=0;c<3;c++){
  const diff=Math.abs(data[q*3+c]-source[q*3+c]);
  if(mask[q]===0)protectedDelta=Math.max(protectedDelta,diff);
  frameDelta+=diff;
 }
 if(i%30===0)console.log(`rendered ${i}/${count}`);
}
console.log('encoding',W,H,count);
const target=path.join(out,'scheme-09-matched-particle-loop-v2.gif');
await sharp(packed,{raw:{width:W,height:H*count,channels:3,pageHeight:H},limitInputPixels:false})
 .gif({loop:0,delay:Array(count).fill(delay),colours:256,dither:0,effort:7,interFrameMaxError:0,interPaletteMaxError:256,keepDuplicateFrames:true}).toFile(target);
await fs.writeFile(path.join(out,'animation-info.json'),JSON.stringify({concept:9,version:2,width:W,height:H,frames:count,durationSeconds:count*delay/1000,
 source:'09-active-theory-particles.png',firstFrame:'exact source texture at output resolution',protectedPixelsMaxDifference:protectedDelta,
 frameMeanAbsoluteDifference:frameDelta/(W*H*3),animatedPixels,method:'local particle-region video texture displacement; static original typography and layout; asynchronous multiscale curl fields'},null,2));
console.log(target,(await fs.stat(target)).size,'bytes');
