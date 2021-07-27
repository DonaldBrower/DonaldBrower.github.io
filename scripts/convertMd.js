const fs = require("fs/promises");
const path = require("path");

require("dotenv").config();
const chokidar = require("chokidar");
const showdown = require("showdown");
const { parse } = require("node-html-parser");

startWatcher(process.env.MDPATH, process.env.HTMLPATH);

async function startWatcher(mdDir, htmlDir) {
  chokidar.watch([mdDir]).on("all", async (e, mdFile) => {
    if (mdFile.match(/\.md/g)) {
      try {
        console.log(`.. Converting ${path.basename(mdFile)}`);

        const htmlFile = path.join(
          htmlDir,
          path.basename(mdFile).replace(".md", ".html")
        );

        await convert(mdFile, htmlFile);
      } catch (err) {
        throw err;
      }
    }
  });
}

const classMap = {
  code: "language-js",
};

const bindings = Object.keys(classMap).map((key) => ({
  type: "output",
  regex: new RegExp(`<${key}(.*)>`, "g"),
  replace: `<${key} class="${classMap[key]}" $1>`,
}));

bindings.push(function removePFromImg() {
  return [
    {
      type: "output",
      filter: function (text) {
        text = text.replace(
          /(<\/?p[^>]*>)(?=<img.+>)|(<\/?p[^>]*>)(?<=<img.+>)/g,
          ""
        );

        return text;
      },
    },
  ];
});

const converter = new showdown.Converter({
  extensions: [...bindings],
});

async function convert(mdFile, htmlFile) {
  const md = await getFile(path.join(mdFile));

  let html = await getFile(htmlFile);
  if (!html) {
    html = await getFile(
      path.join(process.env.TEMPLATEPATH, "posts.template.html")
    );
  }

  let dom = parse(html);
  const container = dom.querySelector(".text");
  container.innerHTML = converter.makeHtml(md);

  await updateFile(htmlFile, dom.innerHTML);
}

async function getFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (e) {
    console.warn(
      `Creating markup from template for post: ${path.basename(filePath)}`
    );
  }
}

async function updateFile(filePath, content) {
  try {
    try {
      await fs.unlink(filePath);
    } catch (e) {
      console.log();
    }

    await fs.writeFile(filePath, content);
  } catch (e) {
    console.error("errors: ", e.message);
  }
}
