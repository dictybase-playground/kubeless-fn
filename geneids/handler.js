const redis = require("redis")
const Minio = require("minio")
const gff = require("bionode-gff")
const filepath = require("path")
const tmp = require("tmp")
const bunyan = require("bunyan")

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
const redisClient = redis.createClient(
  `${process.env.REDIS_MASTER_SERVICE_HOST}:${
    process.env.REDIS_MASTER_SERVICE_PORT
  }`,
)
redisClient.on("connect", () => {
  logger.info("Redis client connected")
})
redisClient.on("error", err => {
  logger.error(`Something went wrong starting the Redis client: ${err}`)
})

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

/**
 * OK response helper
 */
const successMessage = (id, name) => {
  return {
    type: "gene",
    id,
    attributes: {
      geneName: name,
      geneId: id,
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
    redisClient.hset(
      "GENE2NAME/geneids",
      feature.attributes.ID,
      feature.attributes.Name,
      redis.print,
    )
  }
}
const done = () => {
  console.log("Done reading GFF3 file")
}

const file2Redis = event => {
  const req = event.extensions.request
  const res = event.extensions.response
  const path = req.get("x-original-uri")
  res.set("X-Powered-By", "kubeless")
  res.set("Content-Type", "application/vnd.api+json")

  try {
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

        gff
          .read(fileLocation)
          .on("data", setCache)
          .on("end", done)
      },
    )
  } catch (error) {
    return errMessage(500, error.message, path)
  }
}

const getData = event => {
  const req = event.extensions.request
  const res = event.extensions.response
  const path = req.get("x-original-uri")
  res.set("X-Powered-By", "kubeless")
  res.set("Content-Type", "application/vnd.api+json")

  // else get data
  try {
    if (redisClient.hexists("GENE2NAME/geneids", req.path)) {
      return redisClient.hget(req.path, (err, result) => {
        if (err) {
          throw err
        }
        successMessage(req.path, result)
      })
    }
    return errMessage(404, "no match for route", path)
  } catch (error) {
    return errMessage(500, error.message, path)
  }
}

module.exports = { file2Redis, getData }
