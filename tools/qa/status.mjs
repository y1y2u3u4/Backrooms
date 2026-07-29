import { chromium } from '@playwright/test';
const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage']});
const page = await browser.newPage({viewport:{width:400,height:225}});
const logs=[]; page.on('console',m=>logs.push(`[${m.type()}] ${m.text().slice(0,300)}`));
page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:4180/?quality=low&qa=1',{waitUntil:'domcontentloaded'});
await page.waitForFunction('window.ANNEX_READY===true||window.ANNEX_ERROR',{timeout:400000});
const s = await page.evaluate(()=>{
  const g=window.ANNEX;
  for(let i=0;i<20;i++) g.renderOnce(1/60);
  return {
    err: window.ANNEX_ERROR||null,
    status: g.status(),
    spawn: g.world?.spawn, zoneKeys: Object.keys(g.world?.zones||{}),
    playerPos: g.player.position.toArray().map(n=>+n.toFixed(2)),
    fixtures: g.rig.fixtures.length,
    lit: g.rig.fixtures.filter(f=>f.level>0.05).length,
    firstFixture: g.rig.fixtures[0] ? {p:g.rig.fixtures[0].group.position.toArray().map(n=>+n.toFixed(2)), level:+g.rig.fixtures[0].level.toFixed(3), circuit:g.rig.fixtures[0].circuit} : null,
    circuits: [...g.rig.circuits.entries()].map(([k,v])=>[k,+v.level.toFixed(2)]),
    ambient: {i:+g.rig.ambient.intensity.toFixed(3)},
    floors: g.collision.floors.length, boxes: g.collision.boxes.length,
    info: JSON.parse(JSON.stringify(g.engine.renderer.info.render)),
    memory: JSON.parse(JSON.stringify(g.engine.renderer.info.memory)),
    sceneChildren: g.engine.scene.children.length,
    overlayChildren: g.engine.overlayScene.children.length,
    worldRootChildren: g.world?.root?.children?.length ?? -1,
    camPos: g.engine.camera.position.toArray().map(n=>+n.toFixed(2)),
    grade: { fade:g.engine.grade.uniforms.uFade.value, flash:g.engine.grade.uniforms.uFlash.value, exp:g.engine.grade.uniforms.uExposure.value, auto:g.engine.grade.uniforms.uAutoExposure.value },
  };
});
console.log(JSON.stringify(s,null,1));
await page.evaluate(()=>{ for(let i=0;i<10;i++) window.ANNEX.renderOnce(1/60); });
await page.screenshot({path:'docs/captures/status.png', timeout:180000});
console.log('--- logs ---'); console.log(logs.join('\n'));
await browser.close(); process.exit(0);
