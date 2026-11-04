from pathlib import Path
import json
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT = Path(__file__).parent
OUT = ROOT / '三张活地图首页设计方案汇编.docx'
manifest = json.loads((ROOT / 'manifest.json').read_text())
plans = [
('Editorial', '杂志式知识地图', '模板参考',
 '暖白底色、黑色衬线标题和珊瑚红细线形成清晰层次。左侧介绍项目，右侧放知识关系示意，下方并列三个地图入口。',
 '适合希望首页有编辑设计感，同时让第一次访问者迅速理解项目主题的情形。图文比例与章节编号是这一方案的重点。',
 '把模板的图文布局移植到现有 Next.js 首页；图示采用本站真实知识结构，三个入口直接链接当前地图。中文标题需重新选字重与行距。',
 '需要准备质量稳定的知识图示。移植时应保留所用模板要求的设计署名，具体使用条件以官方许可为准。'),
('Retypeset', '中文书页式', '开源主题参考',
 '象牙白纸面、中文衬线标题和克制留白营造书页感。左侧按三个编号章节组织内容，右侧保留站点身份与导航。',
 '适合强调阅读、知识整理与课程出版物气质。三个入口顺着阅读方向展开，后续可自然接入更新记录。',
 '借鉴中文字体、段落节奏与章节列表，将 Astro 主题的视觉语言移植到现有首页；正文和地图系统继续由 Fumadocs 承载。',
 '视觉冲击主要来自排版，图片与动效较少。它不是可直接安装到 Next.js 的主题，需要重新实现首页结构。'),
('Astro Erudite', '深色学术索引', '开源主题参考',
 '深灰底、暖白文字与低饱和绿色点缀。词典式标题和定义构成首屏，下方用分隔线组织三行地图目录，左侧提供简洁导航。',
 '适合希望保留夜间主题，同时减少装饰、突出知识与检索的方向。目录式布局便于快速找到阅读入口。',
 '保留定义式导读与编号目录，减少重复导航。正文说明控制行长，辅助文字应有足够对比度。',
 '默认表达比较安静，需用字号与间距明确入口层次。源主题基于 Astro，接入当前项目需要移植。'),
('Accession', '知识展览导览', 'Framer 模板参考',
 '奶油白导航、赭黄色整幅主视觉和厚重衬线标题。三张纸质地图作为展品式视觉隐喻，底部编号导览条连接三个地图。',
 '适合希望课程项目具有展览感、记忆点更强的情形。三个知识视角可被理解为三个相互联系的展区。',
 '采用整幅主视觉与底部导览条的组织方式。纸质地图插图需与真实内容呼应，移动端应优先露出三个入口。',
 '大图会影响加载与窄屏裁切。Framer 模板需在现有技术栈内重新实现，不能直接作为当前网站主题安装。'),
('Gallery', '分类画廊式', 'Framer 模板参考',
 '白底、黄色强调和清晰的三列图像索引。首屏介绍项目，三张地图各自配有风格一致的缩略图与简短说明。',
 '适合未来继续扩展知识主题、案例和探索路线。缩略图能在点击前说明每张地图的内容差异。',
 '为领域、生态、认知分别设计对应的构建路径、协作网络和判断流程图。保留现有搜索，避免为了目录感增加不必要的筛选。',
 '缩略图必须统一，并能随内容更新；示意图中的概念关系需要人工复核。Framer 版本需重新实现。'),
('Raycast', '红黑光影与知识搜索', '成熟产品官网参考',
 '黑底配红色斜向光带，左侧以大白字表达主题，右侧用精细的概念索引面板展示搜索入口；下方并列三张地图。',
 '适合突出技术感与快速查找知识点。搜索面板让首页与本站已有的概念检索能力产生直接联系。',
 '使用真实站内搜索结果与概念标题。光带集中在索引面板附近，确保正文和底部入口始终清楚。',
 '红色光影应控制面积与亮度；面板应接入现有搜索，避免让静态效果暗示尚未实现的功能。官网是视觉参考，并非可下载模板。'),
('Vercel', '浅色工程网格与几何结构', '成熟产品官网参考',
 '黑白高对比排版、细网格、定位十字和几何示意构成工程气质。知识构建、生态协作与证据判断连接到课程答疑助手。',
 '适合希望具有科技感，同时保持清晰、明亮与稳定阅读体验的方向。图示能直接解释三张地图的分工。',
 '用单一中心示意和三段连续入口形成首屏；小面积蓝绿连线承担语义强调，主标题保持纯色。',
 '网格和注记需要足够轻，避免干扰文字；中心结构属于概念示意，不应被表达成实测数据或严格技术依赖。'),
('Linear', '精密深色知识界面', '成熟产品官网参考',
 '近黑底、炭灰表面、精细边框与少量冷蓝强调。首页下半部分展示一幅领域关系图预览，让核心学习界面成为主视觉。',
 '适合希望保持暗色科技气质，同时强调网站实际内容和可用性的方向。知识图谱预览比纯装饰图更接近产品体验。',
 '预览优先采用当前地图的真实结构，并保留打开地图的明确入口。使用轻量静态图或简化渲染，避免在首页复制全部地图工具。',
 '窄屏需要简化节点数量，保证标签可读。效果图中的关系图只是视觉示意，实际发布前需按最新教学数据核对。'),
('Active Theory', '立体粒子知识空间', '成熟工作室官网参考',
 '深色空间中，三层由细密点云形成的曲面对应知识、协作与判断。粒子集中构成主视觉，左侧文字与底部三个入口保持清楚。',
 '适合把动态粒子作为首页的重要识别特征。三层粒子地图与三种学习视角形成对应关系，空间层次鲜明。',
 '动效可设想为缓慢起伏、局部聚合与轻微指针响应；文字区域保持低粒子密度。交互应服务地图入口，不增加首次访问的等待步骤。',
 '实施前应验证移动设备性能与阅读对比度，并提供减少动态效果时的静态状态。本页仅展示粒子场的静态构图。'),
('iyO', '单色粒子波纹', '成熟产品官网参考',
 '近黑底与银白微粒形成有机波纹，中心文字和大面积留白保持安静。三组相连的波纹呼应三个地图视角，入口采用纯文字组织。',
 '适合希望保留粒子效果，同时让整体更克制、更接近内容型网站的方向。粒子的密度变化承担主要视觉表现。',
 '可设想用缓慢的波纹变形与聚散呼应三个入口；文字保持清晰实体字形，粒子不穿过重要阅读区。',
 '银白粒子过暗会失去存在感，过亮又会抢占注意力，需要实际屏幕调校。动态实现还需单独评估性能；本页为静态样板。'),
]

