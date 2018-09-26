const fs = require("fs")
const readline = require("readline")
const Stream = require("stream")
const events = require("events")

const txt = new events.EventEmitter()

// eslint-disable-next-line
txt.read = function(path) {
  const instream = fs.createReadStream(path)
  const outstream = new Stream()
  const rl = readline.createInterface(instream, outstream)

  rl.on("line", line => {
    const parts = line
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")

    if (parts.length === 4) {
      // this means the synonyms and gene ID columns are missing
      const feature = {
        geneName: parts[0],
        geneNameSyn: "",
        geneId: "",
        uniprotId: parts[1],
        uniprotName: parts[2],
        size: parts[3],
      }
      txt.emit("data", feature)
    } else if (parts.length === 5) {
      if (parts[1].substring(0, 3) !== "DDB") {
        // means there is no gene ID
        const feature = {
          geneName: parts[0],
          geneNameSyn: parts[1],
          geneId: "",
          uniprotId: parts[2],
          uniprotName: parts[3],
          size: parts[4],
        }

        txt.emit("data", feature)
      }
      if (parts[1].substring(0, 3) === "DDB") {
        // means there are no gene synonyms
        const feature = {
          geneName: parts[0],
          geneNameSyn: "",
          geneId: parts[1],
          uniprotId: parts[2],
          uniprotName: parts[3],
          size: parts[4],
        }
        txt.emit("data", feature)
      }
    } else if (parts.length === 6) {
      // have data for every column
      const feature = {
        geneName: parts[0],
        geneNameSyn: parts[1],
        geneId: parts[2],
        uniprotId: parts[3],
        uniprotName: parts[4],
        size: parts[5],
      }
      txt.emit("data", feature)
    } else {
      const err = new Error("Error reading this data file")
      txt.emit("error", err)
    }
  })

  rl.on("close", () => {
    txt.emit("end")
  })

  return this
}

module.exports = txt
