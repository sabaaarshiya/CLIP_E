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

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({
      ok: true,
      device_id: device,
      frame_seq: Number(q.rows[0].frame_seq || 0),
      latest_frame_at: q.rows[0].time,
      image_url: q.rows[0].image_url,
    });
  } catch (e) {
    console.error('camera latest failed', e);
    return res.status(500).json({ error: e?.message || 'Camera unavailable' });
  }
}
