import tempfile,runpy,sys,os
from pathlib import Path

# Retain all temporary files to comply with the workspace no-bulk-deletion rule.
class RetainedTemporaryDirectory:
    @classmethod
    def __class_getitem__(cls,key):return cls
    def __init__(self,suffix=None,prefix=None,dir=None,**kwargs):
        self.name=tempfile.mkdtemp(suffix=suffix or '',prefix=prefix or 'catalog_',dir=dir)
    def __enter__(self):return self.name
    def __exit__(self,*args):pass
    def cleanup(self):pass

tempfile.TemporaryDirectory=RetainedTemporaryDirectory
root=Path(__file__).parent
os.environ['SAL_FONTPATH']=str(root/'qa-fonts')
config=root/'qa-fonts'/'fonts.conf'
fontdir='/Users/changyichen/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype'
config.write_text('<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>'+str(root/'qa-fonts')+'</dir><dir>'+fontdir+'</dir><cachedir>/private/tmp/catalog-font-cache</cachedir><alias><family>sans-serif</family><prefer><family>Noto Sans SC</family><family>Hiragino Sans GB</family></prefer></alias></fontconfig>')
os.environ['FONTCONFIG_FILE']=str(config)
sys.argv=['render_docx.py',str(root/'三张活地图首页设计方案汇编.docx'),'--output_dir',str(root/'word-qa-v3'),'--emit_pdf']
runpy.run_path('/Users/changyichen/.codex/plugins/cache/openai-primary-runtime/documents/26.1026.10807/skills/documents/render_docx.py',run_name='__main__')
