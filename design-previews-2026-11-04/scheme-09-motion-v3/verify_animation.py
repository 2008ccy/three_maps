from pathlib import Path
from PIL import Image
import numpy as np, json
p=Path(__file__).parent
reports=[]
for name in ['scheme-09-matched-particle-loop-v3.gif','scheme-09-matched-preview-v3.gif']:
 im=Image.open(p/name);durations=[];frames={}
 for i in range(im.n_frames):
  im.seek(i);durations.append(im.info.get('duration',0))
  if i in [0,1,40,80,120,159]:frames[i]=np.asarray(im.convert('RGB')).astype(np.int16)
 scale=im.width/1280
 regions={'header':(0,0,1280,80),'heading':(55,170,555,350),'footer':(0,650,1280,911)}
 fixed={}
 for key,box in regions.items():
  x1,y1,x2,y2=[round(x*scale) for x in box]
  fixed[key]=max(int(np.abs(a[y1:y2,x1:x2]-frames[0][y1:y2,x1:x2]).max()) for a in frames.values())
 x1,y1,x2,y2=[round(x*scale) for x in (780,170,1250,610)]
 mean=lambda a,b:round(float(np.abs(a[y1:y2,x1:x2]-b[y1:y2,x1:x2]).mean()),3)
 report={'file':name,'bytes':(p/name).stat().st_size,'size':im.size,'frames':im.n_frames,'durationSeconds':sum(durations)/1000,'uniqueDelaysMs':sorted(set(durations)),'loop':im.info.get('loop'),'fixedRegionMaxDifference':fixed,'firstStepMeanDifference':mean(frames[0],frames[1]),'loopSeamMeanDifference':mean(frames[159],frames[0])}
 assert im.n_frames==160 and set(durations)=={50} and im.info.get('loop')==0
 assert max(fixed.values())==0
 if im.width==1280:Image.fromarray(frames[80].astype(np.uint8)).save(p/'encoded-frame-080.png')
 reports.append(report)
(p/'quality-check.json').write_text(json.dumps(reports,indent=2))
print(json.dumps(reports))
