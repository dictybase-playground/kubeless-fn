const bunyan = require("bunyan")

// create Bunyan logger
const logger = bunyan.createLogger({
  name: "gene2name",
  streams: [{ level: "debug", stream: process.stderr }],
})

// gets gene ID and name from Redis cache
const gene2name = async (id, redisClient) => {
  // set namespace for redis hash
  const hash = "GENE2NAME/geneids"

  try {
    // check if id exists in hash
    const exists = await redisClient.hexists(hash, id)

    // found the id
    if (exists === 1) {
      const value = await redisClient.hget(hash, id)
      logger.info(`successfully found gene ${id} with value ${value}`)
      return {
        data: {
          type: "genes",
          id,
          attributes: {
            geneName: value,
            geneId: id,
          },
        },
      }
    }

    // didn't find the id
    logger.info("geneid doesn't exist")
    return {
      status: 404,
      title: "no match for route",
      detail: "no match for route",
      meta: { creator: "kubeless function api" },
    }
  } catch (error) {
    return {
      status: 500,
      title: error.message,
      detail: error.message,
      meta: { creator: "kubeless function api" },
    }
  }
}

module.exports = { gene2name }
