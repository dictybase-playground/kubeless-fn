const Redis = require("ioredis")
const fetch = require("node-fetch")
const utils = require("./utils")

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

const makeUniprotURL = id => {
  return `https://www.uniprot.org/uniprot?query=gene:${id}&columns=id&format=list`
}

const makeGoaURL = id => {
  const base = "https://www.ebi.ac.uk/QuickGO/services/annotation/search?"
  const query = "includeFields=goName&limit=100&geneProductId="
  return `${base}${query}${id}`
}

// converts gene ID to name using Redis cache
const gene2name = async id => {
  const hash = "GENE2NAME/geneids"
  try {
    const exists = await redisClient.hexists(hash, id)

    if (exists === 1) {
      const value = await redisClient.hget(hash, id)
      console.log(`successfully found geneId ${id} and geneName ${value}`)
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

    console.log("geneid doesn't exist")
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

const makeGoURL = id => {
  return `https://www.ebi.ac.uk/QuickGO/services/ontology/go/terms/${id}`
}

const goName2Id = async id => {
  const hash = "GO2NAME/goids"
  try {
    const res = await fetch(makeGoURL(id))
    const json = await res.json()

    if (res.ok) {
      await redisClient.hset(hash, json.results[0].id, json.results[0].name)
      console.log(`Successfully set ${json.results[0].id}:${json.results[0].name} in hash ${hash}`)
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

const go2name = async id => {
  const hash = "GO2NAME/goids"

  try {
    const exists = await redisClient.hexists(hash, id)

    if (exists === 1) {
      const value = await redisClient.hget(hash, id)
      console.log(`successfully found goId ${id} and goName ${value}`)
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

    return goName2Id(id)
  } catch (error) {
    return {
      status: 500,
      title: error.message,
      detail: error.message,
      meta: { creator: "kubeless function api" },
    }
  }
}

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

// const convertExtensions = ext => {
//   if (ext === null) {
//     return null
//   }
//   return ext.map(async item => {
//     await Promise.all(
//       item.connectedXrefs.map(async xref => {
//         if (xref.db === "DDB") {
//           const name = await gene2name(xref.id)
//           const response = {
//             db: xref.db,
//             id: xref.id,
//             relation: xref.relation,
//             name: name.data.attributes.geneName,
//           }
//           console.log("response: ", response)
//           return Promise.resolve(response)
//         }
//         // console.log("xref: ", xref)
//         // return Promise.resolve(xref)
//       }),
//     )
//   })
// }

const normalizeGoa = goaResp => {
  if (goaResp.numberOfHits === 0) {
    return []
  }
  return goaResp.results.map(r => {
    return {
      type: r.goAspect,
      id: r.goId,
      attributes: {
        date: r.date,
        evidence_code: r.goEvidence,
        goterm: r.goName,
        qualifier: r.qualifier,
        publication: r.reference,
        with: r.withFrom,
        extensions: r.extensions,
        assigned_by: r.assignedBy,
      },
    }
  })
}

class Response {
  constructor(res) {
    this.res = res || ""
  }

  get response() {
    return this.res
  }

  set response(res) {
    this.res = res
  }

  set errorn(err) {
    this.err = err
  }

  get errorn() {
    return this.err
  }

  set success(ok) {
    this.ok = ok
  }

  get success() {
    return this.ok
  }

  isError() {
    if (this.errorn) {
      return true
    }
    return false
  }

  isSuccess() {
    if (this.success) {
      return true
    }
    return false
  }
}

class UniprotRes extends Response {
  get ids() {
    return this.uids
  }

  set ids(ids) {
    this.uids = ids
  }
}

class AppError extends Error {
  constructor(message, status) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
    this.http_status = status || 500
  }

  get status() {
    return this.http_status
  }
}

const geneId2Uniprot = async id => {
  const res = await fetch(makeUniprotURL(id))
  const ures = new UniprotRes()
  if (res.ok) {
    if (res.headers.get("content-length") > 0) {
      const uniprotId = await res.text()
      ures.ids = uniprotId.split("\n").filter(v => {
        return v
      })
      ures.success = true
    } else {
      ures.errorn = new AppError(`no uniprot id found for ${id}`, 404)
    }
  } else {
    ures.errorn = new AppError("unknown uniprot error", res.status)
  }
  return ures
}

const uniprot2Goa = async ids => {
  const allGoaRes = ids.map(async v => {
    const goares = await fetch(makeGoaURL(v), { headers: { Accept: "application/json" } })
    const resp = new Response()
    if (goares.ok) {
      const json = await goares.json()
      const normalizedRes = normalizeGoa(json)
      const freshArr = []
      // eslint-disable-next-line
      for (const i of normalizedRes) {
        if (i.attributes.extensions !== null) {
          // eslint-disable-next-line
          const extArr = []
          // eslint-disable-next-line
          for (const j of i.attributes.extensions) {
            // eslint-disable-next-line
            for (const k of j.connectedXrefs) {
              switch (k.db) {
                case "DDB": {
                  // eslint-disable-next-line
                  const name = await gene2name(k.id)
                  const response = {
                    db: k.db,
                    id: k.id,
                    relation: k.relation,
                    name: name.data.attributes.geneName,
                  }
                  extArr.push(response)
                  break
                }
                case "GO": {
                  // eslint-disable-next-line
                  const name = await go2name(`${k.db}:${k.id}`)
                  const response = {
                    db: k.db,
                    id: k.id,
                    relation: k.relation,
                    name: name.data.attributes.goName,
                  }
                  extArr.push(response)
                  break
                }
                case "UniProtKB": {
                  // eslint-disable-next-line
                  const name = await uniprot2name(k.id)
                  const response = {
                    db: k.db,
                    id: k.id,
                    relation: k.relation,
                    name: name.data.attributes.geneName,
                  }
                  extArr.push(response)
                  break
                }
                default: {
                  const response = {
                    db: k.db,
                    id: k.id,
                    relation: k.relation,
                  }
                  extArr.push(response)
                }
              }
            }
          }
          // remove old extensions data
          i.attributes.extensions.pop()
          // replace with new data array
          i.attributes.extensions = extArr
          freshArr.push(i)
        } else if (i.attributes.extensions === null) {
          freshArr.push(i)
        }
      }
      resp.response = freshArr
      resp.success = true
    } else {
      const errjson = await goares.json()
      resp.errorn = new AppError(errjson.messages[0], goares.status)
    }
    return Promise.resolve(resp)
  })
  const allRes = await Promise.all(allGoaRes)
  return allRes
}

// handlers
const geneHandler = (req, res) => {
  res.status(200)
  return Promise.resolve({
    data: {
      type: "genes",
      id: req.params[0],
      attributes: {
        group: ["goa"],
        subgroup: ["goa"],
        version: 2,
      },
      relationships: { goa: { links: { related: utils.getGoaURL(req) } } },
    },
    links: { self: utils.getOriginalURL(req) },
  })
}

const geneGoaHandler = async (req, res) => {
  const orgURL = req.get("x-original-uri")
  const redisKey = `${req.params[0]}-${orgURL}`
  try {
    const ures = await geneId2Uniprot(req.params[0])
    if (ures.isSuccess()) {
      // const exists = await redisClient.exists(redisKey)

      // if (exists === 1) {
      //   const value = await redisClient.get(redisKey)
      //   console.log(`successfully found Redis key: ${redisKey}`)
      //   res.status(200)
      //   return value
      // }

      const gres = await uniprot2Goa(ures.ids, req)

      // Number of error responses
      const errCount = gres.reduce((acc, curr) => {
        if (curr.isError()) {
          return acc + 1
        }
        return acc
      }, 0)
      // No error
      if (errCount === 0) {
        const data = {
          links: { self: utils.getOriginalURL(req) },
          data: gres.map(r => {
            return r.response
          }),
        }
        // await redisClient.set(redisKey, JSON.stringify(data), "EX", 60 * 60 * 24 * 15)
        // console.log(`successfully set Redis key: ${redisKey}`)
        return data
      }
      // All of them are error responses
      if (gres.length === errCount) {
        res.status(gres[0].error.status)
        return utils.errMessage(gres[0].error.status, gres[0].message, orgURL)
      }
      // Mix of error and success
      const succRes = gres.find(r => {
        return r.isSuccess()
      })
      const data = {
        links: { self: utils.getOriginalURL(req) },
        data: succRes.response,
      }
      await redisClient.set(redisKey, JSON.stringify(data), "EX", 60 * 60 * 24 * 15)
      console.log(`successfully set ${data}`)
      return data
    }
    res.status(ures.error.status)
    return utils.errMessage(ures.error.status, ures.message, orgURL)
  } catch (error) {
    res.status(500)
    return utils.errMessage(500, error.message, orgURL)
  }
}

module.exports = {
  geneHandler,
  geneGoaHandler,
}
