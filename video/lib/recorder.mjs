// Frame-accurate screen recorder built on the Chrome DevTools screencast.
// Frames are written as JPEGs with their compositor timestamps so the renderer
// can rebuild a constant-frame-rate video regardless of capture jitter.
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

export async function startRecording(page, outDir, { width, height, quality = 92 } = {}) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const session = await page.context().newCDPSession(page);
  const frames = [];
  const pending = new Set();
  let index = 0;

  session.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const name = `f${String(index++).padStart(6, '0')}.jpg`;
    frames.push({ name, t: metadata.timestamp });
    const write = writeFile(path.join(outDir, name), Buffer.from(data, 'base64'));
    pending.add(write);
    write.finally(() => pending.delete(write));
    session.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });

  await session.send('Page.startScreencast', {
    format: 'jpeg',
    quality,
    maxWidth: width,
    maxHeight: height,
    everyNthFrame: 1,
  });

  return {
    frames,
    async stop() {
      const end = Date.now() / 1000;
      await session.send('Page.stopScreencast').catch(() => {});
      await Promise.all(pending);
      // The screencast only emits frames on change; hold the last one until stop.
      if (frames.length && end > frames.at(-1).t) frames.push({ name: frames.at(-1).name, t: end });
      await writeFile(path.join(outDir, 'frames.json'), JSON.stringify(frames));
      return frames;
    },
  };
}
