// Joins the recorded clips (in SCENES order) with short crossfades into the final MP4.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { run } from './lib/encode.mjs';
import { SCENES } from './scenes/index.mjs';

const FADE = 0.6;
// Slightly faster playback keeps the cut near three minutes without rushing the UI.
const SPEED = 1.12;
const OUT = 'out/marea-demo.mp4';

const clips = SCENES.map((scene) => `out/clips/${scene.name}.mp4`);
const missing = clips.filter((clip) => !existsSync(clip));
if (missing.length) {
  console.error(`Missing clips, record them first: ${missing.join(', ')}`);
  process.exit(1);
}

const duration = (file) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
const durations = clips.map((clip) => duration(clip) / SPEED);

const filters = clips.map((_, i) => `[${i}:v]setpts=PTS/${SPEED},fps=30[s${i}]`);
let previous = '[s0]';
let elapsed = durations[0];
for (let i = 1; i < clips.length; i++) {
  const label = i === clips.length - 1 ? '[joined]' : `[x${i}]`;
  const offset = (elapsed - FADE).toFixed(3);
  filters.push(`${previous}[s${i}]xfade=transition=fade:duration=${FADE}:offset=${offset}${label}`);
  previous = label;
  elapsed += durations[i] - FADE;
}
const total = elapsed;
filters.push(
  `${clips.length > 1 ? '[joined]' : '[s0]'}fade=t=in:st=0:d=0.5,fade=t=out:st=${(total - 1).toFixed(3)}:d=1,format=yuv420p[v]`,
);

await run('ffmpeg', [
  '-y',
  ...clips.flatMap((clip) => ['-i', clip]),
  '-filter_complex', filters.join(';'),
  '-map', '[v]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-r', '30',
  '-movflags', '+faststart',
  OUT,
]);

const minutes = Math.floor(total / 60);
const seconds = Math.round(total % 60).toString().padStart(2, '0');
console.log(`${OUT}: ${minutes}:${seconds} from ${clips.length} clips`);