doc=Document()
sec=doc.sections[0]
sec.page_width=Cm(21);sec.page_height=Cm(29.7)
sec.top_margin=Cm(1.6);sec.bottom_margin=Cm(1.6)
sec.left_margin=Cm(1.8);sec.right_margin=Cm(1.8)
sec.footer_distance=Cm(.7)
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2','Caption']:
 s=doc.styles[name];s.font.name='Arial';s.font.color.rgb=RGBColor(0,0,0)
 s.element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'Hiragino Sans GB')
normal=doc.styles['Normal'];normal.font.size=Pt(10.5)
normal.paragraph_format.line_spacing=1.2;normal.paragraph_format.space_after=Pt(7)
for name,size in [('Title',26),('Heading 1',22),('Heading 2',12),('Subtitle',12),('Caption',9)]:
 doc.styles[name].font.size=Pt(size)
 doc.styles[name].paragraph_format.space_after=Pt(8)
doc.styles['Heading 2'].paragraph_format.space_before=Pt(7)
doc.core_properties.title='三张活地图首页设计方案汇编'
doc.core_properties.subject='十个首页方案的预览与选型参考'
doc.core_properties.author=''

def para(text,style=None):return doc.add_paragraph(text,style)
def label(text,body):
 p=doc.add_paragraph();p.add_run(text+'  ').bold=True;p.add_run(body);return p
def link(p,title,url):
 h=OxmlElement('w:hyperlink');h.set(qn('r:id'),p.part.relate_to(url,RT.HYPERLINK,is_external=True))
 r=OxmlElement('w:r');pr=OxmlElement('w:rPr');color=OxmlElement('w:color');color.set(qn('w:val'),'245A81');pr.append(color)
 r.append(pr);t=OxmlElement('w:t');t.text=title;r.append(t);h.append(r);p._p.append(h)

