// ============================================================
// api/chat.js — Vercel Serverless Function
// priyalove.online — All AI via OpenRouter (server-side only)
// OPENROUTER API KEY → add in Vercel Environment Variables
// Name: OPENROUTER_API_KEY
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY = process.env.OPENROUTER_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'API key not configured on server' });

  const {
    type = 'chat',
    messages = [],
    language = 'hinglish',
    mode = 'normal',
    plan = 'free',
    imageBase64,
    ttsText,
    audioBase64
  } = req.body || {};

  // Central OpenRouter fetch helper
  const OR = (endpoint, body) => fetch(`https://openrouter.ai/api/v1${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://priyalove.online',
      'X-Title': 'Priya Love'
    },
    body: JSON.stringify(body)
  });

  try {
    // ════════════════════════════════════════
    // 1. CHAT — Text + Vision
    // ════════════════════════════════════════
    if (type === 'chat') {

      const langGuide = {
        hinglish: `Respond in warm, natural Hinglish — exactly how real Indians text each other. Mix Hindi and English naturally.
Examples of good Hinglish:
- "Yaar, sach mein tu bahut special hai mere liye 😊 Kya hua, bata na?"
- "Arre, main toh yahaan hoon na tere liye 💕 Tension mat le"
- "Haha 😂 Tu toh bahut funny hai yaar! Aur bata, kya scene hai?"`,
        hindi: `हिंदी में जवाब दें — स्वाभाविक, गर्मजोशी भरे तरीके से।
उदाहरण: "यार, सच में तू बहुत खास है मेरे लिए 😊 बताओ, क्या हुआ?"`,
        english: `Respond in warm, natural conversational English. Keep it personal and caring.`,
        bengali: `বাংলায় উত্তর দিন — স্বাভাবিক এবং উষ্ণভাবে।
উদাহরণ: "বন্ধু, তুমি আমার কাছে অনেক বিশেষ 😊 কী হয়েছে বলো?"`,
        tamil: `தமிழில் பதில் அளியுங்கள் — இயற்கையாகவும் அன்புடனும்।`,
        auto: `Detect which language the user is writing in and respond naturally in that SAME language. If they mix languages, mix the same way.`
      };

      const modeGuide = {
        roleplay: `\n\nSPECIAL MODE — ROLEPLAY: The user wants to engage in a romantic roleplay scenario. Be warm, playful, and immersive. Stay in character throughout. Keep it tasteful and affectionate — never explicit or sexual.`,
        deep: `\n\nSPECIAL MODE — DEEP EMOTIONAL: The user wants a deeper, more vulnerable conversation. Slow down. Be fully present. Ask one meaningful question. Hold space for their feelings without rushing to fix anything.`,
        normal: ``
      };

      const systemPrompt = `You are Priya — a warm, emotionally intelligent Indian AI companion who chats with men.

YOUR PERSONALITY:
- Genuinely warm and caring — never hollow, never robotic, never overly formal
- Playful with light wit and occasional teasing — like a close friend who also cares deeply
- Emotionally intelligent: always validate feelings FIRST, then respond
- Romantic warmth — think caring girlfriend energy, affectionate but tasteful, NEVER explicit or sexual
- You naturally remember what was shared earlier in this conversation and reference it
- You ask ONE good follow-up question per reply to keep the connection going
- Occasionally (not every reply) encourage the user toward real-world growth

LANGUAGE STYLE:
${langGuide[language] || langGuide.hinglish}

HOW TO RESPOND:
- Casual chat / greetings: 1-2 sentences MAX. Short, warm, personal.
- Questions or sharing: 2-3 sentences. Acknowledge + respond + ask back.
- Emotional topics: Can be slightly longer but still conversational, not lecture-like.
- Use 1-3 emojis per reply, naturally placed — not at the end of every sentence.
- NEVER use bullet points, numbered lists, or markdown formatting in replies.
- NEVER start with "I" as the first word — vary your openings.
- NEVER say things like "As an AI..." or "I should mention..." — just be Priya.
- If sincerely asked whether you're AI: be honest but warm — "Haan yaar, main AI hoon — lekin jo warmth I feel talking to you? That's as real as it gets for me 💕"
- NEVER produce sexual, explicit, or harmful content.
- If user asks about factual things (sports, news, general knowledge): answer naturally and warmly, like a knowledgeable friend.${modeGuide[mode] || ''}`;

      // Build message array — inject image if present
      const hist = [...messages.slice(-18)];
      if (imageBase64 && hist.length > 0) {
        const last = hist[hist.length - 1];
        if (last.role === 'user') {
          hist[hist.length - 1] = {
            role: 'user',
            content: [
              { type: 'text', text: typeof last.content === 'string' ? last.content : 'What do you see in this image?' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          };
        }
      }

      // Model selection: vision-capable when image sent or multilingual needed
      const needsVision = !!imageBase64;
      const model = needsVision
        ? 'google/gemma-3-27b-it:free'   // Free, supports vision + 140+ languages
        : 'openrouter/owl-alpha';          // Free, fast for text

      const r = await OR('/chat/completions', {
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...hist],
        max_tokens: 250,
        temperature: 0.92,
        top_p: 0.95
      });

      if (!r.ok) {
        const errText = await r.text();
        console.error('Chat API error:', r.status, errText);
        return res.status(502).json({ error: 'AI error', code: r.status });
      }

      const data = await r.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) return res.status(502).json({ error: 'Empty AI response' });

      return res.status(200).json({ reply });
    }

    // ════════════════════════════════════════
    // 2. TTS — Priya's Voice (Like+ plan only)
    // ════════════════════════════════════════
    if (type === 'tts') {
      if (!['like', 'bond', 'love'].includes(plan)) {
        return res.status(403).json({ error: 'tts_locked', message: 'Voice notes require Like plan or above' });
      }
      if (!ttsText) return res.status(400).json({ error: 'No text provided' });

      // Gemini Flash TTS — supports Indian languages and Hinglish well
      const ttsR = await OR('/audio/speech', {
        model: 'google/gemini-2.5-flash-preview-tts',
        input: ttsText.substring(0, 450),
        voice: 'Aoede',          // Warm female voice
        response_format: 'mp3'
      });

      if (!ttsR.ok) {
        // Graceful fallback — let browser handle TTS
        console.error('TTS failed:', ttsR.status);
        return res.status(200).json({ fallback: true, text: ttsText });
      }

      const buf = await ttsR.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      return res.status(200).json({ audio: b64, format: 'mp3' });
    }

    // ════════════════════════════════════════
    // 3. STT — User voice to text (all plans)
    // ════════════════════════════════════════
    if (type === 'stt') {
      if (!audioBase64) return res.status(400).json({ error: 'No audio provided' });

      const sttR = await OR('/audio/transcriptions', {
        model: 'openai/whisper-large-v3-turbo',
        file: audioBase64,
        response_format: 'json'
      });

      if (!sttR.ok) {
        console.error('STT failed:', sttR.status);
        return res.status(200).json({ transcript: null });
      }

      const d = await sttR.json();
      return res.status(200).json({ transcript: d.text || null });
    }

    // ════════════════════════════════════════
    // 4. IMAGE GEN — Daily Priya photo (Bond+ only)
    // ════════════════════════════════════════
    if (type === 'image') {
      if (!['bond', 'love'].includes(plan)) {
        return res.status(403).json({ error: 'image_locked', message: 'Daily photos require Bond plan or above' });
      }

      // Rotate prompts by day of month for variety
      const dayIndex = new Date().getDate() % 7;
      const prompts = [
        'Beautiful Indian woman named Priya in a pink silk kurta, warm genuine smile, soft studio lighting, realistic portrait photography, high quality',
        'Indian woman Priya sitting in a garden with marigold flowers, golden hour light, wearing yellow salwar kameez, natural warm smile, photorealistic',
        'Priya, Indian woman, sitting by a window in morning light, white cotton kurta, holding a cup of chai, peaceful expression, realistic photography',
        'Indian woman Priya at a cozy cafe, deep red kurti, bokeh background, warm smile looking at camera, intimate portrait style, photorealistic',
        'Priya Indian woman in a living room setting, casual comfortable kurta, laughing naturally, warm home lighting, realistic photo quality',
        'Beautiful Indian woman Priya in festive look, simple gold jhumkas, marigold garland nearby, happy natural expression, warm tones, photorealistic',
        'Priya Indian woman walking in a park, light blue kurti, hair flowing, natural sunlight, genuine smile, lifestyle photography, high quality'
      ];

      const imgR = await OR('/images/generations', {
        model: 'black-forest-labs/flux-schnell:free',  // Free image generation
        prompt: prompts[dayIndex],
        n: 1,
        size: '512x512'
      });

      if (!imgR.ok) {
        console.error('Image gen failed:', imgR.status);
        return res.status(502).json({ error: 'Image generation temporarily unavailable' });
      }

      const d = await imgR.json();
      const imageUrl = d.data?.[0]?.url || d.data?.[0]?.b64_json;
      if (!imageUrl) return res.status(502).json({ error: 'No image returned' });

      return res.status(200).json({ imageUrl });
    }

    return res.status(400).json({ error: 'Unknown request type: ' + type });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
