const Redis = require("ioredis")
const Minio = require("minio")
const filepath = require("path")
const tmp = require("tmp")
const bunyan = require("bunyan")

const txt = require("./convert")
const utils = require("./utils")

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
 * Functions to handle txt event
 */
const setCache = feature => {
  if (feature.geneName === "n.a.") {
    redisClient.hset(hash, feature.uniprotId, feature.geneId)
  } else {
    redisClient.hset(hash, feature.uniprotId, feature.geneName)
  }
}
const done = () => {
  logger.info("Done reading text file")
}

/**
 * Kubeless function that gets file from Minio,
 * parses its content then stores uniprot ID and gene name
 * into Redis cache.
 */
const txt2redis = event => {
  const req = event.extensions.request
  const res = event.extensions.response
  const path = req.get("x-original-uri")
  res.set("X-Powered-By", "kubeless")

  try {
    /**
     * Instantiate Minio client from env variable
     */
    const minioClient = new Minio.Client({
      endPoint: process.env.MINIO_SERVICE_HOST,
      // convert the env string to number
      port: parseInt(process.env.MINIO_SERVICE_PORT, 10),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SERVICE_KEY,
    })
    // create temp folder to store file
    const tmpObj = tmp.dirSync({ prefix: "minio-" })
    const folder = tmpObj.name
    const fileLocation = filepath.join(folder, event.data.file)

    // get object from Minio
    minioClient.fGetObject(
      event.data.bucket,
      event.data.file,
      fileLocation,
      err => {
        if (err) {
          return logger.error("Error getting object: ", err)
        }
        logger.info("Object download success!")

        txt
          .read(fileLocation)
          .on("data", setCache)
          .on("end", done)
      },
    )

    res.status(201)
    return {}
  } catch (error) {
    return utils.errMessage(500, error.message, path)
  }
}

/**
 * Kubeless function that sends back gene name
 * when it receives a Uniprot ID
 */
const uniprot2name = async event => {
  const req = event.extensions.request
  const res = event.extensions.response
  const route = req.get("x-original-uri")
  const uniprotId = req.params[0].substring(1)

  res.set("X-Powered-By", "kubeless")
  res.set("Content-Type", "application/vnd.api+json")

  try {
    const exists = await redisClient.hexists(hash, uniprotId)

    if (exists === 1) {
      const value = await redisClient.hget(hash, uniprotId)
      logger.info(
        `successfully found uniprotId ${uniprotId} and geneName ${value}`,
      )
      res.status(200)
      return utils.successObj(uniprotId, value)
    }

    logger.info("uniprotId doesn't exist")
    res.status(404)
    return utils.errMessage(404, "no match for route", route)
  } catch (error) {
    res.status(500)
    return utils.errMessage(500, error.message, route)
  }
}

/**
 * Function to check what's in the cache
 */
const checkCache = () => {
  redisClient.hgetall(hash, (err, result) => {
    logger.info(JSON.stringify(result)) // {"key":"value","second key":"second value"}
  })
}

module.exports = { txt2redis, uniprot2name, checkCache }
