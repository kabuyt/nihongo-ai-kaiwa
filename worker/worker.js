// Cloudflare Worker - にほんご かいわ API
// OpenAI APIキーを安全に管理するプロキシ

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/chat') {
        return await handleChat(request, env);
      } else if (url.pathname === '/api/tts') {
        return await handleTTS(request, env);
      } else if (url.pathname === '/api/whisper') {
        return await handleWhisper(request, env);
      } else {
        return new Response('Not found', { status: 404, headers: CORS_HEADERS });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};

async function handleChat(request, env) {
  const body = await request.json();

  // messages のみ受け取り、モデル等はサーバー側で制御
  const { messages } = body;
  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'messages is required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 150,
      temperature: 0.8,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data.error?.message || 'OpenAI API error' }), {
      status: res.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function handleTTS(request, env) {
  const body = await request.json();
  const { input, voice } = body;

  if (!input) {
    return new Response(JSON.stringify({ error: 'input is required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: `[ja] ${input}`,
      voice: voice || 'nova',
      speed: 0.9,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return new Response(JSON.stringify({ error: err.error?.message || 'TTS error' }), {
      status: res.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const audioData = await res.arrayBuffer();
  return new Response(audioData, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'audio/mpeg',
    },
  });
}

async function handleWhisper(request, env) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) {
    return new Response(JSON.stringify({ error: 'file is required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const whisperForm = new FormData();
  whisperForm.append('file', file, file.name || 'audio.webm');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('language', 'ja');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: whisperForm,
  });

  const data = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data.error?.message || 'Whisper error' }), {
      status: res.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
