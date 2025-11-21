// /api/sync.js
import { Redis } from "@upstash/redis";

export const config = { runtime: "edge" };

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

      // ❗ PROTECCIÓN CRÍTICA
      if (!body || Object.keys(body).length === 0) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Snapshot vacío — NO se guardó (protección anti borrado)"
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await redis.set("localstorage_snapshot", JSON.stringify(body));

      return new Response(
        JSON.stringify({ ok: true, message: "Snapshot guardado" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // GET → Leer snapshot
    if (method === "GET") {
      const raw = await redis.get("localstorage_snapshot");
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {}; // si está corrupto, no dañamos localStorage
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

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
