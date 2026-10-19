// The timeout covers the response body as well as connection establishment.
export async function compileRemoteWasm(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { mode: 'cors', signal: controller.signal });
    if (!response.ok) throw new Error(`WASM returned HTTP ${response.status}`);
    if (typeof WebAssembly.compileStreaming === 'function' &&
        response.headers.get('content-type')?.split(';')[0].trim() === 'application/wasm') {
      return await WebAssembly.compileStreaming(response);
    }
    return await WebAssembly.compile(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}
