Deno.serve(() => new Response(JSON.stringify({ ok: true }), {
  headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
}));
