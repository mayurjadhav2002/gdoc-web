import Redis from "ioredis";

let redisClient: Redis | null = null;

export function getRedis(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn("[Redis] REDIS_URL not configured. Redis caching disabled.");
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn("[Redis] Exceeded retry attempts. Bypassing Redis cache.");
          return null;
        }
        return Math.min(times * 100, 2000);
      },
    });

    redisClient.on("error", (err) => {
      console.warn("[Redis] Error:", err.message);
    });

    return redisClient;
  } catch (error) {
    console.warn("[Redis] Connection error:", error);
    return null;
  }
}
