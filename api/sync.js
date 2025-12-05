// /api/sync.js
import { Redis } from "@upstash/redis";

export const config = { runtime: "edge" };

// Límite máximo recomendado por Upstash (1 MB)
const MAX_SNAPSHOT_SIZE = 950_000; // bytes

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

      // Proteger si el body no es JSON válido
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Error: Body inválido o vacío",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Blindaje: detectar snapshot vacío
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

      // Blindaje extra: no exceder límite de Upstash (1 MB)
      const jsonSnapshot = JSON.stringify({ companies: body.companies });
      if (jsonSnapshot.length > MAX_SNAPSHOT_SIZE) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Snapshot demasiado grande. Reduce datos antes de sincronizar.",
          }),
          { status: 413, headers: { "Content-Type": "application/json" } }
        );
      }

      // Guardar snapshot
      await redis.set("localstorage_snapshot", jsonSnapshot);

      return new Response(
        JSON.stringify({
          ok: true,
          message: "Snapshot guardado correctamente",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // 📌 GET → Leer snapshot (BLINDADO)
    // ============================================
    if (method === "GET") {
      const raw = await redis.get("localstorage_snapshot");
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {}; // Snapshot corrupto → no romper cliente
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ============================================
    // 📌 Métodos no permitidos
    // ============================================
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Error interno en sincronización: " + e.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
