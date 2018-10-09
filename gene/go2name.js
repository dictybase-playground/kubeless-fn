const fetch = require("node-fetch")
const bunyan = require("bunyan")

/**
 * Create Bunyan logger
 */
const logger = bunyan.createLogger({
  name: "go2name",
  streams: [{ level: "debug", stream: process.stderr }],
})

const makeGoURL = id => {
  return `https://www.ebi.ac.uk/QuickGO/services/ontology/go/terms/${id}`
}

const goName2Id = async (id, redisClient) => {
  const hash = "GO2NAME/goids"
  try {
    const res = await fetch(makeGoURL(id))
    const json = await res.json()

    if (res.ok) {
      await redisClient.hset(hash, json.results[0].id, json.results[0].name)
      logger.info(`Successfully set ${json.results[0].id}:${json.results[0].name} in hash ${hash}`)
      return {
        data: {
          type: "goa",
          id: json.results[0].id,
          attributes: {
            goId: json.results[0].id,
            goName: json.results[0].name,
          },
        },
      }
    }

    return {
      status: 404,
      title: json.messages[0],
      detail: json.messages[0],
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

const go2name = async (id, redisClient) => {
  const hash = "GO2NAME/goids"

  try {
    const exists = await redisClient.hexists(hash, id)

    if (exists === 1) {
      const value = await redisClient.hget(hash, id)
      logger.info(`successfully found goId ${id} and goName ${value}`)
      return {
        data: {
          type: "goa",
          id,
          attributes: {
            goName: value,
            goId: id,
          },
        },
      }
    }

    return goName2Id(id, redisClient)
  } catch (error) {
    return {
      status: 500,
      title: error.message,
      detail: error.message,
      meta: { creator: "kubeless function api" },
    }
  }
}

module.exports = { go2name }
