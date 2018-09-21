const fs = require("fs")
const redis = require("redis")
const Minio = require("minio")
const filepath = require("path")
const tmp = require("tmp")
const bunyan = require("bunyan")
const metadata = require("./metadata.json")

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
const client = redis.createClient(
  `${process.env.REDIS_MASTER_SERVICE_HOST}:${process.env.REDIS_MASTER_SERVICE_PORT}`,
)
client.on("connect", () => {
  logger.info("Redis client connected")
})
client.on("error", err => {
  logger.error(`Something went wrong ${err}`)
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
 * Put our file handling logic in a class
 */
class FileHandler {
  constructor({ fileLocation }) {
    this.fileLocation = fileLocation
  }

  /**
   * Take the specified GFF3 and parse it down to a nested array
   * featuring id and name elements
   */
  cache() {
    const initialArr = fs
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
        client.hset("GENE2NAME/geneids", item[0], item[1], redis.print)
      })
  }
}

const runner = () => {
  // create temp folder to store file
  const tmpObj = tmp.dirSync({ prefix: "minio-" })
  const folder = tmpObj.name
  const fileLocation = filepath.join(folder, metadata.file)

  // get object from Minio
  minioClient.fGetObject(metadata.bucket, metadata.file, fileLocation, err => {
    if (err) {
      return logger.error(err)
    }
    logger.info("Object download success!")

    // got the file, now pass the file location into our class
    const storeFileContent = new FileHandler({ fileLocation })
    // call the cache method
    storeFileContent.cache()
  })
}

runner()
