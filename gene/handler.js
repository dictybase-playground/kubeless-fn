const RouteMatcher = require("./routes")
const utils = require("./utils")
const api = require("./api")

const rmatcher = new RouteMatcher([
  {
    route: new RegExp("^/genes/([A-Z]{3}_G[0-9]{4,})$"),
    handler: api.geneHandler,
  },
  {
    route: new RegExp("^/genes/([A-Z]{3}_G[0-9]{4,})/goas$"),
    handler: api.geneGoaHandler,
  },
])
rmatcher.addRoute({
  route: new RegExp("^/goas/([A-Z]{3}_G[0-9]{4,})$/"),
  handler: api.geneGoaHandler,
})

const gene = async event => {
  const req = event.extensions.request
  const res = event.extensions.response
  const path = req.get("x-original-uri")
  const result = rmatcher.dispatch(path, req)
  res.set("X-Powered-By", "kubeless")
  res.set("Content-Type", "application/vnd.api+json")
  try {
    if (result.matched) {
      return await result.fn(req, res)
    }
    return utils.errMessage(404, "no match for route", path)
  } catch (error) {
    return utils.errMessage(500, error.message, path)
  }
}

module.exports = { gene }
