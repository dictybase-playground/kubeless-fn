const fetch = require("node-fetch")
const bunyan = require("bunyan")
const utils = require("./utils")
const { gene2name } = require("./gene2name")
const { go2name } = require("./go2name")
const { uniprot2name } = require("./uniprot2name")

/**
 * Create Bunyan logger
 */
const logger = bunyan.createLogger({
  name: "gene",
  streams: [{ level: "debug", stream: process.stderr }],
})

const makeUniprotURL = id => {
  return `https://www.uniprot.org/uniprot?query=gene:${id}&columns=id&format=list`
}

const makeGoaURL = id => {
  const base = "https://www.ebi.ac.uk/QuickGO/services/annotation/search?"
  const query = "includeFields=goName&limit=100&geneProductId="
  return `${base}${query}${id}`
}

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

const uniprot2Goa = async (ids, req, redisClient) => {
  const allGoaRes = ids.map(async v => {
    const goares = await fetch(makeGoaURL(v), { headers: { Accept: "application/json" } })
    const resp = new Response()
    if (goares.ok) {
      const json = await goares.json()
      const normalizedRes = normalizeGoa(json)
      const freshArr = []
      for (const i of normalizedRes) {
        if (i.attributes.extensions !== null) {
          const extArr = []
          for (const j of i.attributes.extensions) {
            for (const k of j.connectedXrefs) {
              // use switch case to include name conversions
              // in returned data structures
              switch (k.db) {
                case "DDB": {
                  const name = await gene2name(k.id, redisClient)
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
                  const name = await go2name(`${k.db}:${k.id}`, redisClient)
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
                  const name = await uniprot2name(k.id, redisClient)
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
const geneHandler = async (req, res, redisClient) => {
  try {
    const name = await gene2name(req.params[0], redisClient)

    if (name.data) {
      res.status(200)

      return Promise.resolve({
        data: {
          type: "genes",
          id: req.params[0],
          attributes: {
            geneName: name.data.attributes.geneName,
            group: ["goa"],
            subgroup: ["goa"],
            version: 2,
          },
          relationships: { goa: { links: { related: utils.getGoaURL(req) } } },
        },
        links: { self: utils.getOriginalURL(req) },
      })
    }
    // if issue with getting gene name from cache, just use gene ID
    res.status(200)
    return Promise.resolve({
      data: {
        type: "genes",
        id: req.params[0],
        attributes: {
          geneName: req.params[0],
          group: ["goa"],
          subgroup: ["goa"],
          version: 2,
        },
        relationships: { goa: { links: { related: utils.getGoaURL(req) } } },
      },
      links: { self: utils.getOriginalURL(req) },
    })
  } catch (error) {
    res.status(500)
    return utils.errMessage(500, error.message, req.get("x-original-uri"))
  }
}

const geneGoaHandler = async (req, res, redisClient) => {
  const orgURL = req.get("x-original-uri")
  const redisKey = `${req.params[0]}-${orgURL}`
  try {
    const ures = await geneId2Uniprot(req.params[0])
    if (ures.isSuccess()) {
      const gres = await uniprot2Goa(ures.ids, req, redisClient)

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
        // set key-value cache for 15 days
        await redisClient.set(redisKey, JSON.stringify(data), "EX", 60 * 60 * 24 * 15)
        logger.info(`successfully set Redis key: ${redisKey}`)
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
      logger.info(`successfully set ${data}`)
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
