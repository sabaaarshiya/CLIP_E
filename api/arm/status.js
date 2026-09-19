import { cleanDeviceId, getDb } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.TRIMSYNC_ARM_DEVICE_KEY;
  const supplied = req.headers['x-trimsync-device-key'];
  if (!expected || supplied !== expected) {
    return res.status(401).json({ error: 'Unauthorized arm' });
  }

  try {
    const body = req.body || {};
    const device = cleanDeviceId(
      req.headers['x-trimsync-device-id'] || body.device_id,
      'arm-01'
    );

    const j = Array.isArray(body.joint_deg) ? body.joint_deg : [];
    const t = Array.isArray(body.target_deg) ? body.target_deg : [];
    const db = getDb();

    await db.query('BEGIN');
    try {
      await db.query(
        `insert into device_state
          (device_id, device_type, online, last_seen, payload)
         values ($1, 'arm', true, now(), $2::jsonb)
         on conflict (device_id) do update set
           online = true,
           last_seen = now(),
           payload = excluded.payload`,
        [device, JSON.stringify(body)]
      );

      await db.query(
        `insert into arm_telemetry (
          device_id, mode, armed, pca_ready, estop,
          joint_0, joint_1, joint_2, joint_3, joint_4,
          plunger_left, plunger_right,
          target_0, target_1, target_2, target_3, target_4,
          wifi_rssi, payload
        ) values (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,
          $11,$12,
          $13,$14,$15,$16,$17,
          $18,$19::jsonb
        )`,
        [
          device,
          body.mode || 'hold',
          Boolean(body.armed),
          Boolean(body.pca_ready),
          Boolean(body.estop),
          j[0] ?? null, j[1] ?? null, j[2] ?? null, j[3] ?? null, j[4] ?? null,
          j[5] ?? null, j[6] ?? null,
          t[0] ?? null, t[1] ?? null, t[2] ?? null, t[3] ?? null, t[4] ?? null,
          body.wifi_rssi ?? null,
          JSON.stringify(body),
        ]
      );

      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }

    return res.status(200).json({ ok: true, device });
  } catch (e) {
    console.error('arm status failed', e);
    return res.status(500).json({ error: e?.message || 'Status failed' });
  }
}
