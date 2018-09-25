/**
 * OK response helper
 */
const successObj = (id, name) => {
  return {
    data: {
      type: "goa",
      id,
      attributes: {
        goName: name,
        goId: id,
      },
    },
  }
}

/**
 * Error message helper
 */
const errMessage = (code, msg, url) => {
  return {
    status: code,
    title: msg,
    detail: msg,
    source: { pointer: url },
    meta: { creator: "kubeless function api" },
  }
}

module.exports = { successObj, errMessage }
