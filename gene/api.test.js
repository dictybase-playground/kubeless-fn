/* eslint-env jest */
const Redis = require("ioredis-mock")
const { geneHandler } = require("./api")

/**
 * Instantiate mock Redis client with hash
 */
const redisClient = new Redis({ data: { "GENE2NAME/geneids": { DDB_G0288511: "sadA" } } })

describe("geneHandler", () => {
  const req = {}
  req.params = ["DDB_G0288511"]
  req.headers = {
    "x-forwarded-proto": "https",
    "x-original-uri": "/genes/DDB_G0288511",
  }
  req.hostname = "betafunc.dictybase.local"
  req.get = () => {}
  const res = {}
  res.status = () => {}
  it("should provide correct geneName", async () => {
    const data = await geneHandler(req, res, redisClient)
    console.log(data)
    expect(data.data.attributes.geneName).toBe("sadA")
  })
})
