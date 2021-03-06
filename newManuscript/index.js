'use strict';
const markdown = require('markdown-it');
const hljs = require('highlight.js');
const fs = require('fs');
const uslug = require('uslug');
const axios = require('axios');
const unique = require('lodash/uniq');
const denodeify = require('denodeify');
const path = require('path');
const less = require('less');
const CleanCss = require('less-plugin-clean-css');

const readFile = denodeify(fs.readFile);
const writeFile = denodeify(fs.writeFile);

const linkGitHubRE = /\[\(:memo:([^\)]*)\)\]\(https:\/\/github.com\/Satyam\/book-react-redux\/blob\/([^#\)]+)/g;
const octocatRE = /:octocat:/g;
const downloadRE = /<a href="(\d\d-\d\d)">:o:<\/a>/g;
const ampRE = /&/g;
const ltRE = /</g;
const gtRE = />/g;
const memoRE=/\(:memo:([^\)]*)\)/;

const download =
`<a
  href="https://github.com/Satyam/book-react-redux/archive/chapter-$1.zip"
  class="download"
><img
  title="Download Chapter $1 from GitHub"
  src="octocat.png"
/>&dArr;</a>`
const octocat = '<img class="emoji" title="See in GitHub" alt="octocat" src="octocat.png" />';
// https://github.com/Satyam/book-react-redux/archive/chapter-02-03.zip
const rawGitHub = axios.create({
  baseURL: 'https://raw.githubusercontent.com/Satyam/book-react-redux/',
  transformResponse: (data) => data
});

const md = markdown({
  html: true
});

let tocArray = [];
let prevChapter = '';

var defaultHeadingRender = md.renderer.rules.heading_open || function (tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
  // console.log(idx, tokens[idx].tag, tokens[idx + 1].children[0].content, env);
  const tag = tokens[idx].tag;
  if (tag > 'h0' && tag < 'h4') {
    const text = tokens[idx + 1].children.map(child => child.content).join('');
    if (text.startsWith('Single source of truth')) debugger;
    tokens[idx + 1].children.forEach(child => {
      child.content = '';
      child.tag = '';
      child.type = 'text';
    });
    const link = uslug(`${env.chapter}-${text}`);
    if (prevChapter !== env.chapter) {
      tocArray = [];
      prevChapter = env.chapter;
    }
    tocArray.push({ tag, link, text });
    return `<${tag}><a class="self-ref" id="${link}" href="#${link}"># </a>${text}`;
  }
  return defaultHeadingRender(tokens, idx, options, env, self)
};

var defaultParagraphRender = md.renderer.rules.paragraph_open || function (tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.paragraph_open = function (tokens, idx, options, env, self) {
  const pOpen = tokens[idx];
  const pContent = tokens[idx + 1];
  const pClose = tokens[idx + 2];
  if (memoRE.exec(pContent.content)) {
    pOpen.tag = 'div';
    pOpen.attrJoin('class', 'code-insert');
    pClose.tag = 'div';
  }
  return defaultParagraphRender(tokens, idx, options, env, self);
};

var defaultLinkRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};

const linkRE = /https:\/\/github.com\/Satyam\/book-react-redux\/blob\/([^#]+)(#L(\d+)(-L(\d+))?)?/;

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const link = tokens[idx].attrs[tokens[idx].attrIndex('href')][1];
  const text = tokens[idx + 1].content;
  const m = memoRE.exec(text);
  if (m) {
    var ext = m[1];
    tokens[idx + 1].content = '';
    Object.assign(tokens[idx + 2], {
      type: 'text',
      tag: '',
      attrs: null,
      map: null,
      nesting: 0,
      level: 0,
      children: null,
      content: '',
      markup: '',
      info: '',
      meta: null,
      block: false,
      hidden: false
    });

    const match = linkRE.exec(link);
    const file = match[1];
    ext = ext || path.extname(file).substr(1);
    const noFrom = typeof match[3] === 'undefined';
    const from = noFrom ? 0 : parseInt(match[3], 10) - 1;
    const noTo = typeof match[5] === 'undefined';
    const to = noTo ? (noFrom ? undefined : from + 1) : parseInt(match[5], 10);
    var code = env.files[file].slice(from, to);
    var len = 999;
    code.forEach((line) => {
      var m = /(\s*)/.exec(line);
      len = Math.min(m[1].length, len);
    });
    code = code.map((line) => line.substr(len)).join('\n').trim()
      .replace(ampRE, '&amp;').replace(ltRE, '&lt;').replace(gtRE, '&gt;');
    // }
    const fileParts = file.split('/');
    const branch = fileParts.shift();
    return `<div class="header">
    <div class="link"><a href="${link}">${octocat}</a></div>
    <div class="branch">Branch: ${branch}</div>
    <div class="filename">File: ${fileParts.join('/')}</div>
    <div class="from">From: ${noFrom ? 'start' : from + 1}</div>
    <div class="to">To: ${to || 'end'}</div>
  </div>
  <pre><code class="language-${ext}">${code}</code></pre>`;
  }
  return defaultLinkRender(tokens, idx, options, env, self);
};
// Samples of original and converted link
// https://github.com/Satyam/book-react-redux/blob/chapter-07-01/test/server.js#L154-L243
// https://raw.githubusercontent.com/Satyam/book-react-redux/chapter-07-01/test/server.js
readFile('book.txt', 'utf8')
.then((data) => {
  const chapters = data.trim().split('\n');
  Promise.all(chapters.map((chapter) =>
    readFile(chapter, 'utf8')
    .then((text) => {
      var links = [];
      var match;
      while ((match = linkGitHubRE.exec(text)) !== null) {
        links.push(match[2]);
      }
      links = unique(links);
      var rawFiles = {};
      return Promise.all(links.map((link) =>
        rawGitHub.get(link)
        .then((response) => response.data.split('\n'))
      ))
      .then((raw) => {
        links.forEach((link, index) => {
          rawFiles[link] = raw[index];
        });
      })
      .catch((err) => {
        console.log('chapter', chapter);
        console.log('links', links);
        console.error(err);
        process.exit(1);
      })
      .then(() => ({
        text: md.render(
          text,
          {
            chapter: chapter.replace('.md', ''),
            files: rawFiles
          }
        ),
        toc: tocArray,
        chapter: chapter.replace('.md', '')
      }));
    })
  ))
  .then((parsed) => {
    let contents = '';
    let toc = '';
    let level = 0;
    parsed.forEach((chapter) => {
      contents += `<section id="${chapter.chapter}">${chapter.text}</section>`;
      chapter.toc.forEach((item) => {
        const l = parseInt(item.tag.substr(1), 10);
        while (l < level) {
          toc += '</ul>\n';
          level--;
        }
        while (l > level) {
          toc += `<ul class="level-h${level}">`;
          level++;
        }
        toc += `<li><a href="#${item.link}">${item.text}</a></li>\n`;
      });
    });
    toc += '</ul></li></ul>';
    return {
      toc,
      contents: contents.replace(octocatRE, octocat).replace(downloadRE, download)
    };
  })
  .then((values) => writeFile(
      '../manuscript/gh-pages/index.html',
      `<!DOCTYPE html>
<html>
  <head>
    <title>An annotated single page app using React and Redux</title>
    <link rel="stylesheet" href="ddscrollspydemo.css" />
    <link rel="stylesheet" href="github.min.css">
    <link rel="stylesheet" href="index.css">
    <script type="text/javascript" src="jquery.min.js"></script>
    <script type="text/javascript" src="ddscrollspy.js"></script>
    <script src="highlight.min.js"></script>
  </head>
  <body>
    <div class="toc">${values.toc}</div>
    <div class="contents unfolded">
      <div class="close">&lt; close</div>
      <h1 class="title">An annotated single page app using React and Redux</h1>
      ${values.contents}
    </div>
  </body>
  <script type="text/javascript" src="index.js"></script>
</html>
`
    ))
  .then(() =>
    readFile('./index.less', 'utf8')
    .then((data) => less.render(data, {
      compress: true,
      plugins: [new CleanCss({advanced: true})]
    }))
    .then((output) => writeFile('../manuscript/gh-pages/index.css', output.css)))
  .then(() => console.log('It\'s saved!'))
  .catch(console.error);
});
