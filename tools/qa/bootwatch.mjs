import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const PORT = process.argv[2] || '4181';
const s = spawn('npx', ['vite','preview','--host','127.0.0.1','--port',PORT], {stdio:'ignore'});
await new Promise(r=>setTimeout(r,4000));
const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage']});
const page = await b.newPage({viewport:{width:320,height:180}});
page.on('pageerror',e=>console.log('[pageerror]',e.message.slice(0,300)));
page.on('console',m=>{ if(m.type()!=='info') console.log(`[${m.type()}]`, m.text().slice(0,250)); });
const t0=Date.now();
await page.goto(`http://127.0.0.1:${PORT}/?quality=low&qa=1`,{waitUntil:'domcontentloaded'});
for(let i=0;i<90;i++){
  await new Promise(r=>setTimeout(r,4000));
  const st = await page.evaluate(()=>({
    ready: !!window.ANNEX_READY, err: window.ANNEX_ERROR||null,
    msg: document.getElementById('load-msg')?.textContent||'',
    bar: document.getElementById('load-bar')?.style.width||'',
  })).catch(e=>({evalErr:String(e).slice(0,120)}));
  console.log(`t+${((Date.now()-t0)/1000).toFixed(0)}s ${JSON.stringify(st)}`);
  if(st.ready||st.err) break;
}
await b.close(); s.kill(); process.exit(0);
