/* eslint-env jest */
const Redis = require("ioredis-mock")
const { go2name } = require("./go2name")

/**
 * Instantiate mock Redis client with hash
 */
const redisClient = new Redis({ data: { "GO2NAME/goids": { "GO:0031164": "contractile vacuolar membrane" } } })

describe("go2name", () => {
  it("should find GO:0031164 in cache", async () => {
    const data = await go2name("GO:0031164", redisClient)
    expect(data.data.attributes.goId).toBe("GO:0031164")
  })

  it("should provide go term in response for go id", async () => {
    const data = await go2name("GO:0031164", redisClient)
    expect(data.data.attributes.goName).toBe("contractile vacuolar membrane")
  })
})
