const fs = require("fs")
const redis = require("redis")

const client = redis.createClient()

client.on("connect", () => {
  console.log("Redis client connected")
})

client.on("error", err => {
  console.log(`Something went wrong ${err}`)
})

const initialArr = fs
  // read specified file
  .readFileSync(process.argv[2])
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

/**
 * All of the above gets us down to a nested array featuring id and name elements
 */

// const redisHandler = initialArr.forEach(item => {
//   client.hset("GENE2NAME/geneids", item[0], item[1], redis.print)
// })

