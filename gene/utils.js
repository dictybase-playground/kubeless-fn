const getOriginalURL = req => {
  return `${req.get("x-forwarded-proto")}://${req.hostname}${req.get(
    "x-original-uri",
  )}`
}

const getGoaURL = req => {
  return `${req.get("x-forwarded-proto")}://${req.hostname}/genes/${
    req.params[0]
  }/goas`
}

const errMessage = (code, msg, url) => {
  return {
    status: code,
    title: msg,
    detail: msg,
    source: {
      pointer: url,
    },
    meta: {
      creator: "kubeless function api",
    },
  }
}

module.exports = {
  getOriginalURL,
  getGoaURL,
  errMessage,
}
