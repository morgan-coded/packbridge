export const loader = () =>
  new Response(JSON.stringify({ ok: true, service: "packbridge" }), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
