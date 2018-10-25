/* eslint-env jest */
const Redis = require("ioredis-mock")
const { gene2name } = require("./gene2name")

/**
 * Instantiate mock Redis client with hash
 */
const redisClient = new Redis({ data: { "GENE2NAME/geneids": { sadA: "DDB_G0288511" } } })

describe("gene2name", () => {
  it("should find sadA in cache", async () => {
    const data = await gene2name("sadA", redisClient)
    expect(data.data.attributes.geneId).toBe("sadA")
  })

  it("should provide gene ID in response for sadA", async () => {
    const data = await gene2name("sadA", redisClient)
    expect(data.data.attributes.geneName).toBe("DDB_G0288511")
  })

  it("should give 404 error on nonexistent key", async () => {
    const data = await gene2name("xyxyxyx", redisClient)
    expect(data.status).toBe(404)
  })

  it("should provide error detail", async () => {
    const data = await gene2name("xyxyxyx", redisClient)
    expect(data.detail).toBeDefined()
  })
})
