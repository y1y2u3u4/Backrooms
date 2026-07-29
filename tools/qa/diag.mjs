import { chromium } from '@playwright/test';
const b = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage']});
const page = await b.newPage({viewport:{width:400,height:225}});
page.on('pageerror',e=>console.log('[pageerror]',e.message));
await page.goto('http://127.0.0.1:4180/?quality=low&qa=1',{waitUntil:'domcontentloaded'});
await page.waitForFunction('window.ANNEX_READY===true||window.ANNEX_ERROR',{timeout:400000});

const info = await page.evaluate(()=>{
  const g=window.ANNEX; const s=g.engine.scene;
  let visLights=0, spots=0; const sample=[];
  s.traverse(o=>{ if(o.isLight && o.visible){ visLights++; if(o.isSpotLight){ spots++; if(sample.length<3) sample.push({i:+o.intensity.toFixed(2), d:o.distance, pos:o.getWorldPosition(new (window.ANNEX.engine.camera.position.constructor)()).toArray().map(n=>+n.toFixed(1))}); } } });
  // find the mesh in front of the camera
  const meshes=[]; s.traverse(o=>{ if(o.isMesh) meshes.push({n:o.name, mat:o.material?.name, vis:o.visible, vc:o.material?.vertexColors, col:o.material?.color?.getHexString?.()}); });
  return { visLights, spots, sample, meshCount: meshes.length, meshes: meshes.slice(0,10) };
});
console.log(JSON.stringify(info,null,1));

// Test A: crank ambient only
await page.evaluate(()=>{ const g=window.ANNEX; g.rig.ambientTarget.intensity=6; g.rig.ambient.intensity=6; for(let i=0;i<30;i++) g.renderOnce(1/60); });
await page.screenshot({path:'docs/captures/diag_ambient.png', timeout:180000});
console.log('wrote diag_ambient.png');

// Test B: unlit basic material override
await page.evaluate(()=>{
  const g=window.ANNEX; const THREE=g.engine.scene.constructor;
  g.rig.ambient.intensity=0.3; g.rig.ambientTarget.intensity=0.3;
  g.engine.scene.overrideMaterial = null;
  let n=0;
  g.engine.scene.traverse(o=>{ if(o.isMesh && o.material && o.material.map){ o.userData._m=o.material; o.material = new (Object.getPrototypeOf(o.material).constructor)({map:o.material.map}); n++; } });
  window.__n=n;
  for(let i=0;i<20;i++) g.renderOnce(1/60);
});
await page.screenshot({path:'docs/captures/diag_plain.png', timeout:180000});
console.log('wrote diag_plain.png');
await b.close(); process.exit(0);
