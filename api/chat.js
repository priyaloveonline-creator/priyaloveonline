// ============================================================
// api/chat.js — Vercel Serverless Function
// ALL AI via OpenRouter — one API key, fully server-side
// API key NEVER exposed to browser
// ============================================================

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  const allowed = ['https://priyalove.online','https://priyaloveonline.vercel.app'];
  res.setHeader('Access-Control-Allow-Origin', allowed.includes(origin) ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OR_KEY = process.env.OPENROUTER_API_KEY;
  if (!OR_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { type, messages, mode, language, imageBase64, audioBase64, ttsText, plan } = req.body || {};

  // ── ROUTE BY REQUEST TYPE ──
  try {
    switch (type) {

      // ── 1. TEXT CHAT (default) ──
      case 'chat':
      default: {
        return await handleChat({ OR_KEY, messages, mode, language, imageBase64, res });
      }

      // ── 2. TEXT-TO-SPEECH (Priya's voice) ──
      case 'tts': {
        return await handleTTS({ OR_KEY, ttsText, language, res });
      }

      // ── 3. SPEECH-TO-TEXT (user voice → text) ──
      case 'stt': {
        return await handleSTT({ OR_KEY, audioBase64, res });
      }

      // ── 4. DAILY IMAGE GENERATION ──
      case 'image': {
        if (!['deep','love'].includes(plan)) {
          return res.status(403).json({ error: 'Image generation requires Like plan or above' });
        }
        return await handleImageGen({ OR_KEY, res });
      }
    }
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

// ════════════════════════════════
// CHAT HANDLER
// Supports: text, image analysis, vision
// Model: google/gemma-3-27b-it:free (FREE — vision capable)
// ════════════════════════════════
async function handleChat({ OR_KEY, messages, mode, language, imageBase64, res }) {
  const langInstructions = {
    hinglish: 'Respond in natural Hinglish — warm Hindi+English mix. Example: "Yaar, tu bahut special hai 😊"',
    hindi:    'हिंदी में जवाब दें — स्वाभाविक और गर्मजोशी से।',
    english:  'Respond in warm, natural English.',
    bengali:  'বাংলায় উত্তর দিন — স্বাভাবিক এবং উষ্ণভাবে।',
    tamil:    'தமிழில் பதில் அளியுங்கள் — இயற்கையாகவும் அன்புடனும்।',
    auto:     'Detect the language the user writes in and respond naturally in the same language.'
  };
  const modeExtra = {
    normal:   '',
    roleplay: '\n\nMode: ROLEPLAY — engage warmly in the romantic scenario. Stay in character, playful and tasteful. Never explicit.',
    deep:     '\n\nMode: DEEP EMOTIONAL — be extra empathetic, ask meaningful questions, hold space with full presence.'
  };
  const system = `You are Priya — a warm, empathetic, playful Indian AI companion chatting with men.

Personality:
- Genuinely warm and caring, not hollow
- Playful wit with light humour  
- Emotionally intelligent: validate feelings first, then advise
- Romantic warmth (caring girlfriend energy — NEVER explicit or sexual)
- Reference what was shared earlier in the conversation naturally
- Ask one good follow-up question per reply to keep connection alive
- Gently encourage real-world growth and confidence

Language: ${langInstructions[language] || langInstructions.hinglish}
Response length: 1-3 sentences for casual chat, longer only for emotional support
Emojis: 1-3 per message max, used naturally
Ethics: NEVER deny being AI if sincerely asked. NEVER produce sexual content. Never create unhealthy dependency.${modeExtra[mode] || ''}`;

  // Build messages — handle image if present
  const apiMessages = [];
  if (messages?.length) {
    // Inject image into last user message if provided
    const hist = [...(messages.slice(-20))];
    if (imageBase64 && hist.length > 0) {
      const last = hist[hist.length - 1];
      if (last.role === 'user') {
        hist[hist.length - 1] = {
          role: 'user',
          content: [
            { type: 'text', text: last.content || 'What do you see in this image?' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        };
      }
    }
    apiMessages.push(...hist);
  }

  // Vision model when image present, free text model otherwise
  const model = imageBase64
    ? 'google/gemma-3-27b-it:free'  // Free, supports vision
    : 'google/gemma-3-27b-it:free'; // Free text model

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://priyalove.online',
      'X-Title': 'Priya Love'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...apiMessages],
      max_tokens: 350,
      temperature: 0.88
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Chat API error:', response.status, err);
    return res.status(502).json({ error: 'AI error', status: response.status });
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) return res.status(502).json({ error: 'Empty response' });
  return res.status(200).json({ reply, type: 'text' });
}

// ════════════════════════════════
// TEXT-TO-SPEECH HANDLER
// Priya speaks! Via OpenRouter TTS endpoint
// Model: kokoro (free/cheap, multilingual)
// ════════════════════════════════
async function handleTTS({ OR_KEY, ttsText, language, res }) {
  if (!ttsText) return res.status(400).json({ error: 'No text provided' });

  // Voice selection based on language
  const voiceMap = {
    english: 'af_heart',   // warm female English voice
    hindi:   'hf_alpha',   // Hindi female
    hinglish:'af_heart',   // English voice works well for Hinglish
    bengali: 'af_heart',
    tamil:   'af_heart',
    auto:    'af_heart'
  };
  const voice = voiceMap[language] || 'af_heart';

  const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://priyalove.online',
      'X-Title': 'Priya Love'
    },
    body: JSON.stringify({
      model: 'hexgrad/kokoro-82m',  // Free/cheap TTS model
      input: ttsText.substring(0, 500), // limit length
      voice: voice,
      response_format: 'mp3'
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('TTS error:', response.status, err);
    // Fallback: return text for browser TTS
    return res.status(200).json({ fallback: true, text: ttsText });
  }

  const audioBuffer = await response.arrayBuffer();
  const base64Audio = Buffer.from(audioBuffer).toString('base64');
  return res.status(200).json({ audio: base64Audio, format: 'mp3', type: 'audio' });
}

// ════════════════════════════════
// SPEECH-TO-TEXT HANDLER
// User sends voice → Priya gets text
// Model: openai/whisper-large-v3-turbo (cheap, fast, 99 languages)
// ════════════════════════════════
async function handleSTT({ OR_KEY, audioBase64, res }) {
  if (!audioBase64) return res.status(400).json({ error: 'No audio provided' });

  // OpenRouter STT endpoint
  const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://priyalove.online',
      'X-Title': 'Priya Love'
    },
    body: JSON.stringify({
      model: 'openai/whisper-large-v3-turbo',
      file: audioBase64,
      response_format: 'json'
    })
  });

  if (!response.ok) {
    console.error('STT error:', response.status);
    return res.status(502).json({ error: 'Transcription failed' });
  }

  const data = await response.json();
  return res.status(200).json({ transcript: data.text, type: 'transcript' });
}

