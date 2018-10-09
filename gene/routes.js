const bunyan = require("bunyan")

/**
 * Create Bunyan logger
 */
const logger = bunyan.createLogger({
  name: "routes",
  streams: [{ level: "debug", stream: process.stderr }],
})

module.exports = class RouteMatcher {
  constructor(config) {
    if (Object.prototype.toString.call(config) !== "[object Array]") {
      throw new Error("expect an array")
    }
    this.config = config.map(c => {
      if (typeof c.handler !== "function") {
        logger.error("handler is not a function %s", typeof c.handler)
        throw new Error("handler is not a function")
      }
      let obj = {}
      switch (typeof c.route) {
        case "string":
          obj = { route: c.route, matchType: "string", handler: c.handler }
          break
        case "object":
          if (Object.prototype.toString.call(c.route) === "[object RegExp]") {
            obj = { route: c.route, matchType: "regexp", handler: c.handler }
          }
          break
        default:
          obj = {}
      }
      return obj
    })
  }

  addRoute({ route, handler }) {
    if (typeof handler !== "function") {
      logger.error("handler is not a function %s", typeof handler)
      throw new Error("handler is not a function")
    }
    let obj = {}
    switch (typeof route) {
      case "string":
        obj = {
          matchType: "string",
          route,
          handler,
        }
        break
      case "object":
        if (Object.prototype.toString.call(route) === "[object RegExp]") {
          obj = {
            matchType: "regexp",
            route,
            handler,
          }
        }
        break
      default:
        obj = {}
    }
    this.config.push(obj)
  }

  dispatch(path, req) {
    if (this.config.length === 0) {
      return { matched: false }
    }
    const found = this.config.find(c => {
      let r = false
      switch (c.matchType) {
        case "string":
          if (c.route === path) {
            r = true
          }
          break
        case "regexp": {
          const m = c.route.exec(path)
          if (m) {
            req.params = m.filter((e, i) => {
              return i > 0
            })
            r = true
          }
          break
        }
        default:
          r = false
      }
      return r
    })
    if (found) {
      return { matched: true, fn: found.handler }
    }
    return { matched: false }
  }
}
