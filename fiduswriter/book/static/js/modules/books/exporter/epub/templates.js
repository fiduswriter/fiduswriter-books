import {escapeText, localizeDate} from "../../../common"
import {LANGUAGES} from "../../../schema/const"
import {bookTerm} from "../../i18n"

/** A template to create the OPF file of book epubs. */
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
    coverImage,
    mathliveOpfIncludes,
    user
}) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="${idType}"
        xml:lang="${language}" prefix="cc: http://creativecommons.org/ns#">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier id="${idType}">${book.id}</dc:identifier>
        <dc:title>${escapeText(book.title)}</dc:title>
        <dc:creator>
            ${
    book.metadata.author && book.metadata.author.length ?
        escapeText(book.metadata.author) :
        escapeText(user.name)
}
        </dc:creator>
        <dc:language>${language}</dc:language>
        <meta property="dcterms:modified">${modified}</meta>
        <dc:date>${date}</dc:date>
        ${
    book.metadata.copyright && book.metadata.copyright.length ?
        `<dc:rights>${escapeText(book.metadata.copyright)}</dc:rights>` :
        ""
}
        ${
    book.metadata.publisher && book.metadata.publisher.length ?
        `<dc:publisher>${escapeText(book.metadata.publisher)}</dc:publisher>` :
        ""
}
        ${
    book.metadata.keywords && book.metadata.keywords.length ?
        book.metadata.keywords.split(",").map(keyword =>
            `<dc:subject>${escapeText(keyword.trim())}</dc:subject>`
        ).join("") :
        ""
}
    </metadata>
    <manifest>
        ${
    coverImage ?
        "<item id=\"cover\" href=\"cover.xhtml\" media-type=\"application/xhtml+xml\"/>" :
        ""
}
        <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>
        ${
    chapters.map(chapter =>
        `<item id="t${chapter.number}" href="document-${chapter.number}.xhtml"
                        media-type="application/xhtml+xml" />`
    ).join("")
}
        <item id="nav" href="document-nav.xhtml" properties="nav"
                media-type="application/xhtml+xml" />
        <item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>
        ${
    images.map((image, index) =>
        `<item ${
            image.coverImage ?
                "id=\"cover-image\" properties=\"cover-image\"" :
                `id="img${index}"`
        } href="${image.filename}" media-type="image/${
            image.filename.split(".")[1] === "png" ?
                "png" :
                image.filename.split(".")[1] === "svg" ?
                    "svg+xml" :
                    "jpeg"
        }"/>`
    ).join("")
}
        ${
    fontFiles.map((fontFile, index) =>
        `<item ${
            `id="font${index}"`
        } href="${
            fontFile.filename
        }" media-type="font/${
            fontFile.filename.split(".")[1] === "woff" ?
                "woff" :
                fontFile.filename.split(".")[1] === "woff2" ?
                    "woff2" :
                    "sfnt"
        }" />`
    ).join("")
}
        ${
    styleSheets.map((sheet, index) =>
        `<item id="css${index}" href="${escapeText(sheet.filename)}"
                        media-type="text/css" />`
    ).join("")
}
        ${
    math ?
        mathliveOpfIncludes :
        ""
}
        <!-- ncx included for 2.0 reading system compatibility: -->
        <item id="ncx" href="document.ncx" media-type="application/x-dtbncx+xml" />
    </manifest>
    <spine toc="ncx">
        ${
    coverImage ?
        "<itemref idref=\"cover\" linear=\"no\"/>" :
        ""
}
        <itemref idref="titlepage" linear="yes"/>
        ${
    chapters.map(
        chapter => `<itemref idref="t${chapter.number}" linear="yes" />`
    ).join("")
}
        <itemref idref="copyright" linear="yes"/>
        <itemref idref="nav" linear="no"/>
    </spine>
</package>`


/** A template to create the book epub cover XML. */
export const epubBookCoverTemplate = ({
    book,
    coverImage,
    shortLang
}) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${shortLang}" lang="${shortLang}">
    <head>
        <title>${book.title}</title>
        <meta charset="utf-8"/>
    </head>
    <body class="epub cover">
        <div id="cover">
            <img src="${coverImage.image.split("/").pop().split("?")[0]}"
                    alt="${bookTerm("Cover image", book.settings.language)}" title="${bookTerm("Cover image", book.settings.language)}"/>
        </div>
    </body>
</html>`

/** A template to create the book epub titlepage XML. */
export const epubBookTitlepageTemplate = ({
    book,
    shortLang
}) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"  xml:lang="${shortLang}" lang="${shortLang}">
   <head>
      <title>${escapeText(book.title)}</title>
      <meta charset="utf-8"/>
   </head>
   <body class="epub titlepage">
      <div id="title" epub:type="frontmatter titlepage">
          <h1 class="booktitle">${escapeText(book.title)}</h1>
          ${
    book.metadata.subtitle.length ?
        `<h2 class="booksubtitle">${escapeText(book.metadata.subtitle)}</h2>` :
        ""
}
          ${
    book.metadata.version?.length ?
        `<h4 class="bookversion">${escapeText(book.metadata.version)}</h4>` :
        ""
}
          ${
    book.metadata.author.length ?
        `<h3 class="bookauthor">${bookTerm("by", book.settings.language)} ${escapeText(book.metadata.author)}</h3>` :
        ""
}
      </div>
   </body>
</html>`

/** A template to create the book epub copyright page XML. */
export const epubBookCopyrightTemplate = ({
    book,
    language,
    shortLang,
    creator
}) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"  xml:lang="${shortLang}" lang="${shortLang}">
    <head>
        <title>${escapeText(book.title)}</title>
        <meta charset="utf-8"/>
    </head>
    <body class="epub copyrightpage">
        <section epub:type="frontmatter copyright-page">
            <div id="copyright">
                <p>
                    ${escapeText(book.title)}
                    ${
    book.metadata.author.length ?
        `${bookTerm("by", book.settings.language)} ${escapeText(book.metadata.author)}` :
        ""
}
                </p>
                ${
    book.metadata.copyright.length ?
        `<p>${escapeText(book.metadata.copyright)}</p>` :
        ""
}
                <p>${bookTerm("Title", book.settings.language)}: ${escapeText(book.title)}</p>
                ${
    book.metadata.author.length ?
        `<p>${bookTerm("Author", book.settings.language)}: ${escapeText(book.metadata.author)}</p>` :
        ""
}
                ${
    book.metadata.publisher && book.metadata.publisher.length ?
        `<p>${bookTerm("Published by", book.settings.language)}: ${escapeText(book.metadata.publisher)}</p>` :
        ""
}
                <p>${bookTerm("Last updated", book.settings.language)}: ${localizeDate(book.updated * 1000, "sortable-date")}</p>
                <p>${bookTerm("Created", book.settings.language)}: ${localizeDate(book.added * 1000, "sortable-date")}</p>
                <p>${bookTerm("Language", book.settings.language)}: ${LANGUAGES.find(lang => lang[0] === language)[1]}</p>
                <p>${bookTerm("Created by", book.settings.language)}: ${escapeText(creator)}</p>
            </div>
        </section>
    </body>
</html>`
