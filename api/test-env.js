export const config = { runtime: "edge" };

export default async function handler() {
  return new Response(
    JSON.stringify({
      url: process.env.UPSTASH_REDIS_REST_URL || "NO_URL",
      token: process.env.UPSTASH_REDIS_REST_TOKEN ? "OK" : "NO_TOKEN"
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
