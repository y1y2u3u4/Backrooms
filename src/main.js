import { Game } from './Game.js';

/**
 * Bootstrap. Deliberately thin: everything interesting lives in Game.js.
 *
 * The boot screen here is a fallback. Once `src/ui/Loading.js` exists the UI
 * subsystem takes the screen over during Game.boot(); until then this keeps the
 * build presentable and, critically, keeps a black frame on screen so the
 * browser never flashes white before the first render.
 */

const canvas = document.getElementById('view');
const uiRoot = document.getElementById('ui-root');
const veil = document.getElementById('boot-veil');

const boot = document.createElement('div');
boot.id = 'boot-screen';
boot.style.cssText = `
  position:fixed; inset:0; display:grid; place-items:center; z-index:200;
  background:#000; color:#8a7134;
  font:300 13px/1.7 'Helvetica Neue', Helvetica, Arial, sans-serif;
  letter-spacing:0.36em; text-transform:uppercase;`;
boot.innerHTML = `
  <div style="text-align:center">
    <div style="font-size:26px;letter-spacing:0.5em;color:#d8b45a;margin-bottom:6px">THE ANNEX</div>
    <div style="font-size:9px;letter-spacing:0.42em;color:#5c4d26;margin-bottom:22px">
      MERIDIAN FACILITIES MANAGEMENT &nbsp;·&nbsp; ANNEX 7
    </div>
    <div id="load-msg" style="opacity:.6;font-size:9.5px">initialising</div>
    <div style="width:240px;height:1px;background:#231e14;margin:20px auto 0">
      <div id="load-bar" style="width:0%;height:100%;background:#d8b45a;transition:width .3s ease"></div>
    </div>
  </div>`;
document.body.appendChild(boot);

const game = new Game({ canvas, uiRoot });
window.ANNEX = game;

const qa = new URLSearchParams(location.search).get('qa') === '1';

game.boot((p, msg) => {
  const bar = document.getElementById('load-bar');
  const m = document.getElementById('load-msg');
  if (bar) bar.style.width = `${Math.round(p * 100)}%`;
  if (m) m.textContent = msg;
}).then(() => {
  game.start();
  if (qa) {
    // QA still needs the rAF loop running (a headless screenshot waits for a
    // compositor commit) but no menu, no fade and no loading chrome. The camera
    // holds still because pointer lock is never taken.
    boot.remove();
    veil?.remove();
    window.ANNEX_READY = true;
    return;
  }
  // If the UI subsystem is present it owns the title screen; otherwise fall
  // straight into play so the build is always testable.
  if (game.ui?.show) game.ui.show('title');
  else game.state = 'play';

  setTimeout(() => {
    boot.style.transition = 'opacity 900ms ease';
    boot.style.opacity = '0';
    if (veil) veil.style.opacity = '0';
    setTimeout(() => { boot.remove(); veil?.remove(); }, 1000);
  }, 200);
  window.ANNEX_READY = true;
}).catch((err) => {
  console.error(err);
  const m = document.getElementById('load-msg');
  if (m) { m.textContent = 'failed: ' + err.message; m.style.color = '#b04a3a'; }
  window.ANNEX_ERROR = String((err && err.stack) || err);
});

export default game;
