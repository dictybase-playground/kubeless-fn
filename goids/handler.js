const Redis = require("ioredis")
const fetch = require("node-fetch")
const bunyan = require("bunyan")
const utils = require("./utils")

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
 * Create URL to fetch GO data
 */
const makeGoURL = id => {
  return `https://www.ebi.ac.uk/QuickGO/services/ontology/go/terms/${id}`
}

/**
 * Normalize the JSON response into data we actually need
 */
const normalizeData = data => {
  return {
    data: {
      type: "go",
      id: data.results[0].id,
      attributes: {
        id: data.results[0].id,
        name: data.results[0].name,
      },
    },
  }
}

/**
 * Handle the fetch request
 */
const goName2Id = async id => {
  try {
    const res = await fetch(makeGoURL(id))
    const json = await res.json()

    if (res.ok) {
      await redisClient.hset(hash, json.results[0].id, json.results[0].name)
      logger.info(
        `Successfully set ${json.results[0].id}:${
          json.results[0].name
        } in hash ${hash}`,
      )
      return normalizeData(json)
    }

    return utils.errMessage(404, json.messages[0])
  } catch (error) {
    return utils.errMessage(500, error.message)
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
      return utils.successObj(goId, value)
    }

    return goName2Id(goId)
  } catch (error) {
    res.status(500)
    return utils.errMessage(500, error.message, route)
  }
}

module.exports = { go2name }
