const fetch = require("node-fetch")
const utils = require("./utils")

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

  set error(err) {
    this.error = err
  }

  get error() {
    return this.error
  }

  set success(ok) {
    this.ok = ok
  }

  get success() {
    return this.ok
  }

  isError() {
    return this.error
  }

  isSuccess() {
    return this.success
  }
}

class UniprotRes extends Response {
  get id() {
    return this.uid
  }

  set id(id) {
    this.uid = id
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
      ures.success = true
      ures.id = uniprotId.trim()
    } else {
      ures.error = new AppError(`no uniprot id found for ${id}`, 404)
    }
  } else {
    ures.error = new AppError("unknown uniprot error", res.status)
  }
  return ures
}

const uniprot2Goa = async (id, req) => {
  const goares = await fetch(makeGoaURL(id), {
    headers: { Accept: "application/json" },
  })
  const resp = new Response()
  if (goares.ok) {
    const json = await goares.json()
    resp.response = {
      links: { self: utils.getOriginalURL(req) },
      data: normalizeGoa(json),
    }
    resp.success = true
  } else {
    const errjson = await goares.json()
    resp.error = new AppError(errjson.messages[0], goares.status)
  }
  return resp
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
      relationships: {
        goa: {
          links: {
            related: utils.getGoaURL(req),
          },
        },
      },
    },
    links: {
      self: utils.getOriginalURL(req),
    },
  })
}

const geneGoaHandler = async (req, res) => {
  const orgURL = req.get("original-uri")
  try {
    const ures = await geneId2Uniprot(req.params[0])
    if (ures.isSuccess()) {
      const gres = await uniprot2Goa(ures.id, req)
      if (gres.isSuccess()) {
        res.status(200)
        return gres.response
      }
      res.status(gres.error.status)
      return utils.errMessage(gres.error.status, gres.message, orgURL)
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
