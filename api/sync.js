// /api/sync.js
import { Redis } from "@upstash/redis";

// Cambiado a Node.js runtime para que funcione en Vercel
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
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
        body = req.body || {};
        if (typeof body === "string") body = JSON.parse(body);
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
        return res.status(400).json({
          ok: false,
          error: "Blindaje: No se guardó — snapshot vacío o sin 'companies'.",
        });
      }

      // Guardar snapshot seguro
      await redis.set(
        "localstorage_snapshot",
        JSON.stringify({ companies: body.companies })
      );

      return res.status(200).json({
        ok: true,
        message: "Snapshot guardado correctamente",
      });
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

      return res.status(200).json(data);
    }

    // ============================================
    // 📌 Otros métodos NO permitidos
    // ============================================
    return res.status(405).json({ error: "Método no permitido" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
