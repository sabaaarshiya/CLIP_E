import { get } from '@vercel/blob';
import { cleanDeviceId, getDb } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  try {
    const device = cleanDeviceId(req.query.device, 'camera-01');
    const db = getDb();

    const q = await db.query(
      `select image_url, frame_seq, time
       from camera_telemetry
       where device_id = $1 and image_url is not null
       order by time desc
       limit 1`,
      [device]
    );

    if (!q.rowCount) {
      return res.status(404).json({ error: 'No camera frame yet' });
    }

    const latest = q.rows[0];
    const blob = await get(latest.image_url, {
      access: 'private',
      useCache: false,
    });

    if (!blob || blob.statusCode !== 200) {
      return res.status(404).json({ error: 'Latest camera frame is unavailable' });
    }

    res.setHeader('Content-Type', blob.blob.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Frame-Seq', String(Number(latest.frame_seq || 0)));
    res.setHeader('X-Latest-Frame-At', new Date(latest.time).toISOString());

    const reader = blob.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  } catch (e) {
    console.error('camera latest failed', e);
    return res.status(500).json({ error: e?.message || 'Camera unavailable' });
  }
}
