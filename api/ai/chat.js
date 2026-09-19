import { CLIP_E_SYSTEM_PROMPT, buildClipEContext } from './project-context.js';

function imagePartFromDataUrl(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!match) return null;
  const data = match[2];
  // Keep inline requests comfortably below Gemini's overall request-size limit.
  if (data.length > 8_000_000) return null;
  return {
    inlineData: {
      mimeType: match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase(),
      data,
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Gemini is not configured' });

  try {
    const { message, transcript, context, frameDataUrl } = req.body || {};
    const spokenInput = String(transcript || message || '').trim();
    if (!spokenInput) return res.status(400).json({ error: 'Missing user speech/text' });

    const clipEContext = buildClipEContext(context || {});
    const parts = [];

    const frame = imagePartFromDataUrl(frameDataUrl);
    if (frame) {
      parts.push(frame);
      parts.push({
        text:
          'This is a current laptop-camera frame from the haircut interaction. Use it only as supplemental visual context under the VISION RULES in your system instructions.',
      });
    }

    parts.push({
      text: JSON.stringify({
        barberSpeech: spokenInput,
        clipEContext,
      }),
    });

    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: CLIP_E_SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 140,
          },
        }),
      }
    );

    const j = await r.json();
    if (!r.ok) throw Error(j?.error?.message || 'Gemini request failed');

    const text = j?.candidates?.[0]?.content?.parts
      ?.map((x) => x.text || '')
      .join('')
      .trim();

    return res.status(200).json({
      text: text || 'I’m here. What would you like to know about your cut?',
      usedVisualContext: Boolean(frame),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
