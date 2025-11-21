// /api/sync.js
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

    // ============================================
    // POST → Guardar snapshot completo
    // ============================================
    if (method === "POST") {
      let body = {};

      try {
        body = await req.json();
      } catch {
        body = {};
      }

      await redis.set("localstorage_snapshot", JSON.stringify(body));

      return new Response(
        JSON.stringify({
          success: true,
          message: "Snapshot sincronizado",
          saved_data: body,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // GET → Recuperar snapshot existente
    // ============================================
    if (method === "GET") {
      let raw = await redis.get("localstorage_snapshot");

      if (!raw) {
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Si está corrupto → limpiar Upstash
      try {
        raw = JSON.parse(raw);
      } catch {
        await redis.del("localstorage_snapshot");
        raw = {};
      }

      return new Response(JSON.stringify(raw), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Métodos no permitidos
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      { status: 405 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Error interno",
        details: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
