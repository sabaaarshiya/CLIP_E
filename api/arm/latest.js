import { cleanDeviceId, getDb } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const device = cleanDeviceId(req.query.device, 'arm-01');
    const db = getDb();

    const q = await db.query(
      `select device_id, online, last_seen, payload
       from device_state
       where device_id = $1 and device_type = 'arm'
       limit 1`,
      [device]
    );

    if (!q.rowCount) {
      return res.status(200).json({
        online: false,
        device,
        last_seen: null,
        payload: null,
      });
    }

    const row = q.rows[0];
    const age = Date.now() - new Date(row.last_seen).getTime();

    return res.status(200).json({
      online: Boolean(row.online) && age < 7000,
      device: row.device_id,
      last_seen: row.last_seen,
      age_ms: age,
      payload: row.payload || {},
    });
  } catch (e) {
    console.error('arm latest failed', e);
    return res.status(200).json({
      online: false,
      error: e?.message || 'Arm status unavailable',
    });
  }
}
