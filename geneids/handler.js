const fs = require("fs")
const redis = require("redis")
const Minio = require("minio")
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
 * Put our file handling logic in a class
 */
class FileHandler {
  constructor({ fileLocation, redisClient }) {
    this.fileLocation = fileLocation
    this.redisClient = redisClient
  }

  /**
   * Take the specified GFF3 and parse it down to a nested array
   * featuring id and name elements
   */
  cache() {
    const cacheArray = fs
      // read specified file
      .readFileSync(this.fileLocation)
      // convert to string
      .toString()
      // split by new line
      .split("\n")
      // return array split by tab
      .map(item => {
        return item.split("\t")
      })
      // only get "gene" lines
      .filter(item => {
        return item[2] === "gene"
      })
      // return the last column
      .map(item => {
        return item[8]
      })
      // split this data by semicolon
      .map(item => {
        return item.split(";")
      })
      // get only ID and name values
      .map(item => {
        return [item[0].substr(3), item[1].substr(5)]
      })
      // set ID and name as key-value pairs in Redis
      .forEach(item => {
        this.redisClient.hset("GENE2NAME/geneids", item[0], item[1])
      })
  }
}

const geneids = event => {
  const req = event.extensions.request
  const res = event.extensions.response
  const path = req.get("x-original-uri")
  res.set("X-Powered-By", "kubeless")
  res.set("Content-Type", "application/vnd.api+json")

  // if there is a metadata file, act as POST route
  if (event.data.bucket) {
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
            return logger.error("Error getting object: ", error)
          }
          logger.info("Object download success!")

          // got the file, now pass the file location into our class
          const storeFileContent = new FileHandler({
            fileLocation,
            redisClient,
          })
          // call the cache method
          storeFileContent.cache()
        },
      )
    } catch (error) {
      return errMessage(500, error.message, path)
    }
  }

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

module.exports = { geneids }

/**
 * Where I'm at:
 * 1. I need to test the actual deployment. Is this the right approach inside the geneids function?
 * 2. The last commit was working locally, with this reading metadata.json, grabbing the specified file from Minio, then caching it in Redis.
 * 3. I updated this to grab the info from metadata.json as CLI argument. Need to verify that this is in fact correct.
 * 4. Trying to handle both POST/GET inside geneids function. Initial thought was a conditional to check if the deployment includes a file.
 * 5. Also, where is the connection between the route and the data?
 *
 * Look at previous commit for working local version.
 */
