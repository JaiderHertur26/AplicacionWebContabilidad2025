import { Redis } from "@upstash/redis";

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  try {
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
      } catch {
        body = {};
      }

      await redis.set("localstorage_snapshot", JSON.stringify(body));

      return new Response(
        JSON.stringify({ ok: true, message: "Sincronizado" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // GET → Cargar snapshot
    if (method === "GET") {
      let raw = null;
      let data = {};

      try {
        raw = await redis.get("localstorage_snapshot");

        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch (e) {
            // ❗ Si está corrupto → limpiar Upstash
            await redis.del("localstorage_snapshot");
            data = {};
          }
        }
      } catch (e) {
        data = {};
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Error interno en /api/sync",
        details: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
