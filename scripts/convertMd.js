const fs = require("fs/promises");
const path = require("path");

require("dotenv").config();
const chokidar = require("chokidar");
const showdown = require("showdown");
const { parse } = require("node-html-parser");

startWatcher(process.env.MDPATH, process.env.HTMLPATH);

async function startWatcher(mdDir, htmlDir) {
  chokidar
    .watch([mdDir, process.env.TEMPLATEPATH])
    .on("all", async (e, file) => {
      if (file.match(/\.md/g)) {
        await markdownConversion(file, mdDir, htmlDir);
      } else if (file.match(/\.html/g)) {
        await templateUpdate(file);
      }
    });
}

async function templateUpdate() {
  const promises = [];

  try {
    const filenames = await fs.readdir(process.env.HTMLPATH);

    filenames.forEach((file) => {
      if (file.match(/\.html/g)) {
        promises.push(async function () {
          try {
            await fs.unlink(path.join(process.env.HTMLPATH, file));

            const markdownFile = path.join(
              process.env.MDPATH,
              file.replace(".html", ".md")
            );

            const htmlFile = path.join(process.env.HTMLPATH, file);

            await convert(markdownFile, htmlFile);
          } catch (e) {
            throw e;
          }
        });
      }
    });

    await Promise.all(promises.map((fn) => fn()));
  } catch (e) {
    throw e;
  }
}

async function markdownConversion(mdFile, mdDir, htmlDir) {
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

async function convert(mdFile, htmlFile) {
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

  //********************************************* */
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

  //error handling on changing files?
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
    // it's okay to not do anything if it errors out on unlink. that just means the file isn't there
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
