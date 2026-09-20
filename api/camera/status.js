import { cleanDeviceId, getDb } from '../../lib/db.js';

function cleanSession(v){
  return String(v||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
}

export default async function handler(req, res) {
  try {
    const device = cleanDeviceId(req.query.device, 'camera-01');
    const session = cleanSession(req.query.session);
    const db = getDb();

    const q = session
      ? await db.query(
          `select frame_seq, time, image_url, payload
           from camera_telemetry
           where device_id = $1 and payload->>'session_id' = $2
           order by time desc
           limit 1`,
          [device, session]
        )
      : await db.query(
          `select frame_seq, time, image_url, payload
           from camera_telemetry
           where device_id = $1
           order by time desc
           limit 1`,
          [device]
        );

    if (!q.rowCount) {
      return res.status(200).json({
        online: false,
        frame_seq: 0,
        latest_frame_at: null,
        session_id: session || null,
      });
    }

    const latest = q.rows[0];
    const age = Date.now() - new Date(latest.time).getTime();

    return res.status(200).json({
      online: age < 6000,
      frame_seq: Number(latest.frame_seq || 0),
      latest_frame_at: latest.time,
      image_url: latest.image_url || null,
      role: latest.payload?.role || (device === 'phone-back-01' ? 'back_head' : 'front_side_workspace'),
      session_id: latest.payload?.session_id || null,
    });
  } catch (e) {
    console.error('camera status failed', e);
    return res.status(200).json({ online: false, error: e?.message || 'status failed' });
  }
}
