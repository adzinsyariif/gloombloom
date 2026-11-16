// A working best-game-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. A starting point, not a winner: Block Dodger, a
// plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a title screen,
// score, lives and levels, game over and restart, flat colours and no sound. Build your own game
// (any genre, any library you vendor under game/, or none), put your 3 or 4 PNG or JPEG screenshots
// in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Read-back pass over what was just handed in. The dossier write above is the
// deliverable, but a silent copy mistake (a missing screenshot, a truncated
// game file) would only surface later, in the judge's container. So before
// exiting, walk the output tree once, tally each top-level entry on its own,
// and confirm the dossier is actually there. Nothing is written here; this is
// a report to stdout only, so the bytes under the output dir stay untouched.
function summarizeOutput(outputDir) {
  const tally = new Map();
  const walk = (dir, bucket) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full, bucket);
      } else {
        bucket.files += 1;
        bucket.bytes += statSync(full).size;
      }
    }
  };
  for (const entry of readdirSync(outputDir).sort()) {
    const bucket = { files: 0, bytes: 0 };
    const full = join(outputDir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, bucket);
    } else {
      bucket.files = 1;
      bucket.bytes = statSync(full).size;
    }
    tally.set(entry, bucket);
  }
  if (!tally.has('dossier.json')) {
    throw new Error(`summarizeOutput: dossier.json missing from ${outputDir}`);
  }
  let totalFiles = 0;
  let totalBytes = 0;
  console.log(`hand-in summary for ${outputDir}:`);
  for (const [entry, bucket] of tally) {
    totalFiles += bucket.files;
    totalBytes += bucket.bytes;
    console.log(`  ${entry}: ${bucket.files} file(s), ${bucket.bytes} byte(s)`);
  }
  console.log(`  total: ${totalFiles} file(s), ${totalBytes} byte(s); dossier.json present`);
}

summarizeOutput(out);
