export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Allow CORS from your domain
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    const { text, voice_id } = await req.json();

    if (!text || !voice_id) {
      return new Response(JSON.stringify({ error: 'Missing text or voice_id' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    const EL_KEY  = 'sk_c22ee5d7aa510c2dc294e82212b45b0ab4a5daa0044c23c5';
    const EL_VOICE = voice_id || 'FDQcYNtvPtQjNlTyU3du';

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': EL_KEY,
        },
        body: JSON.stringify({
          text: text.slice(0, 500),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.88,
            style: 0.5,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: err }), {
        status: response.status,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Stream audio back to browser
    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
}
