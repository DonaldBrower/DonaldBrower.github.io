const fs = require("fs/promises");
const path = require("path");
const showdown = require("showdown");
const { parse } = require("node-html-parser");
const converter = new showdown.Converter();

const mdDir = "/Users/donaldbrower/git/postsandprograms.com/md";
const htmlDir = "/Users/donaldbrower/git/postsandprograms.com/posts";

const mdFile = "20210618.md";
const htmlFile = "20210618.html";

(async function main() {
  const mdToConvert = await getFile(path.join(mdDir, mdFile));
  const htmlToWorkOn = await getFile(path.join(htmlDir, htmlFile));
  let htmlDocument = parse(htmlToWorkOn);

  const theTextToReplace = htmlDocument.querySelector(".text");
  theTextToReplace.innerHTML = converter.makeHtml(mdToConvert);

  await replaceFile(path.join(htmlDir, htmlFile), htmlDocument.innerHTML);
})();

async function getFile(thePath) {
  try {
    return await fs.readFile(thePath, "utf8");
  } catch (e) {
    console.error("error: ", e.message);
  }
}

async function replaceFile(thePath, content) {
  try {
    await fs.unlink(thePath);
    await fs.writeFile(thePath, content);
  } catch (e) {
    console.error("errors: ", e.message);
  }
}