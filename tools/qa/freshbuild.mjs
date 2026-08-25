/**
 * "Am I about to measure last week's bundle?"
 *
 * WHY THIS IS ITS OWN FILE.
 *
 * `perf.mjs` once returned byte-identical workload numbers across a change that
 * added thirty-six light fixtures, because a `vite preview` left listening from
 * an earlier run was still serving the old `dist/`. That was fixed there and
 * nowhere else, and `capture.mjs` went on checking only that `dist/index.html`
 * EXISTS — which is true of a bundle from any point in history.
 *
 * The cost of that: a duct frame was photographed four times while the zone's
 * lighting was changed underneath it, and it came back byte-identical every
 * time. Four rounds of reasoning were spent on a zone that measured, once the
 * live canvas was finally read, as the brightest in the building.
 *
 * A build is one second. Every harness that boots `dist/` calls this first.
 */
import { stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/** Newest mtime anywhere under `entry`, ignoring node_modules and dotfiles. */
export async function newestMtime(entry) {
  let newest = 0;
  const walk = async (p) => {
    let s;
    try { s = await stat(p); } catch { return; }
    if (s.isDirectory()) {
      for (const name of await readdir(p)) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        await walk(path.join(p, name));
      }
    } else if (s.mtimeMs > newest) newest = s.mtimeMs;
  };
  await walk(entry);
  return newest;
}

/** Source trees whose mtime the bundle is expected to be no older than. */
const SOURCES = ['src', 'index.html', 'public', 'vite.config.js'];

/**
 * Rebuild if any source is newer than the bundle, and SAY SO. Call it before
 * the port check, not inside a "no server yet" branch — a stale preview server
 * still listening is exactly the case such a branch skips.
 *
 * @param {object} [o]
 * @param {boolean} [o.skip]   opt out, for measuring a build kept on purpose
 * @param {string}  [o.reason] verb for the log line ('measuring', 'capturing')
 * @returns {Promise<boolean>} whether it rebuilt
 */
export async function ensureFreshBuild({ skip = false, reason = 'measuring' } = {}) {
  if (skip) return false;
  let src = 0;
  for (const p of SOURCES) src = Math.max(src, await newestMtime(p));
  const built = existsSync('dist/index.html') ? (await stat('dist/index.html')).mtimeMs : 0;
  if (src <= built) return false;
  const age = built ? `${Math.round((src - built) / 1000)} s` : 'no build at all';
  console.log(`dist is behind src (${age}) — rebuilding before ${reason}`);
  const r = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`build failed; refusing to ${reason.replace(/ing$/, '')} a stale bundle`);
    process.exit(1);
  }
  return true;
}

export default ensureFreshBuild;