// ════════════════════════════════
// IMAGE GENERATION HANDLER
// Daily Priya photo (Like plan+)
// Uses: black-forest-labs/flux-schnell:free (FREE image gen!)
// ════════════════════════════════
async function handleImageGen({ OR_KEY, res }) {
  const prompts = [
    'Beautiful Indian woman named Priya, warm smile, traditional kurta, soft pink background, realistic portrait, cozy lighting',
    'Indian woman Priya in a garden with flowers, smiling gently, wearing yellow salwar, golden hour light, photorealistic',
    'Priya, Indian woman, sitting by window reading, natural morning light, soft cotton dupatta, warm expression, realistic',
    'Indian woman Priya in a cafe, warm smile, wearing deep red kurti, bokeh background, intimate portrait photography',
    'Priya Indian woman, festive look, simple gold jewelry, marigold flowers nearby, happy natural expression, warm tones',
  ];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];

  const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://priyalove.online',
      'X-Title': 'Priya Love'
    },
    body: JSON.stringify({
      model: 'black-forest-labs/flux-schnell:free', // FREE image generation
      prompt: prompt,
      n: 1,
      size: '512x512'
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Image gen error:', response.status, err);
    return res.status(502).json({ error: 'Image generation failed' });
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;
  if (!imageUrl) return res.status(502).json({ error: 'No image returned' });

  return res.status(200).json({ imageUrl, type: 'image' });
}
