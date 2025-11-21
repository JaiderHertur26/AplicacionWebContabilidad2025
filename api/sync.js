// /api/sync.js  (ruta en Vercel)
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

    // -------------------------
    // POST → Guardar snapshot
    // -------------------------
    if (method === "POST") {
      let body = {};

      try {
        body = await req.json();
      } catch {
        body = {};
      }

      // ❗ No guardar snapshots vacíos
      if (!body || Object.keys(body).length === 0) {
        return new Response(
          JSON.stringify({
            ok: false,
            warning: "Snapshot vacío — NO se guardó en Upstash",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await redis.set("localstorage_snapshot", JSON.stringify(body));

      return new Response(
        JSON.stringify({ ok: true, message: "Snapshot guardado", saved: body }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // -------------------------
    // GET → Obtener snapshot
    // -------------------------
    if (method === "GET") {
      let raw = null;
      let data = {};

      try {
        raw = await redis.get("localstorage_snapshot");

        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch (e) {
            // Si está corrupto → limpiar
            await redis.del("localstorage_snapshot");
            data = {};
          }
        }
      } catch {
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

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Error interno en /api/sync",
        details: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
