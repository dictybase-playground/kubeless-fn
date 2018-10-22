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
 * Kubeless function that clears the gene name/ID cache
 */
const clearCache = async () => {
    const hash = "GENE2NAME/geneids"
  try {
    const initialSize = await redisClient.hlen(hash)
    logger.info("initial cache size: ", initialSize)
    const removal = await redisClient.del(hash)
    const afterSize = await redisClient.hlen(hash)
    logger.info("new cache size: ", afterSize)
  } catch (error) {
    logger.error(error)
  }
}

module.exports = { clearCache }
