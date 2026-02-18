interface Env {
  // Add any environment bindings here if needed
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params } = context;

  // For PagesFunction, params.path is usually the capture group after route
  let path = Array.isArray(params.path) ? params.path.join("/") : (params.path || "");

  // Clean up any leading slashes or double-slashes
  path = path.replace(/^\/+/, '');

  // Build HF URL - path should be "Xenova/modnet/resolve/main/..."
  const hfUrl = `https://huggingface.co/${path}`;

  console.log(`Proxying: ${path} → ${hfUrl}`); // Debug log

  try {
    const hfResponse = await fetch(hfUrl, {
      method: request.method,  // Forward original method (GET/HEAD)
      headers: {
        ...Object.fromEntries(request.headers.entries()),  // Forward ALL headers
        "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
      },
      // Forward body for POST/PUT (though transformers.js mostly uses GET)
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    // Return HF response EXACTLY (status, headers, body)
    const response = new Response(hfResponse.body, hfResponse);

    // ONLY add CORS/cache - don't override HF headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', '*');
    response.headers.set('Cache-Control', 'public, max-age=604800, immutable');

    return response;
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(`Proxy error: ${error}`, { status: 500 });
  }
};
