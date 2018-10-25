const Redis = require("ioredis")
const bunyan = require("bunyan")

/**
 * Create Bunyan logger
 */
const logger = bunyan.createLogger({
  name: "handler",
  streams: [{ level: "debug", stream: process.stderr }],
})

/**
 * Instantiate Redis client from env variable
 */
const redisClient = new Redis(
  process.env.REDIS_MASTER_SERVICE_PORT,
  process.env.REDIS_MASTER_SERVICE_HOST,
)

redisClient.on("connect", () => {
  logger.info("Redis client connected")
})
redisClient.on("error", err => {
  logger.error(`Something went wrong starting the Redis client: ${err}`)
})

/**
 * Kubeless function that clears the main Redis cache
 */
const clearCache = async () => {
  /**
   * All relevant keys start with "genelookup:" so look for those
   * If they exist, remove them
   */
  try {
    const list = await redisClient.keys("genelookup:*")
    logger.info("initial cache size: ", list.length)
    for (const i of list) {
      redisClient.del(i)
      logger.info("successfully removed ", i)
    }
  } catch (error) {
    logger.error(error)
  }
}

module.exports = { clearCache }
