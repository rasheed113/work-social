const MODEL_PATH = '/api/ai-model/qwen2.5-0.5b-instruct-q4_k_m.gguf';
const MODEL_ORIGIN = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === MODEL_PATH) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD' },
        });
      }

      const upstreamHeaders = new Headers();
      const range = request.headers.get('Range');
      if (range) upstreamHeaders.set('Range', range);

      let upstream;
      try {
        upstream = await fetch(MODEL_ORIGIN, {
          method: request.method,
          headers: upstreamHeaders,
          redirect: 'follow',
        });
      } catch (error) {
        return new Response('Model origin unavailable', {
          status: 502,
          headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      }

      const headers = new Headers(upstream.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag');

      return new Response(request.method === 'HEAD' ? null : upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
