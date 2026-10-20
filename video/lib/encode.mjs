// Turns a timestamped frame folder into a constant-frame-rate H.264 clip.
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

export function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}\n${stderr.slice(-3000)}`)),
    );
  });
}

export async function encodeFrames(frameDir, outFile, { fps = 30 } = {}) {
  // The screencast can deliver frames slightly out of order; play them in capture order.
  const frames = JSON.parse(await readFile(path.join(frameDir, 'frames.json'), 'utf8')).sort((a, b) => a.t - b.t);
  const lines = ['ffconcat version 1.0'];
  frames.forEach((frame, i) => {
    const next = frames[i + 1];
    const duration = next ? Math.max(0.001, next.t - frame.t) : 1 / fps;
    lines.push(`file '${frame.name}'`, `duration ${duration.toFixed(6)}`);
  });
  lines.push(`file '${frames.at(-1).name}'`);
  const listFile = path.join(frameDir, 'list.ffconcat');
  await writeFile(listFile, lines.join('\n'));

  await run('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-fps_mode', 'cfr', '-r', String(fps),
    '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-movflags', '+faststart',
    outFile,
  ]);
  const seconds = frames.at(-1).t - frames[0].t;
  return { frames: frames.length, seconds };
}
