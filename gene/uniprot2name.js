const bunyan = require("bunyan")

// create Bunyan logger
const logger = bunyan.createLogger({
  name: "uniprot2name",
  streams: [{ level: "debug", stream: process.stderr }],
})

// checks if uniprot ID and gene name are in cache
const uniprot2name = async (id, redisClient) => {
  const hash = "UNIPROT2NAME/uniprot"

  try {
    const exists = await redisClient.hexists(hash, id)

    if (exists === 1) {
      const value = await redisClient.hget(hash, id)
      logger.info(`successfully found uniprotId ${id} and geneName ${value}`)
      return {
        data: {
          type: "genes",
          id,
          attributes: {
            uniprotId: id,
            geneName: value,
          },
        },
      }
    }

    logger.error("uniprotId not found in our cache")
    return {
      data: {
        type: "genes",
        id,
        attributes: {
          uniprotId: id,
          geneName: id,
        },
      },
    }
  } catch (error) {
    logger.error("error in catch: ", error)
    return {
      status: 500,
      title: error.message,
      detail: error.message,
      meta: { creator: "kubeless function api" },
    }
  }
}

module.exports = { uniprot2name }
