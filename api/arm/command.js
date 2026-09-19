import { cleanDeviceId, getDb } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.TRIMSYNC_ARM_DEVICE_KEY;
  const supplied = req.headers['x-trimsync-device-key'];
  if (!expected || supplied !== expected) {
    return res.status(401).json({ error: 'Unauthorized arm' });
  }

  const device = cleanDeviceId(req.query.device, 'arm-01');
  const db = getDb();

  try {
    await db.query('BEGIN');

    const q = await db.query(
      `select *
       from arm_commands
       where device_id = $1 and state = 'pending'
       order by created_at asc
       for update skip locked
       limit 1`,
      [device]
    );

    if (!q.rowCount) {
      await db.query('COMMIT');
      return res.status(204).end();
    }

    const row = q.rows[0];

    await db.query(
      `update arm_commands
       set state = 'delivered', delivered_at = now()
       where id = $1`,
      [row.id]
    );

    await db.query('COMMIT');

    return res.status(200).json({
      id: row.id,
      command: row.command,
      args: row.args || {},
    });
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('arm command failed', e);
    return res.status(500).json({ error: e?.message || 'Command fetch failed' });
  }
}
