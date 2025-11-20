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

  // POST → guardar snapshot
  if (method === "POST") {
    const body = await req.json();
    await redis.set("localstorage_snapshot", body);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "LocalStorage sincronizado",
      }),
      { status: 200 }
    );
  }

  // GET → obtener snapshot
  if (method === "GET") {
    const data = await redis.get("localstorage_snapshot");

    return new Response(JSON.stringify(data || {}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Método no permitido
  return new Response(
    JSON.stringify({ error: "Método no permitido" }),
    { status: 405 }
  );
}
