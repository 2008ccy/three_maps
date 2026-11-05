"""Concept 9: irregular layered point clouds, drawn procedurally from scratch."""
from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).parent
OUT=ROOT/'scheme-09-motion';OUT.mkdir(exist_ok=True)
W,H=1100,782;S=W/1487;COUNT=160
rng=np.random.default_rng(920261104)
base=Image.new('RGB',(W,H),(6,12,19));d=ImageDraw.Draw(base)
def font(n,bold=False):return ImageFont.truetype(str(ROOT/'qa-fonts/HiraginoSansGB.ttc'),round(n*S),index=2 if bold else 0)
def txt(x,y,t,n=20,c=(219,225,231),bold=False):d.text((round(x*S),round(y*S)),t,font=font(n,bold),fill=c)
def line(a,b,c=(62,77,91),width=1):d.line(tuple(round(v*S) for v in (*a,*b)),fill=c,width=width)
def circle(x,y,r,c,width=1):d.ellipse(tuple(round(v*S) for v in (x-r,y-r,x+r,y+r)),outline=c,width=width)
for a,b in [((82,28),(69,45)),((82,28),(98,45)),((69,45),(98,45))]:line(a,b,(229,235,240))
for x,y in [(82,28),(69,45),(98,45)]:circle(x,y,4,(238,241,245))
txt(119,18,'三张活地图',30,bold=True);line((307,25),(307,48));txt(332,25,'模型构建',19)
for x,t in [(1018,'领域'),(1093,'生态'),(1168,'认知'),(1243,'更新记录')]:txt(x,25,t,18)
circle(1414,35,8,(220,226,230));line((1420,41),(1427,48),(220,226,230))
line((47,75),(1440,75))
txt(75,178,'模型构建 / 学习地图',21,(190,201,211))
txt(75,232,'从预训练模型，',64,(244,246,248),True)
txt(75,316,'走向有依据的回答。',64,(244,246,248),True)
txt(75,422,'一个课程答疑助手怎样构建？沿着三张相互关联的地图，',21)
txt(75,459,'找到答案与下一步。',21)
d.rounded_rectangle(tuple(round(v*S) for v in (75,535,286,593)),radius=5,outline=(222,230,237),width=1)
txt(96,546,'开始探索 →',26,(238,241,246));txt(323,547,'搜索地图',22)
line((70,757),(1417,757))
for x,n,title,q,body in [(98,'01','领域地图','学什么，怎样构建？','任务、概念与工具'),(565,'02','生态地图','谁在推动，如何协作？','研究者、团队与开源社区'),(1034,'03','认知地图','怎样判断，如何修正？','证据、判断与修正')]:
 txt(x,784,n,19,(177,191,203));txt(x,815,title,30,(237,241,244),True)
 txt(x+342,820,'→',26);txt(x,868,q,21);txt(x,907,body,19,(172,185,196))
line((502,784),(502,926));line((970,784),(970,926));line((70,962),(1417,962))
txt(75,995,'持续更新，保留依据。    更新记录 ↗',18,(177,188,199))
static=np.asarray(base).astype(np.float32)

# No lattice: all cloud samples, density pockets and mode phases are random.
layers=[]
settings=[(720,850,183,43,(221,166,99)),(575,1000,380,64,(64,205,224)),(205,1400,612,78,(222,235,247))]
for j,(start,length,cy,breadth,color) in enumerate(settings):
 n=9000 if j<2 else 12000
 u=rng.uniform(-.03,1.03,n).astype(np.float32)
 v=rng.normal(0,.63,n).clip(-1.75,1.75).astype(np.float32)
 modes=[]
 for k in range(10):
  modes.append((rng.uniform(1.3,8),rng.uniform(-3.4,3.4),int(rng.integers(1,4)),rng.uniform(0,6.283),rng.uniform(.05,.2)/(1+k*.11)))
 layers.append(dict(u=u,v=v,modes=modes,start=start,length=length,cy=cy,breadth=breadth,color=np.array(color),weight=rng.uniform(.22,1.05,n).astype(np.float32),phase=rng.uniform(0,6.283,n).astype(np.float32)))

def noise(u,v,p,modes,offset=0):
 z=np.zeros_like(u)
 for kx,ky,kt,phase,a in modes:z+=a*np.sin(u*kx+v*ky+p*kt+phase+offset)
 return z

