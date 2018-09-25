const Redis = require("ioredis")
const bunyan = require("bunyan")

// Set the hash location
const hash = "GO2NAME/goids"

/**
 * Create Bunyan logger
 */
const logger = bunyan.createLogger({
  name: "go2name",
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
 * OK response helper
 */
const successObj = (id, name) => {
  return {
    data: {
      type: "goa",
      id,
      attributes: {
        goName: name,
        goId: id,
      },
    },
  }
}

/**
 * Error message helper
 */
const errMessage = (code, msg, url) => {
  return {
    status: code,
    title: msg,
    detail: msg,
    source: { pointer: url },
    meta: { creator: "kubeless function api" },
  }
}

/**
 * Kubeless function that sends back GO name and ID
 * when it receives an ID
 */
const go2name = async event => {
  const req = event.extensions.request
  const res = event.extensions.response
  const route = req.get("x-original-uri")
  const goId = req.params[0].substring(1)

  res.set("X-Powered-By", "kubeless")
  res.set("Content-Type", "application/vnd.api+json")

  try {
    const exists = await redisClient.hexists(hash, goId)

    if (exists === 1) {
      const value = await redisClient.hget(hash, goId)
      logger.info(`successfully found goId ${goId} and goName ${value}`)
      res.status(200)
      return successObj(goId, value)
    }

    logger.info("goid doesn't exist")
    res.status(404)
    return errMessage(404, "no match for route", route)
  } catch (error) {
    res.status(500)
    return errMessage(500, error.message, route)
  }
}

module.exports = { go2name }
