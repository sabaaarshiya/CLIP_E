import { getDb } from '../../lib/db.js';

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
    const db = getDb();

    await db.query(
      `update arm_commands
       set state = $1,
           result = $2::jsonb,
           completed_at = now()
       where id = $3`,
      [
        body.ok ? 'done' : 'failed',
        JSON.stringify({
          ok: Boolean(body.ok),
          message: body.message || '',
          mode: body.mode || '',
        }),
        body.command_id,
      ]
    );

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('arm ack failed', e);
    return res.status(500).json({ error: e?.message || 'Ack failed' });
  }
}
