import { Redis } from "@upstash/redis";

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const method = req.method;

  // POST → Guardar snapshot
  if (method === "POST") {
    let body = {};

    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }

    // Edge solo acepta strings
    await redis.set("localstorage_snapshot", JSON.stringify(body));

    return new Response(
      JSON.stringify({ ok: true, message: "Sincronizado" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // GET → Leer snapshot
  if (method === "GET") {
    const raw = await redis.get("localstorage_snapshot");
    const data = raw ? JSON.parse(raw) : {};

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ error: "Método no permitido" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}
