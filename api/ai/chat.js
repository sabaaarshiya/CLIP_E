import { CLIP_E_SYSTEM_PROMPT, buildClipEContext } from './project-context.js';

function validImageDataUrl(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:image\/(?:jpeg|jpg|png|webp);base64,(.+)$/i);
  if (!match) return null;
  // Keep the inline frame small enough for a fast conversational request.
  if (match[1].length > 8_000_000) return null;
  return value;
}

function extractResponseText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const chunks = [];
  for (const item of response?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join('').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI is not configured' });
  }

  try {
    const { message, transcript, context, frameDataUrl } = req.body || {};
    const spokenInput = String(transcript || message || '').trim();
    if (!spokenInput) return res.status(400).json({ error: 'Missing user speech/text' });

    const clipEContext = buildClipEContext(context || {});
    const content = [];

    const frame = validImageDataUrl(frameDataUrl);
    if (frame) {
      content.push({
        type: 'input_image',
        image_url: frame,
        detail: 'low',
      });
      content.push({
        type: 'input_text',
        text:
          'This is a current laptop-camera frame from the haircut interaction. Use it only as supplemental visual context under the VISION RULES in your instructions.',
      });
    }

    content.push({
      type: 'input_text',
      text: JSON.stringify({
        barberSpeech: spokenInput,
        clipEContext,
      }),
    });

    const model = String(process.env.OPENAI_MODEL || 'gpt-5.6-luna').trim().toLowerCase();
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        instructions: CLIP_E_SYSTEM_PROMPT,
        input: [{ role: 'user', content }],
        max_output_tokens: 180,
        reasoning: { effort: 'low' },
      }),
    });

    const j = await r.json();
    if (!r.ok) throw Error(j?.error?.message || 'OpenAI request failed');

    const text = extractResponseText(j);
    return res.status(200).json({
      text: text || 'I’m here. What would you like to know about your cut?',
      usedVisualContext: Boolean(frame),
      model,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
