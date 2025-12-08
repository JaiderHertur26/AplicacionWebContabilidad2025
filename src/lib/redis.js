// /src/lib/redis.js
import { Redis } from "@upstash/redis";

// Lee automáticamente variables de entorno:
// VITE_UPSTASH_REDIS_REST_URL
// VITE_UPSTASH_REDIS_REST_TOKEN
export const redis = Redis.fromEnv();
