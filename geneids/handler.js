const Redis = require("ioredis")
const Minio = require("minio")
const gff = require("bionode-gff")
const filepath = require("path")
const tmp = require("tmp")
const bunyan = require("bunyan")
const fpath = require("path")

// Set the hash location
const hash = "GENE2NAME/geneids"

/**
 * Create Bunyan logger
 */
const logger = bunyan.createLogger({
  name: "gene2name",
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
      type: "genes",
      id,
      attributes: {
        geneName: name,
        geneId: id,
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
 * Functions to handle gff3 event
 */
const setCache = feature => {
  if (feature.type === "gene") {
    redisClient.hset(hash, feature.attributes.ID, feature.attributes.Name)
  }
}
const done = () => {
  logger.info("Done reading GFF3 file")
}

/**
 * Kubeless function that gets file from Minio,
 * parses its content then stores gene ID and name
 * into Redis cache.
 */
const file2redis = event => {
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
      secretKey: process.env.MINIO_SECRET_KEY,
    })
    // create temp folder to store file
    const tmpObj = tmp.dirSync({ prefix: "minio-" })
    const folder = tmpObj.name
    const fileLocation = filepath.join(folder, fpath.basename(event.data.file))

    // get object from Minio
    minioClient.fGetObject(event.data.bucket, event.data.file, fileLocation, err => {
      if (err) {
        return logger.error("Error getting object: ", err)
      }
      logger.info("Object download success!")

      gff
        .read(fileLocation)
        .on("data", setCache)
        .on("end", done)
    })

    res.status(201)
    return {}
  } catch (error) {
    return errMessage(500, error.message, path)
  }
}

/**
 * Kubeless function that sends back gene name and ID
 * when it receives an ID
 */
const gene2name = async event => {
  const req = event.extensions.request
  const res = event.extensions.response
  const route = req.get("x-original-uri")
  const geneId = req.params[0].substring(1)

  res.set("X-Powered-By", "kubeless")
  res.set("Content-Type", "application/vnd.api+json")

  try {
    const exists = await redisClient.hexists(hash, geneId)

    if (exists === 1) {
      const value = await redisClient.hget(hash, geneId)
      logger.info(`successfully found geneId ${geneId} and geneName ${value}`)
      res.status(200)
      return successObj(geneId, value)
    }

    logger.info("geneid doesn't exist")
    res.status(404)
    return errMessage(404, "no match for route", route)
  } catch (error) {
    res.status(500)
    return errMessage(500, error.message, route)
  }
}

module.exports = { file2redis, gene2name }