pal=[]
for c in [(242,246,249),(67,207,224),(224,170,103)]:
 for a in np.linspace(0,1,74):pal.extend(np.rint(np.array((6,12,19))*(1-a)+np.array(c)*a).astype(int))
for a in np.linspace(0,255,34):pal.extend((int(a),)*3)
palette=Image.new('P',(1,1));palette.putpalette(pal)

def render(t):
 p=2*np.pi*t
 rgb=np.zeros((H*W,3),np.float32)
 for j,l in enumerate(layers):
  u=l['u'];v=l['v'];m=l['modes']
  nx=noise(u*1.4,v,p,m);ny=noise(u,v*1.3,p,m,1.83)
  # Independent local eddies; unequal centers, radii, speeds and phases.
  uu=u+nx*.035;vv=v+ny*.16
  for k in range(2):
   cx=.3+.34*k+.055*np.sin((k+1)*p+j*1.7)
   cv=(-.4 if k==0 else .45)+.2*np.sin(p*2+j+k)
   dx=uu-cx;dy=(vv-cv)*.17
   r2=dx*dx+dy*dy;angle=np.exp(-r2/(.027+.007*j))*(.31*np.sin(p*(k+1)+j+k*2.7))
   ca=np.cos(angle);sa=np.sin(angle)
   uu=cx+dx*ca-dy*sa;vv=cv+(dx*sa+dy*ca)/.17
  x=l['start']+l['length']*uu+vv*52+nx*27
  y=l['cy']+vv*l['breadth']+ny*(39+8*j)+noise(u*.6,v*.5,p,m,3.4)*29
  y+=22*np.sin(u*4.1+j*.9)+9*np.cos(u*9.7+v*2.4+j)
  envelope=np.exp(-v*v*.74)*np.clip((u+.05)*7,0,1)*np.clip((1.08-u)*8,0,1)
  pockets=np.clip(.8+noise(u*4,v*3,p,m,2.1)*.65,.2,1.2)
  fadeleft=np.where(y<610,np.clip((x-670)/165,0,1),np.clip((x-170)/300,0,1))
  gate=fadeleft*np.clip((y-108)/50,0,1)*np.clip((749-y)/65,0,1)
  brightness=l['weight']*envelope*pockets*gate
  xp=x*S;yp=y*S;ix=np.floor(xp).astype(np.int32);iy=np.floor(yp).astype(np.int32)
  dx=xp-ix;dy=yp-iy;field=np.zeros(H*W,np.float32)
  for ox,oy,w in [(0,0,(1-dx)*(1-dy)),(1,0,dx*(1-dy)),(0,1,(1-dx)*dy),(1,1,dx*dy)]:
   xx=ix+ox;yy=iy+oy;ok=(xx>=0)&(xx<W)&(yy>=0)&(yy<H)
   field+=np.bincount(yy[ok]*W+xx[ok],weights=(w*brightness)[ok],minlength=W*H).astype(np.float32)
  energy=1-np.exp(-field*2.7)
  rgb+=energy[:,None]*l['color'][None,:]*.95
 result=np.clip(static+rgb.reshape(H,W,3),0,255).astype(np.uint8)
 im=Image.fromarray(result,'RGB')
 # Small static annotations stay legible against the independently moving clouds.
 dr=ImageDraw.Draw(im)
 for x,y,word in [(807,129,'知识'),(1303,280,'协作'),(721,490,'判断')]:
  dr.text((round(x*S),round(y*S)),word,font=font(20,True),fill=(231,237,240))
 return im.quantize(palette=palette,dither=Image.Dither.NONE)

frames=[]
for i in range(COUNT):
 im=render(i/COUNT);frames.append(im)
 if i in [0,40,80,120]:im.convert('RGB').save(OUT/f'preview-{i:03d}.png')
 if i%40==0:print('rendered',i,flush=True)
target=OUT/'scheme-09-irregular-particle-loop.gif'
frames[0].save(target,save_all=True,append_images=frames[1:],duration=60,loop=0,optimize=False,disposal=1)
(OUT/'animation-info.json').write_text(json.dumps({'concept':9,'frames':COUNT,'duration_seconds':9.6,'size':[W,H],'motion':'三层随机点云 独立多尺度流场 局部涡流与密度聚散 无规则点阵 无同步起伏','loop':'infinite'},ensure_ascii=False,indent=2)+'\n')
print(target,flush=True);print('bytes',target.stat().st_size,flush=True)
