#!usr/bin/env node
"use strict";
/*
  This script is used to automate some of the more tedious tasks
  associated with keeping up this website.
*/

var fs = require("fs/promises");
var path = require("path");

require("dotenv").config();
var args = require("minimist")(process.argv.slice(2));
var chokidar = require("chokidar");
var showdown = require("showdown");
var { parse } = require("node-html-parser");

//**************************************************MAIN PROGRAM
var site = Site();

if (args.build) {
  site.build();
} else if (args.watch) {
  site.watch(process.env.MDPATH, process.env.HTMLPATH);
} else {
  site.help();
}

//************************************************API DEFINITION
function Site() {
  var publicApi = {
    build,
    watch,
    help,
  };
  return publicApi;

  //*********************************************PUBLIC FUNCTIONS
  async function build() {
    var { MDPATH, HTMLPATH } = process.env;

    try {
      // before each site build, delete all the files in dist/posts
      var postsFiles = await fs.readdir(HTMLPATH);
      var unlinkHtmlPromises = [];
      postsFiles.forEach(function addUnlinkHtmlPromise(file) {
        if (file.match(/\.html/g)) {
          var fullPath = path.join(HTMLPATH, file);

          unlinkHtmlPromises.push(async function clearHtml() {
            try {
              await fs.unlink(fullPath);
            } catch (e) {
              handleError(e);
            }
          });
        }
      });
      await Promise.all(
        unlinkHtmlPromises.map(function callPromise(fx) {
          return fx();
        })
      );

      // convert each markdown file, and base the post html file on
      // src/templates/posts.template.html
      var mdFiles = await fs.readdir(MDPATH);
      var convertPromises = [];
      mdFiles.forEach(function addConvertMdPromise(file) {
        if (file.match(/\.md/g)) {
          var mdFullPath = path.join(MDPATH, file);
          var htmlFullPath = path.join(HTMLPATH, file.replace(".md", ".html"));

          convertPromises.push(async function convertMd() {
            try {
              await convert(mdFullPath, htmlFullPath);
            } catch (e) {
              handleError(e);
            }
          });
        }
      });
      await Promise.all(
        convertPromises.map(function callPromise(fx) {
          return fx();
        })
      );
    } catch (e) {
      handleError(e);
    }
  }

  async function watch(mdDir, htmlDir) {
    chokidar
      .watch([mdDir, process.env.TEMPLATEPATH])
      .on("all", async function doConversion(e, file) {
        if (file.match(/\.md/g)) {
          await markdownConversion(file, mdDir, htmlDir);
        } else if (file.match(/\.html/g)) {
          await templateUpdate(file);
        }
      });
  }

  function help() {
    console.log("convertMd usage:");
    console.log("  convertMd --help");
    console.log("  convertMd --build");
    console.log("  convertMd --watch");
    console.log(" ");
    console.log("--help                     print this help message");
    console.log(
      "--build                    build the site once--files to be served will be in dist/"
    );
    console.log("--watch                    watch the source for changes");
  }
}

//************************************************PRIVATE FUNCTIONS
async function templateUpdate() {
  var promises = [];

  try {
    var filenames = await fs.readdir(process.env.HTMLPATH);

    filenames.forEach(function handleHtml(file) {
      if (file.match(/\.html/g)) {
        promises.push(async function () {
          try {
            await fs.unlink(path.join(process.env.HTMLPATH, file));

            var markdownFile = path.join(
              process.env.MDPATH,
              file.replace(".html", ".md")
            );

            var htmlFile = path.join(process.env.HTMLPATH, file);

            await convert(markdownFile, htmlFile);
          } catch (e) {
            throw e;
          }
        });
      }
    });

    await Promise.all(
      promises.map(function invokePromise(fn) {
        return fn();
      })
    );
  } catch (e) {
    handleError(e);
    // throw e;
  }
}

async function markdownConversion(mdFile, mdDir, htmlDir) {
  try {
    console.log(`.. Converting ${path.basename(mdFile)}`);

    var htmlFile = path.join(
      htmlDir,
      path.basename(mdFile).replace(".md", ".html")
    );

    await convert(mdFile, htmlFile);
  } catch (e) {
    handleError(e);
  }
}

async function convert(mdFile, htmlFile) {
  var classMap = {
    code: "language-js",
  };

  var bindings = Object.keys(classMap).map(function classMapReplacement(key) {
    return {
      type: "output",
      regex: new RegExp(`<${key}(.*)>`, "g"),
      replace: `<${key} class="${classMap[key]}" $1>`,
    };
  });

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

  var converter = new showdown.Converter({
    extensions: [...bindings],
  });

  //********************************************* */
  var md = await getFile(path.join(mdFile));

  var html = await getFile(htmlFile);
  if (!html) {
    html = await getFile(
      path.join(process.env.TEMPLATEPATH, "posts.template.html")
    );
  }

  var dom = parse(html);
  var container = dom.querySelector(".text");
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
    handleError(e);
    // console.error("errors: ", e.message);
  }
}

function handleError(e) {
  console.trace();
  console.error("There has been an error");
  console.error("");
  console.error(JSON.stringify(e, undefined, 2));
}
