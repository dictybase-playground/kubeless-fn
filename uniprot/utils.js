/**
 * OK response helper
 */
const successObj = (uniprotId, geneId, geneName) => {
  return {
    data: {
      type: "genes",
      uniprotId,
      attributes: {
        uniprotId,
        geneName,
        geneId,
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
