import {escapeText} from "../../../common"

/** A template for HTML export of a book. */
export const htmlBookExportTemplate = ({styleSheets, part, currentPart, contents, title}) =>
    `<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link type="text/css" rel="stylesheet" href="css/document.css" />
        ${
    styleSheets.map(sheet =>
        `<link type="text/css" rel="stylesheet" href="${sheet.filename}" />`
    ).join('')
}
    </head>
    <body class="book-chapter${currentPart && currentPart.length ? ` ${currentPart.toLowerCase().replace(/[^a-z]/g, '')}` : ''}">
        ${
    part && part.length ?
        `<h1 class="part">${escapeText(part)}</h1>` :
        ''
}
        ${contents}
    </body>
</html>`

/** A template to create the book index item. */
const htmlBookIndexItemTemplate = ({item}) =>
    `<li>
        <a href="${
    item.link ?
        item.link :
        item.docNum ?
            `document-${item.docNum}.html#${item.id}` :
            `document.html#${item.id}`
}">
            ${escapeText(item.title)}
        </a>
        ${
    item.subItems.length ?
        `<ol>
                ${
    item.subItems.map(subItem =>
        htmlBookIndexItemTemplate({item: subItem})
    ).join('')
}
            </ol>` :
        ''
}
    </li>`

/** A template to create the book index. */
export const htmlBookIndexTemplate = ({book, contentItems, language, creator, styleSheets}) =>
    `<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8"></meta>
        <title>${escapeText(book.title)}</title>
        <link type="text/css" rel="stylesheet" href="css/document.css" />
        ${
    styleSheets.map(sheet =>
        `<link type="text/css" rel="stylesheet" href="${sheet.filename}" />`
    ).join('')
}
    </head>
    <body class="book-index">
        <h1>${escapeText(book.title)}</h1>
        ${
    book.metadata.subtitle.length ?
        `<h2>${escapeText(book.metadata.subtitle)}</h2>` :
        ''
}
        ${
    book.metadata.author.length ?
        `<h3>${gettext('by')} ${escapeText(book.metadata.author)}</h3>` :
        ''
}
        <nav role="doc-toc"><ol>
            ${
    contentItems.map(item =>
        htmlBookIndexItemTemplate({item})
    ).join('')
}
        </ol></nav>
        ${
    book.metadata.publisher && book.metadata.publisher.length ?
        `<p>${gettext('Published by')}: ${escapeText(book.metadata.publisher)}</p>` :
        ''
}
        <p>${gettext('Last Updated')}: ${book.updated}</p>
        <p>${gettext('Created')}: ${book.added}</p>
        <p>${gettext('Language')}: ${language}</p>
        <p>${gettext('Created by')}: ${escapeText(creator)}</p>
    </body>
</html>`
