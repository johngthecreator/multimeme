interface Env {
  // Add any environment bindings here if needed
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params } = context;
  const path = Array.isArray(params.path) ? params.path.join("/") : params.path || "";
  const hfUrl = `https://huggingface.co/${path}`;

  try {
    const hfResponse = await fetch(hfUrl, {
      headers: {
        "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
      },
    });

    if (!hfResponse.ok) {
      return new Response(`HuggingFace request failed: ${hfResponse.status}`, {
        status: hfResponse.status,
      });
    }

    const response = new Response(hfResponse.body, {
      status: hfResponse.status,
      headers: {
        "Content-Type": hfResponse.headers.get("Content-Type") || "application/octet-stream",
        "Cache-Control": "public, max-age=604800, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });

    return response;
  } catch (error) {
    return new Response(`Proxy error: ${error}`, { status: 500 });
  }
};
