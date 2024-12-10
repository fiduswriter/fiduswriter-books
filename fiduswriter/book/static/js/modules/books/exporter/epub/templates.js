import {escapeText, localizeDate} from "../../../common"
import {mathliveOpfIncludes} from "../../../mathlive/opf_includes"
import {LANGUAGES} from "../../../schema/const"
import {bookTerm} from "../../i18n"

export const containerTemplate = () => `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
    <rootfiles>
        <rootfile full-path="EPUB/document.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`

export const epubBookCoverTemplate = ({book, coverImage, shortLang}) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${shortLang}" lang="${shortLang}">
    <head>
        <title>${escapeText(book.title)}</title>
        <meta charset="utf-8"/>
    </head>
    <body class="epub cover">
        <div id="cover">
            <img src="${coverImage.image.split("/").pop().split("?")[0]}"
                alt="${bookTerm("Cover image", book.settings.language)}"
                title="${bookTerm("Cover image", book.settings.language)}"/>
        </div>
    </body>
</html>`

export const epubBookTitlepageTemplate = ({book, shortLang}) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${shortLang}" lang="${shortLang}">
    <head>
        <title>${escapeText(book.title)}</title>
        <meta charset="utf-8"/>
    </head>
    <body class="epub titlepage">
        <div id="title" epub:type="frontmatter titlepage">
            <h1 class="booktitle">${escapeText(book.title)}</h1>
            ${
                book.metadata.subtitle
                    ? `<h2 class="booksubtitle">${escapeText(book.metadata.subtitle)}</h2>`
                    : ""
            }
            ${
                book.metadata.author
                    ? `<h3 class="bookauthor">${bookTerm("by", book.settings.language)} ${escapeText(book.metadata.author)}</h3>`
                    : ""
            }
            ${
                book.metadata.version
                    ? `<h4 class="bookversion">${escapeText(book.metadata.version)}</h4>`
                    : ""
            }
        </div>
    </body>
</html>`

