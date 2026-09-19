import { put } from '@vercel/blob';
import { cleanDeviceId, getDb } from '../../lib/db.js';

export const config = { api: { bodyParser: false } };

async function raw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.TRIMSYNC_CAMERA_DEVICE_KEY;
  const supplied = req.headers['x-trimsync-device-key'];
  if (!expected || supplied !== expected) {
    return res.status(401).json({ error: 'Unauthorized camera' });
  }

  try {
    const device = cleanDeviceId(req.headers['x-trimsync-device-id'], 'camera-01');
    const seq = Number(req.headers['x-trimsync-frame-seq'] || Date.now());
    const jpeg = await raw(req);

    if (!jpeg.length) {
      return res.status(400).json({ error: 'Empty frame' });
    }

    const started = Date.now();

    // On Vercel, @vercel/blob authenticates through the project's connected
    // Blob store using Vercel-managed credentials/OIDC. No long-lived
    // BLOB_READ_WRITE_TOKEN is required in application code.
    const blob = await put(`trimsync/${device}/latest.jpg`, jpeg, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'image/jpeg',
    });

    const uploadMs = Date.now() - started;
    const db = getDb();

    await db.query('BEGIN');
    try {
      await db.query(
        `insert into device_state
          (device_id, device_type, online, last_seen, payload)
         values ($1, 'camera', true, now(), $2::jsonb)
         on conflict (device_id) do update set
           online = true,
           last_seen = now(),
           payload = excluded.payload`,
        [device, JSON.stringify({ frame_seq: seq, image_url: blob.url })]
      );

      await db.query(
        `insert into camera_telemetry
          (device_id, frame_seq, upload_ms, image_url, width, height, payload)
         values ($1, $2, $3, $4, 320, 240, $5::jsonb)`,
        [device, seq, uploadMs, blob.url, JSON.stringify({ bytes: jpeg.length })]
      );

      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }

    return res.status(200).json({
      ok: true,
      device,
      frame_seq: seq,
      image_url: blob.url,
      bytes: jpeg.length,
      upload_ms: uploadMs,
    });
  } catch (e) {
    console.error('camera upload failed', e);
    return res.status(500).json({ error: e?.message || 'Upload failed' });
  }
}
