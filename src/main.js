import { Game } from './Game.js';
import { createLoading } from './ui/Loading.js';

/**
 * Bootstrap. Deliberately thin: everything interesting lives in Game.js.
 *
 * The loading screen is the UI subsystem's, mounted before boot so the player
 * sees the in-fiction job docket from the first frame rather than a placeholder
 * that gets swapped out. `#boot-veil` stays until the first real frame is
 * presented so the browser never flashes white.
 */

const canvas = document.getElementById('view');
const uiRoot = document.getElementById('ui-root');
const veil = document.getElementById('boot-veil');
const qa = new URLSearchParams(location.search).get('qa') === '1';

const loading = createLoading({});
uiRoot.appendChild(loading.node);
loading.show();

const game = new Game({ canvas, uiRoot });
window.ANNEX = game;

game.boot((p, msg) => loading.progress(p, msg))
  .then(async () => {
    if (qa) {
      // QA drives frames itself and needs the rAF loop running (the canvas
      // readback wants a rendered frame), but no menu, no fade, no chrome.
      loading.dispose();
      veil?.remove();
      game.start();
      window.ANNEX_READY = true;
      return;
    }
    if (veil) veil.style.opacity = '0';
    game.start();
    await loading.finish();
    loading.dispose();
    veil?.remove();
    if (game.ui?.show) game.ui.show('title');
    else game.state = 'play';
    window.ANNEX_READY = true;
  })
  .catch((err) => {
    console.error(err);
    loading.fail?.(err);
    window.ANNEX_ERROR = String((err && err.stack) || err);
  });

export default game;
