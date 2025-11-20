import { Redis } from "@upstash/redis";

export default async function handler(req, res) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    await redis.set("localstorage_snapshot", body);

    return res.status(200).json({
      ok: true,
      message: "LocalStorage sincronizado en la nube",
    });
  }

  if (req.method === "GET") {
    const data = await redis.get("localstorage_snapshot");
    return res.status(200).json(data || {});
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Método no permitido" });
}
