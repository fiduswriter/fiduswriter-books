import {escapeText, localizeDate} from "../../../common"
import {bookTerm} from "../../i18n"

export const htmlBookChapterTemplate = ({body, back}) => `${body}${back}`

/** A template for HTML export of a book. */
export const htmlBookExportTemplate = ({
    styleSheets,
    part,
    currentPart,
    contents,
    title,
    settings
}) =>
    `<!DOCTYPE html>
<html lang="${settings.language.split("-")[0]}">
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        ${styleSheets
            .map(
                sheet =>
                    `<link type="text/css" rel="stylesheet" href="${sheet.filename}" />`
            )
            .join("")}
    </head>
    <body class="user-contents book-chapter${
        currentPart && currentPart.length
            ? ` ${currentPart.toLowerCase().replace(/[^a-z]/g, "")}`
            : ""
    }">
        ${
            part && part.length
                ? `<h1 class="part">${escapeText(part)}</h1>`
                : ""
        }
        ${contents}
    </body>
</html>`

/** A template to create the book index item. */
const htmlBookIndexItemTemplate = ({item, multiDoc}) =>
    `<li>
        <a href="${
            item.link
                ? item.link
                : multiDoc
                  ? item.docNum
                      ? `document-${item.docNum}.html#${item.id}`
                      : `document.html#${item.id}`
                  : `#${item.id}`
        }">
            ${escapeText(item.title)}
        </a>
        ${
            item.subItems.length
                ? `<ol>
                ${item.subItems
                    .map(subItem =>
                        htmlBookIndexItemTemplate({item: subItem, multiDoc})
                    )
                    .join("")}
            </ol>`
                : ""
        }
    </li>`

/** A template to create the book index. */
export const htmlBookIndexBodyTemplate = ({
    book,
    contentItems,
    language,
    creator,
    multiDoc
}) =>
    `<div class="titlepage frontmatter">
        <h1 class="booktitle">${escapeText(book.title)}</h1>
        ${
            book.metadata.subtitle.length
                ? `<h2 class="booksubtitle">${escapeText(
                      book.metadata.subtitle
                  )}</h2>`
                : ""
        }
        ${
            book.metadata.author.length
                ? `<h3 class="bookauthor">${bookTerm(
                      "by",
                      book.settings.language
                  )} ${escapeText(book.metadata.author)}</h3>`
                : ""
        }
        ${
            book.metadata.version?.length
                ? `<h4 class="bookversion">${escapeText(
                      book.metadata.version
                  )}</h4>`
                : ""
        }
    </div>
    <div class="copyrightpage frontmatter">
        ${
            book.metadata.publisher && book.metadata.publisher.length
                ? `<p>${bookTerm(
                      "Published by",
                      book.settings.language
                  )}: ${escapeText(book.metadata.publisher)}</p>`
                : ""
        }
        <p>${bookTerm("Last updated", book.settings.language)}: ${localizeDate(
            book.updated * 1000,
            "sortable-date"
        )}</p>
        <p>${bookTerm("Created", book.settings.language)}: ${localizeDate(
            book.added * 1000,
            "sortable-date"
        )}</p>
        <p>${bookTerm("Language", book.settings.language)}: ${language}</p>
        <p>${bookTerm("Created by", book.settings.language)}: ${escapeText(
            creator
        )}</p>
    </div>
    <div class="tocpage frontmatter">
        <nav role="doc-toc"><ol>
            ${contentItems
                .map(item => htmlBookIndexItemTemplate({item, multiDoc}))
                .join("")}
        </ol></nav>
    </div>`

/** A template to create the book index. */
export const htmlBookIndexTemplate = ({
    book,
    contentItems,
    language,
    creator,
    styleSheets,
    multiDoc
}) =>
    `<!DOCTYPE html>
<html lang="${book.settings.language.split("-")[0]}">
    <head>
        <meta charset="utf-8"></meta>
        <title>${escapeText(book.title)}</title>
        <link type="text/css" rel="stylesheet" href="css/book.css" />
        ${styleSheets
            .map(
                sheet =>
                    `<link type="text/css" rel="stylesheet" href="${sheet.filename}" />`
            )
            .join("")}
    </head>
    <body class="user-contents book-index">
        ${htmlBookIndexBodyTemplate({
            book,
            contentItems,
            language,
            creator,
            multiDoc
        })}
    </body>
</html>`

export const singleFileHTMLBookChapterTemplate = ({part, contents}) => `
    ${part && part.length ? `<h1 class="part">${escapeText(part)}</h1>` : ""}
    ${contents}`

export const singleFileHTMLBookTemplate = ({
    css,
    html,
    title,
    styleSheets,
    settings
}) => `<!DOCTYPE html>
<html lang="${settings.language.split("-")[0]}">
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
            ${css}
        </style>
        ${styleSheets
            .map(sheet =>
                sheet.filename
                    ? `<link type="text/css" rel="stylesheet" href="${sheet.filename}" />`
                    : sheet.contents
                      ? `<style>${sheet.contents}</style>`
                      : ""
            )
            .join("")}
    </head>
    <body>
        <div class="user-contents" id="flow">
            ${html}
        </div>
    </body>
</html>`

const CSS_PAPER_SIZES = {
    folio: "12in 15in",
    quarto: "9.5in 12in",
    octavo: "6in 9in",
    a5: "A5",
    a4: "A4"
}

export const singleFileHTMLBookCSSTemplate = ({papersize}) =>
    `a.fn {
      -adapt-template: url(data:application/xml,${encodeURI(
          '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:s="http://www.pyroxy.com/ns/shadow"><head><style>.footnote-content{float:footnote}</style></head><body><s:template id="footnote"><s:content/><s:include class="footnote-content"/></s:template></body></html>#footnote'
      )});
      text-decoration: none;
      color: inherit;
      vertical-align: baseline;
      font-size: 70%;
      position: relative;
      top: -0.3em;

  }
  body {
      background-color: white;
  }
  section[role=doc-footnote] .footnote-counter:after {
      content: ". ";
  }
  section.fnlist {
      display: none;
  }
  section:footnote-content {
      display: block;
      font-style:normal;
      font-weight:normal;
      text-decoration:none;
  }
  .table-of-contents a {
      display: inline-flex;
      width: 100%;
      text-decoration: none;
      color: currentColor;
      break-inside: avoid;
      align-items: baseline;
  }
  .table-of-contents a::before {
      margin-left: 1px;
      margin-right: 1px;
      border-bottom: solid 1px lightgray;
      content: "";
      order: 1;
      flex: auto;
  }
  .table-of-contents a::after {
      text-align: right;
      content: target-counter(attr(href, url), page);
      align-self: flex-end;
      flex: none;
      order: 2;
  }
  @page {
      size: ${CSS_PAPER_SIZES[papersize]};
      @top-center {
          content: env(doc-title);
      }
      @bottom-center {
          content: counter(page);
      }
  }
  @page :first {
	          @bottom-center { content: normal; }
	          @top-center { content: normal; }
  }
  figure img {
      max-width: 100%;
  }
  .doc-title {
      page-break-before: right;
      counter-reset: cat-figure cat-equation cat-photo cat-table;
  }
  h1.part {
      page-break-before: right;
  }
  .copyrightpage {
      page-break-before: left;
  }
  .tocpage {
      page-break-before: right;
  }
  .booktitle {
      text-align: center;
  }`
