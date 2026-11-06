import { chromium } from '/Users/changyichen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const out=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({headless:true,executablePath:'/Users/changyichen/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await page.emulateMedia({reducedMotion:'reduce'});
const errors=[],httpErrors=[],checks=[];
page.on('pageerror',e=>errors.push({url:page.url(),message:String(e)}));
page.on('console',e=>{if(e.type()==='error')errors.push({url:page.url(),message:e.text()});});
page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
async function inspect(map,state){
 const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,scrollY,dialog:document.querySelector('[role=dialog]')?{client:document.querySelector('[role=dialog]').clientWidth,scroll:document.querySelector('[role=dialog]').scrollWidth,top:document.querySelector('[role=dialog]').getBoundingClientRect().top,height:document.querySelector('[role=dialog]').getBoundingClientRect().height}:null}));
 checks.push({map,state,...layout,overflow:layout.scroll>layout.width+1});
 await page.screenshot({path:`${out}${map}-${state}.png`,fullPage:!(state.startsWith('mobile') && state!=='mobile-overview')});
}
for(const map of ['domain','ecosystem','cognition']){
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(`http://127.0.0.1:3000/docs/${map}/`,{waitUntil:'networkidle'});
 const topic=page.locator('button[aria-label^="展开主题："]').first();await topic.waitFor();
 await inspect(map,'desktop-overview');
 await topic.click();await page.getByRole('dialog').waitFor();await inspect(map,'desktop-topic');
 await page.locator('button[aria-label^="打开知识点："]').first().click();await page.locator('[role=dialog] .does-not-exist').count();await inspect(map,'desktop-reading');
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'关系图',exact:true}).click();
 await page.locator('[aria-label="地图视图"] button[aria-pressed=true]').filter({hasText:'关系图'}).waitFor();
 await inspect(map,'desktop-graph');
 const graphNode=page.locator('button[id^="node-"]').first();await graphNode.click();await page.getByRole('dialog').waitFor();
 checks.push({map,state:'graph-node-open',heading:await page.locator('#reading-title').innerText()});
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});
 await page.goto(`http://127.0.0.1:3000/docs/${map}/`,{waitUntil:'networkidle'});
 await page.locator('button[aria-label^="展开主题："]').first().waitFor();
 await inspect(map,'mobile-overview');
 await page.locator('button[aria-label^="展开主题："]').first().click();await page.getByRole('dialog').waitFor();await inspect(map,'mobile-topic');
 await page.locator('button[aria-label^="打开知识点："]').first().click();await inspect(map,'mobile-reading');
 await page.keyboard.press('Escape');
 console.log(map,'complete');
}
await fs.writeFile(`${out}checks.json`,JSON.stringify({errors,httpErrors,checks},null,2));
console.log(JSON.stringify({errors,httpErrors,overflow:checks.filter(c=>c.overflow),screenshots:checks.filter(c=>c.width).length}));
await browser.close();