doc.add_paragraph('三张活地图首页设计方案汇编','Title')
doc.add_paragraph('十个方案的预览与选型参考','Subtitle')
para('2026年11月4日')
para('本文件将三张活地图网站的十个首页方向集中整理，沿用讨论中的 1 至 10 号编号。每个方案均附有本站适配预览、设计说明、适配建议与参考来源，便于比较并确定后续改版方向。')
para('方案 1 至 5 参考现有模板或开源主题；方案 6 至 10 参考成熟产品或工作室官网。全部预览均为绘图生成的静态首页样板，不是原站截图，也不表示已在本站实现对应交互。')
doc.add_heading('方案总览',level=2)
table=doc.add_table(rows=1,cols=3);table.alignment=WD_TABLE_ALIGNMENT.CENTER;table.autofit=False
widths=[1.1,6.5,9.8]
for col,w in zip(table.columns,widths):col.width=Cm(w)
for i,t in enumerate(['编号','方案方向','重点']):table.rows[0].cells[i].text=t
for i,(name,title,kind,design,fit,adapt,limit) in enumerate(plans,1):
 c=table.add_row().cells;c[0].text=str(i);c[1].text=name+'  '+title
 c[2].text=['图文编排与章节入口','中文排版与书页阅读','暗色目录与克制层次','展览主视觉与编号导览','三列缩略图与知识索引','光影气氛与概念检索','工程网格与三图分工','真实界面预览与精细层级','三层点云与立体空间','单色微粒与有机波纹'][i-1]
for ri,row in enumerate(table.rows):
 for ci,c in enumerate(row.cells):
  c.width=Cm(widths[ci]);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
  tcPr=c._tc.get_or_add_tcPr();b=OxmlElement('w:tcBorders')
  for edge in ['top','left','bottom','right']:
   e=OxmlElement('w:'+edge);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');b.append(e)
  tcPr.append(b)
  margins=OxmlElement('w:tcMar')
  for edge in ['top','bottom','left','right']:
   e=OxmlElement('w:'+edge);e.set(qn('w:w'),'85');e.set(qn('w:type'),'dxa');margins.append(e)
  tcPr.append(margins)
  if ri==0:
   sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'E8ECF0');tcPr.append(sh)
  for p in c.paragraphs:
   p.paragraph_format.space_after=Pt(0);p.paragraph_format.line_spacing=1.15
   if ci==0:p.alignment=WD_ALIGN_PARAGRAPH.CENTER
   for r in p.runs:r.font.size=Pt(9);r.bold=(ri==0)
tr=OxmlElement('w:tblHeader');table.rows[0]._tr.get_or_add_trPr().append(tr)
doc.add_heading('选型建议',level=2)
para('优先关注中文阅读与编辑感，可先比较 1 和 2；希望科技感清晰且方便接入现有内容，可先比较 7 和 8；明确希望使用粒子动效，可重点比较 9 和 10。以上是设计适配判断，最终方向可按视觉偏好与实现成本共同确定。')
para('共同要求是让领域、生态、认知三个入口清楚可见，继续复用现有内容、搜索和地图结构。选择后先制作一个可访问的首页原型，再验证手机布局、动效和地图跳转。')

for i,item in enumerate(plans,1):
 name,title,kind,design,fit,adapt,limit=item
 doc.add_page_break()
 doc.add_heading(f'{i:02d}  {name}  {title}',level=1)
 p=para(kind);p.paragraph_format.space_after=Pt(10)
 p=doc.add_paragraph();p.paragraph_format.space_after=Pt(3)
 pic=p.add_run().add_picture(str(ROOT/manifest['display_order'][i-1]['file']),width=Cm(17.4))
 pic._inline.docPr.set('descr',f'方案{i} {name} {title} 本站首页预览')
 para(f'方案 {i} 的本站适配预览', 'Caption')
 label('设计说明',design)
 label('适用情形',fit)
 label('适配建议',adapt)
 label('实施注意',limit)
 p=doc.add_paragraph();p.paragraph_format.space_before=Pt(5);p.add_run('参考来源  ').bold=True
 key='Active Theory' if i==9 else 'iyO' if i==10 else name
 url=manifest['source_pages'][key]
 link(p,url,url)
 if i==1:
  p=doc.add_paragraph();link(p,'官方许可说明','https://html5up.net/license')
 if i==2:
  p=doc.add_paragraph();link(p,'中文演示','https://retypeset.radishzz.cc/')
 if i==8:
  p=doc.add_paragraph();link(p,'官方项目界面参考','https://linear.app/docs/projects');p.add_run('    ');link(p,'官方事项界面参考','https://linear.app/docs/creating-issues')

f=sec.footer.paragraphs[0];f.alignment=WD_ALIGN_PARAGRAPH.RIGHT
r=f.add_run();r.font.size=Pt(9);fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');r._r.addnext(fld)
for elem in list(doc.styles.element.iter(qn('w:pBdr'))):elem.getparent().remove(elem)
for elem in list(doc.element.iter(qn('w:pBdr'))):elem.getparent().remove(elem)
doc.save(OUT)
print(OUT)
