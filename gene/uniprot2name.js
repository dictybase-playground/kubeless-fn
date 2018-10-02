const Redis = require("ioredis")

/**
 * Instantiate Redis client from env variable
 */
const redisClient = new Redis(
  process.env.REDIS_MASTER_SERVICE_PORT,
  process.env.REDIS_MASTER_SERVICE_HOST,
)
redisClient.on("connect", () => {
  console.log("Redis client connected")
})
redisClient.on("error", err => {
  console.log(`Something went wrong starting the Redis client: ${err}`)
})

const uniprot2name = async id => {
  const hash = "UNIPROT2NAME/uniprot"

  try {
    const exists = await redisClient.hexists(hash, id)

    if (exists === 1) {
      const value = await redisClient.hget(hash, id)
      console.log(`successfully found uniprotId ${id} and geneName ${value}`)
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

    console.log("uniprotId doesn't exist")
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

module.exports = { uniprot2name }
