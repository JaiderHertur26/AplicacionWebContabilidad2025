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

    // ============================================
    // 📌 POST → Guardar snapshot (BLINDADO)
    // ============================================
    if (method === "POST") {
      let body = {};

      try {
        body = await req.json();
      } catch {
        body = {};
      }

      // ❗ BLINDAJE: no permitir guardar snapshots vacíos
      if (
        !body ||
        !body.companies ||
        !Array.isArray(body.companies) ||
        body.companies.length === 0
      ) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Blindaje: No se guardó — snapshot vacío o sin 'companies'.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Guardar snapshot seguro
      await redis.set(
        "localstorage_snapshot",
        JSON.stringify({ companies: body.companies })
      );

      return new Response(
        JSON.stringify({
          ok: true,
          message: "Snapshot guardado correctamente",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // 📌 GET → Leer snapshot
    // ============================================
    if (method === "GET") {
      const raw = await redis.get("localstorage_snapshot");
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {}; // BLINDAJE: si está corrupto → no romper cliente
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ============================================
    // 📌 Otros métodos NO permitidos
    // ============================================
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
