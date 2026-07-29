import { chromium } from '@playwright/test';
const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage']});
const page = await b.newPage({viewport:{width:320,height:180}});
await page.goto('http://127.0.0.1:4180/?quality=low&qa=1',{waitUntil:'domcontentloaded'});
await page.waitForFunction('window.ANNEX_READY===true||window.ANNEX_ERROR',{timeout:400000});
const r = await page.evaluate(()=>{
  const g=window.ANNEX;
  for(let i=0;i<10;i++) g.renderOnce(1/60);
  const cam=g.engine.camera.position;
  const fs=g.rig.fixtures.map(f=>({
    d:+f.distToCam.toFixed(1), lvl:+f.level.toFixed(3), vis:f.light.visible,
    inten:+f.light.intensity.toFixed(2), circ:f.circuit, type:f.type,
    y:+f.group.position.y.toFixed(2), parentVis:f.group.visible,
    inScene: !!f.group.parent,
  })).sort((a,b)=>a.d-b.d);
  return { maxActive:g.rig.maxActiveLights, cam:cam.toArray().map(n=>+n.toFixed(1)),
    nearest: fs.slice(0,6), visCount: fs.filter(f=>f.vis).length };
});
console.log(JSON.stringify(r,null,1));
await b.close(); process.exit(0);
