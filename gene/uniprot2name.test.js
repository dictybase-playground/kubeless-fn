/* eslint-env jest */
const Redis = require("ioredis-mock")
const { uniprot2name } = require("./uniprot2name")

/**
 * Instantiate mock Redis client with hash
 */
const redisClient = new Redis({ data: { "UNIPROT2NAME/uniprot": { P36410: "rab14" } } })

describe("uniprot2name", () => {
  it("should find P36410 in cache", async () => {
    const data = await uniprot2name("P36410", redisClient)
    expect(data.data.attributes.uniprotId).toBe("P36410")
  })

  it("should provide gene name in response for P36410", async () => {
    const data = await uniprot2name("P36410", redisClient)
    expect(data.data.attributes.geneName).toBe("rab14")
  })

  it("should set name and id as identical if not found", async () => {
    const data = await uniprot2name("xyxyxyx", redisClient)
    expect(data.data.attributes.geneName).toBe("xyxyxyx")
  })
})
