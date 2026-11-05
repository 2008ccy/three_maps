"""Render a seamless procedural particle animation of concept 10 from scratch."""
from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).parent
OUT=ROOT/'scheme-10-motion';OUT.mkdir(exist_ok=True)
W,H=1100,782
S=W/1487
FONT=ROOT/'qa-fonts/HiraginoSansGB.ttc'
rng=np.random.default_rng(20261104)

def font(size,bold=False):return ImageFont.truetype(str(FONT),round(size*S),index=2 if bold else 0)
base=Image.new('L',(W,H),14)
draw=ImageDraw.Draw(base)
def txt(x,y,text,size=24,color=220,bold=False,center=False):
 f=font(size,bold)
 if center:x-=draw.textlength(text,font=f)/2/S
 draw.text((round(x*S),round(y*S)),text,font=f,fill=color)
def line(x1,y1,x2,y2,fill=61):draw.line(tuple(round(v*S) for v in (x1,y1,x2,y2)),fill=fill,width=1)

txt(66,17,'三张活地图',29,241,True)
line(221,25,221,48)
txt(245,24,'模型构建',18,193)
txt(948,25,'领域',18,208);txt(1026,25,'生态',18,208);txt(1105,25,'认知',18,208)
txt(1180,25,'更新记录',18,208);line(1295,25,1295,47)
txt(1352,24,'搜索地图',18,218)
draw.ellipse(tuple(round(v*S) for v in (1327,28,1340,41)),outline=218,width=1)
line(1338,39,1345,46,218)
line(64,69,1425,69)
txt(743,108,'模型构建 · 学习地图',20,190,center=True)
txt(743,145,'从预训练模型，',73,237,center=True)
txt(743,231,'走向有依据的回答。',73,237,center=True)
txt(743,326,'一个课程答疑助手怎样构建？沿着三张相互关联的地图，找到答案与下一步。',20,195,center=True)
for x,n,title,question in [(166,'01','领域地图','学什么，怎样构建？'),(616,'02','生态地图','谁在推动，如何协作？'),(1066,'03','认知地图','怎样判断，如何修正？')]:
 txt(x,805,n,20,167);txt(x,841,title+' ↗',30,232);txt(x,891,question,21,185)
line(517,838,517,888);line(966,838,966,888)
txt(743,979,'持续更新，保留依据。    更新记录 ↗',18,168,center=True)
background=np.asarray(base).copy().astype(np.float32)
N=20500
theta=rng.uniform(0,2*np.pi,(3,N)).astype(np.float32)
spread=rng.normal(0,1,(3,N)).astype(np.float32)
phase0=rng.uniform(0,2*np.pi,(3,N)).astype(np.float32)
weights=rng.uniform(.18,.65,(3,N)).astype(np.float32)
centers=[(342,560),(743,555),(1144,560)]
# Distant low-density grains give the ridges a coherent particle environment.
A=15000
ax=rng.uniform(10,1477,A).astype(np.float32)
ay=rng.normal(555,105,A).astype(np.float32)
ap=rng.uniform(0,2*np.pi,A).astype(np.float32)
aw=rng.uniform(.04,.18,A).astype(np.float32)
palette=[]
for k in range(256):palette.extend((min(k*2,255),)*3)

def frame(t):
 field=np.zeros(W*H,dtype=np.float32)
 def splat(x,y,weight):
  x=x*S;y=y*S
  gate=np.clip((y/S-368)/55,0,1)*np.clip((788-y/S)/70,0,1)
  weight=weight*gate
  x0=np.floor(x).astype(np.int32);y0=np.floor(y).astype(np.int32)
  dx=x-x0;dy=y-y0
  for ox,oy,alpha in [(0,0,(1-dx)*(1-dy)),(1,0,dx*(1-dy)),(0,1,(1-dx)*dy),(1,1,dx*dy)]:
   xi=x0+ox;yi=y0+oy;valid=(xi>=0)&(xi<W)&(yi>=0)&(yi<H)
   field[:]+=np.bincount(yi[valid]*W+xi[valid],weights=(weight*alpha)[valid],minlength=W*H).astype(np.float32)
 p=2*np.pi*t
 for j,(cx,cy) in enumerate(centers):
  a=theta[j]+.11*np.sin(p+phase0[j])+.045*np.cos(2*p+phase0[j])
  r=1+.10*np.sin(3*a+p+j*.8)+.065*np.cos(5*a-2*p+j)+.035*np.sin(p+j)
  r+=spread[j]*(.075+.018*np.sin(p+j))
  x=cx+238*r*np.cos(a)+10*np.sin(p+j)
  y=cy+143*r*np.sin(a)+8*np.cos(p+j)
  brightness=weights[j]*(.9+.1*np.cos(a*2-p))
  splat(x,y,brightness)
 splat(ax+7*np.sin(p+ap),ay+9*np.cos(p+ap),aw)
 energy=field.reshape(H,W)
 luminance=14+185*(1-np.exp(-energy*.8))
 im=Image.fromarray(np.clip(np.maximum(background,luminance)/2,0,127).astype(np.uint8),'P')
 im.putpalette(palette)
 return im

frames=[]
for i in range(128):
 im=frame(i/128)
 frames.append(im)
 if i in [0,32,64,96]:im.convert('RGB').save(OUT/f'preview-{i:03d}.png')
 if i%32==0:print('rendered',i,flush=True)
target=OUT/'方案10 银白粒子波纹动态预览.gif'
frames[0].save(target,save_all=True,append_images=frames[1:],duration=60,loop=0,optimize=False,disposal=1)
info={'concept':10,'dimensions':[W,H],'frames':128,'duration_seconds':7.68,'loop':'infinite','motion':'三组银白粒子波纹缓慢形变与聚散，文字固定','method':'procedural particle rendering; no website source changed'}
(OUT/'animation-info.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n')
print(target,flush=True)
print('bytes',target.stat().st_size,flush=True)
