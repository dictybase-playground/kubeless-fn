/**
 * OK response helper
 */
const successObj = (uniprotId, geneName) => {
  return {
    data: {
      type: "genes",
      id: uniprotId,
      attributes: {
        uniprotId,
        geneName,
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