export const epubBookCopyrightTemplate = ({
    book,
    language,
    shortLang,
    creator
}) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${shortLang}" lang="${shortLang}">
    <head>
        <title>${escapeText(book.title)}</title>
        <meta charset="utf-8"/>
    </head>
    <body class="epub copyrightpage">
        <section epub:type="frontmatter copyright-page">
            <div id="copyright">
                <p>${escapeText(book.title)}${
                    book.metadata.author
                        ? ` ${bookTerm("by", book.settings.language)} ${escapeText(book.metadata.author)}`
                        : ""
                }</p>
                ${
                    book.metadata.copyright
                        ? `<p>${escapeText(book.metadata.copyright)}</p>`
                        : ""
                }
                <p>${bookTerm("Title", book.settings.language)}: ${escapeText(book.title)}</p>
                ${
                    book.metadata.author
                        ? `<p>${bookTerm("Author", book.settings.language)}: ${escapeText(book.metadata.author)}</p>`
                        : ""
                }
                ${
                    book.metadata.publisher
                        ? `<p>${bookTerm("Published by", book.settings.language)}: ${escapeText(book.metadata.publisher)}</p>`
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
                <p>${bookTerm("Language", book.settings.language)}: ${
                    LANGUAGES.find(lang => lang[0] === language)[1]
                }</p>
                <p>${bookTerm("Created by", book.settings.language)}: ${escapeText(creator)}</p>
            </div>
        </section>
    </body>
</html>`

export const epubBookOpfTemplate = ({
    book,
    language,
    idType,
    date,
    modified,
    styleSheets,
    math,
    images,
    fontFiles,
    chapters,
    user
}) => `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0"
    unique-identifier="${idType}" xml:lang="${language}"
    prefix="cc: http://creativecommons.org/ns#">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier id="${idType}">${book.id}</dc:identifier>
        <dc:title>${escapeText(book.title)}</dc:title>
        <dc:creator>${
            book.metadata.author && book.metadata.author.length
                ? escapeText(book.metadata.author)
                : escapeText(user.name)
        }</dc:creator>
        <dc:language>${language}</dc:language>
        <meta property="dcterms:modified">${modified}</meta>
        <dc:date>${date}</dc:date>
        ${
            book.metadata.copyright
                ? `<dc:rights>${escapeText(book.metadata.copyright)}</dc:rights>`
                : ""
        }
        ${
            book.metadata.publisher
                ? `<dc:publisher>${escapeText(book.metadata.publisher)}</dc:publisher>`
                : ""
        }
        ${
            book.metadata.keywords
                ? book.metadata.keywords
                      .split(",")
                      .map(
                          keyword =>
                              `<dc:subject>${escapeText(keyword.trim())}</dc:subject>`
                      )
                      .join("")
                : ""
        }
    </metadata>
    <manifest>
        ${
            book.cover_image
                ? '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>'
                : ""
        }
        <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>
        ${chapters
            .map(
                chapter =>
                    `<item id="t${chapter.number}" href="document-${chapter.number}.xhtml"
                    media-type="application/xhtml+xml" />`
            )
            .join("")}
        <item id="nav" href="document-nav.xhtml" properties="nav"
            media-type="application/xhtml+xml" />
        <item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>
        ${images
            .map(
                (image, index) =>
                    `<item ${
                        image.coverImage
                            ? 'id="cover-image" properties="cover-image"'
                            : `id="img${index}"`
                    } href="${image.filename}" media-type="${image.mimeType}"/>`
            )
            .join("")}
        ${fontFiles
            .map(
                (font, index) =>
                    `<item id="font${index}" href="${font.filename}"
                    media-type="${font.mimeType}" />`
            )
            .join("")}
        ${styleSheets
            .map(
                (sheet, index) =>
                    `<item id="css${index}" href="${sheet.filename}"
                    media-type="text/css" />`
            )
            .join("")}
        ${math ? mathliveOpfIncludes : ""}
        <item id="ncx" href="document.ncx" media-type="application/x-dtbncx+xml" />
    </manifest>
    <spine toc="ncx">
        ${book.cover_image ? '<itemref idref="cover" linear="no"/>' : ""}
        <itemref idref="titlepage" linear="yes"/>
        ${chapters
            .map(
                chapter => `<itemref idref="t${chapter.number}" linear="yes" />`
            )
            .join("")}
        <itemref idref="copyright" linear="yes"/>
        <itemref idref="nav" linear="no"/>
    </spine>
</package>`

export const navTemplate = ({shortLang, toc, styleSheets}) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${shortLang}"
    lang="${shortLang}" xmlns:epub="http://www.idpf.org/2007/ops">
    <head>
        <meta charset="utf-8"/>
        <title>Navigation</title>
        ${styleSheets
            .map(
                sheet =>
                    `<link rel="stylesheet" type="text/css" href="${sheet.filename}" />`
            )
            .join("")}
    </head>
    <body class="epub navigation">
        <nav epub:type="toc" id="toc">
            <ol>
                ${renderTocItems(toc)}
            </ol>
        </nav>
    </body>
</html>`

const renderTocItems = items =>
    items
        .map(
            item => `
    <li>
        <a href="${item.link}">${escapeText(item.title)}</a>
        ${
            item.children?.length
                ? `<ol>${renderTocItems(item.children)}</ol>`
                : ""
        }
    </li>
`
        )
        .join("")

export const ncxTemplate = ({shortLang, idType, id, title, toc}) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${shortLang}">
    <head>
        <meta name="dtb:${idType}" content="${id}"/>
    </head>
    <docTitle>
        <text>${escapeText(title)}</text>
    </docTitle>
    <navMap>
        ${renderNcxItems(toc)}
    </navMap>
</ncx>`

const renderNcxItems = (items, counter = {count: 1}) =>
    items
        .map(
            item => `
    <navPoint id="np-${counter.count++}" playOrder="${counter.count}">
        <navLabel>
            <text>${escapeText(item.title)}</text>
        </navLabel>
        <content src="${item.link}"/>
        ${item.children?.length ? renderNcxItems(item.children, counter) : ""}
    </navPoint>
`
        )
        .join("")
