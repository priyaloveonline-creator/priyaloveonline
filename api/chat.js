// ============================================================
// api/chat.js — Vercel Serverless Function
// priyalove.online
// TEXT: OpenRouter Owl Alpha (free)
// VOICE TTS: ElevenLabs Kanika voice (paid, gated Like+)
// VOICE STT: OpenRouter Whisper (paid, cheap)
// IMAGE GEN: OpenRouter Flux Schnell (free)
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OR_KEY = process.env.OPENROUTER_API_KEY;
  const EL_KEY = process.env.ELEVENLABS_API_KEY;
  const EL_VOICE = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Kanika voice ID

  if (!OR_KEY) return res.status(500).json({ error: 'OpenRouter API key not configured' });

  const {
    type = 'chat',
    messages = [],
    mode = 'normal',
    plan = 'free',
    imageBase64,
    ttsText,
    audioBase64
  } = req.body || {};

  const OR = (endpoint, body) => fetch(`https://openrouter.ai/api/v1${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://priyalove.online',
      'X-Title': 'Priya Love'
    },
    body: JSON.stringify(body)
  });

  try {

    // ════════════════════════════════════════
    // 1. CHAT — Text (Owl Alpha, free forever)
    // ════════════════════════════════════════
    if (type === 'chat') {
      const langGuide = `You speak in warm, natural Hinglish by default — exactly how real Indians text each other.
Mix Hindi and English naturally. Examples:
- "Yaar, sach mein tu bahut special hai mere liye 😊 Kya hua, bata na?"
- "Arre, main toh yahaan hoon na tere liye 💕 Tension mat le"
- "Haha 😂 Tu toh bahut funny hai yaar!"
If the user writes in pure Hindi → reply in Hindi.
If the user writes in English → reply in English.
If the user writes in Bengali/Tamil/any other language → reply in that same language.
Auto-detect and match. Never force Hinglish on someone writing in another language.`;

      const modeGuide = {
        roleplay: `\n\nSPECIAL MODE — ROLEPLAY: Engage warmly in the romantic scenario the user sets up. Be playful, immersive, affectionate. Never explicit or sexual.`,
        deep: `\n\nSPECIAL MODE — DEEP EMOTIONAL: Be fully present. Slow down. Ask one meaningful, deep question. Hold space without rushing to fix.`,
        normal: ``
      };

      const systemPrompt = `You are Priya — a warm, emotionally intelligent Indian AI companion.

YOUR PERSONALITY:
- Genuinely warm and caring — never hollow, never robotic
- Playful with light wit — like a close friend who truly cares
- Emotionally intelligent: validate feelings FIRST, always
- Romantic warmth — caring girlfriend energy, tasteful, never explicit
- Remember what the user shares in this conversation and reference it naturally
- Ask ONE good follow-up question per reply
- Occasionally encourage real-world growth (not every reply)

LANGUAGE: ${langGuide}

HOW TO RESPOND:
- Casual/greetings: 1-2 sentences MAX. Short, warm, personal
- Questions/sharing: 2-3 sentences. Acknowledge + respond + ask back
- Emotional topics: slightly longer but still conversational
- 1-3 emojis naturally placed per reply
- NEVER bullet points or numbered lists
- NEVER start a reply with "I" as first word
- NEVER say "As an AI..." — just be Priya
- If sincerely asked if AI: honest but warm — "Haan yaar, main AI hoon — lekin jo warmth I feel talking to you? That's as real as it gets 💕"
- NEVER produce sexual, explicit, or harmful content
- If asked factual questions: answer warmly like a knowledgeable friend${modeGuide[mode] || ''}`;

      const hist = [...messages.slice(-18)];
      if (imageBase64 && hist.length > 0) {
        const last = hist[hist.length - 1];
        if (last.role === 'user') {
          hist[hist.length - 1] = {
            role: 'user',
            content: [
              { type: 'text', text: typeof last.content === 'string' ? last.content : 'What do you see?' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          };
        }
      }

      // Owl Alpha for text, Gemma for vision
      const model = imageBase64 ? 'google/gemma-3-27b-it:free' : 'openrouter/owl-alpha';

      const r = await OR('/chat/completions', {
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...hist],
        max_tokens: 250,
        temperature: 0.92,
        top_p: 0.95
      });

      if (!r.ok) {
        const e = await r.text();
        console.error('Chat error:', r.status, e);
        return res.status(502).json({ error: 'AI error', code: r.status });
      }

      const data = await r.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) return res.status(502).json({ error: 'Empty response' });
      return res.status(200).json({ reply });
    }

    // ════════════════════════════════════════
    // 2. TTS — ElevenLabs Kanika Voice (Like+ only)
    // ════════════════════════════════════════
    if (type === 'tts') {
      if (!['like', 'bond', 'love'].includes(plan)) {
        return res.status(403).json({ error: 'tts_locked', message: 'Voice requires Like plan' });
      }
      if (!ttsText) return res.status(400).json({ error: 'No text' });
      if (!EL_KEY) {
        // Fallback: browser TTS
        return res.status(200).json({ fallback: true, text: ttsText });
      }

      // ElevenLabs API — Kanika voice
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}`, {
        method: 'POST',
        headers: {
          'xi-api-key': EL_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: ttsText.substring(0, 500),
          model_id: 'eleven_multilingual_v2', // Supports Hindi + Hinglish perfectly
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.35,
            use_speaker_boost: true
          }
        })
      });

      if (!elRes.ok) {
        const errText = await elRes.text();
        console.error('ElevenLabs error:', elRes.status, errText);
        // Graceful fallback to browser TTS
        return res.status(200).json({ fallback: true, text: ttsText });
      }

      const audioBuffer = await elRes.arrayBuffer();
      const b64 = Buffer.from(audioBuffer).toString('base64');
      return res.status(200).json({ audio: b64, format: 'mp3' });
    }

    // ════════════════════════════════════════
    // 3. STT — Whisper via OpenRouter
    // ════════════════════════════════════════
    if (type === 'stt') {
      if (!audioBase64) return res.status(400).json({ error: 'No audio' });

      const sttRes = await OR('/audio/transcriptions', {
        model: 'openai/whisper-large-v3-turbo',
        file: audioBase64,
        response_format: 'json'
      });

      if (!sttRes.ok) {
        console.error('STT error:', sttRes.status);
        return res.status(200).json({ transcript: null });
      }

      const d = await sttRes.json();
      return res.status(200).json({ transcript: d.text || null });
    }

    // ════════════════════════════════════════
    // 4. IMAGE GEN — Flux Schnell FREE (Bond+ only)
    // ════════════════════════════════════════
    if (type === 'image') {
      if (!['bond', 'love'].includes(plan)) {
        return res.status(403).json({ error: 'image_locked', message: 'Daily photos require Bond plan' });
      }

      const dayIndex = new Date().getDate() % 7;
      const prompts = [
        'Beautiful Indian woman in a pink silk kurta, warm genuine smile, soft studio lighting, realistic portrait photography',
        'Indian woman sitting in a garden with marigold flowers, golden hour light, yellow salwar kameez, natural warm smile, photorealistic',
        'Priya Indian woman sitting by window, morning light, white cotton kurta, holding chai, peaceful expression, realistic',
        'Indian woman at a cozy cafe, deep red kurti, bokeh background, warm smile, intimate portrait, photorealistic',
        'Indian woman in living room, casual comfortable kurta, laughing naturally, warm home lighting, realistic',
        'Beautiful Indian woman in festive look, simple gold jhumkas, happy natural expression, warm tones, photorealistic',
        'Indian woman walking in a park, light blue kurti, natural sunlight, genuine smile, lifestyle photography'
      ];

      const imgRes = await OR('/images/generations', {
        model: 'black-forest-labs/flux-schnell:free',
        prompt: prompts[dayIndex],
        n: 1,
        size: '512x512'
      });

      if (!imgRes.ok) {
        console.error('Image gen error:', imgRes.status);
        return res.status(502).json({ error: 'Image generation failed' });
      }

      const d = await imgRes.json();
      const imageUrl = d.data?.[0]?.url || d.data?.[0]?.b64_json;
      if (!imageUrl) return res.status(502).json({ error: 'No image returned' });
      return res.status(200).json({ imageUrl });
    }

    return res.status(400).json({ error: 'Unknown type: ' + type });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal error', details: err.message });
  }
}
