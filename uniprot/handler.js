const Redis = require("ioredis")
const Minio = require("minio")
const bunyan = require("bunyan")

// Set the hash location
const hash = "UNIPROT2NAME/uniprot"

/**
 * Create Bunyan logger
 */
const logger = bunyan.createLogger({
  name: "uniprot2name",
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
const successObj = (uniprotId, geneId, geneName) => {
  return {
    data: {
      type: "genes",
      uniprotId,
      attributes: {
        uniprot: uniprotId,
        geneName,
        geneId,
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
