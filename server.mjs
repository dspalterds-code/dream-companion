import http from 'node:http';
import { readFile } from 'node:fs/promises';

const PORT = process.env.PORT || 3000;

const system = `You are Dream Companion, a gentle dream-reflection assistant. Help users explore possible personal meanings in dreams without claiming interpretations are scientifically established. Never diagnose, assert hidden trauma, predict events, or suggest a symbol has one universal meaning. Ask thoughtful questions and present interpretations as possibilities rather than facts.`;

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/' && req.method === 'GET') {
    try {
      const html = await readFile(new URL('./index.html', import.meta.url));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (e) {
      console.error('Could not load index.html:', e.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Could not load Dream Companion.');
    }
  }

  if (req.url !== '/api/chat' || req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end('{}');
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw Error('OPENAI_API_KEY is not set');
    }

    let body = '';

    for await (const chunk of req) {
      body += chunk;

      if (body.length > 50000) {
        throw Error('Request too large');
      }
    }

    const parsed = JSON.parse(body);

    const messages = (parsed.messages || [])
      .filter(x =>
        ['user', 'assistant'].includes(x.role) &&
        typeof x.content === 'string'
      )
      .slice(-12)
      .map(x => ({
        role: x.role,
        content: x.content.slice(0, 10000)
      }));

    const upstream = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            ...messages
          ]
        })
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      throw Error(data.error?.message || 'AI request failed');
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });

    return res.end(JSON.stringify({
      reply: data.choices?.[0]?.message?.content || ''
    }));

  } catch (e) {
    console.error('Dream Companion error:', e.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: e.message }));
  }

}).listen(PORT, () => {
  console.log(`Dream Companion server listening on http://localhost:${PORT}`);
});
