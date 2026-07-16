import os
import logging
import redis
from typing import Callable, Any

logger = logging.getLogger("nexus-redis")

class RedisPubSub:
    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        try:
            self.client = redis.from_url(redis_url, socket_connect_timeout=2)
            # Ping to test connectivity
            self.client.ping()
            self.connected = True
            logger.info("Connected to Redis server.")
        except Exception as e:
            self.client = None
            self.connected = False
            logger.error(f"Redis connection failed. Running in memory-only mode. Details: {e}")

    def publish(self, channel: str, message: str) -> bool:
        if not self.connected or not self.client:
            logger.debug(f"[Redis offline] Skip publish to {channel}: {message[:100]}...")
            return False
        try:
            self.client.publish(channel, message)
            return True
        except Exception as e:
            logger.error(f"Redis publish error: {e}")
            return False

# Singleton instance
redis_service = RedisPubSub()
