const Redis = require("ioredis")
const bunyan = require("bunyan")
const RouteMatcher = require("./routes")
const utils = require("./utils")
const api = require("./api")

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

const rmatcher = new RouteMatcher([
  {
    route: new RegExp("^/genes/([A-Z]{3}_G[0-9]{4,})$"),
    handler: api.geneHandler,
  },
  {
    route: new RegExp("^/genes/([A-Z]{3}_G[0-9]{4,})/goas$"),
    handler: api.geneGoaHandler,
  },
])
rmatcher.addRoute({
  route: new RegExp("^/goas/([A-Z]{3}_G[0-9]{4,})$/"),
  handler: api.geneGoaHandler,
})

const gene = async event => {
  const req = event.extensions.request
  const res = event.extensions.response
  const path = req.get("x-original-uri")
  const result = rmatcher.dispatch(path, req)
  res.set("X-Powered-By", "kubeless")
  res.set("Content-Type", "application/vnd.api+json")
  try {
    if (result.matched) {
      const redisKey = `${req.params[0]}-${path}`
      const exists = await redisClient.exists(redisKey)

      /**
       * Determine length of Redis cache
       */
      let cacheExpire
      if (!isNaN(process.env.REDIS_CACHE_EXPIRATION)) {
        cacheExpire = 60 * 60 * 24 * process.env.REDIS_CACHE_EXPIRATION
      } else {
        // set default key-value cache for 7 days
        cacheExpire = 60 * 60 * 24 * 7
      }

      if (exists === 1) {
        const value = await redisClient.get(redisKey)
        logger.info(`successfully found Redis key: ${redisKey}`)
        res.status(200)
        return value
      }

      const data = await result.fn(req, res, redisClient)
      await redisClient.set(redisKey, JSON.stringify(data), "EX", cacheExpire)
      logger.info(`successfully set Redis key: ${redisKey}`)

      return data
    }
    return utils.errMessage(404, "no match for route", path)
  } catch (error) {
    return utils.errMessage(500, error.message, path)
  }
}

module.exports = { gene }
