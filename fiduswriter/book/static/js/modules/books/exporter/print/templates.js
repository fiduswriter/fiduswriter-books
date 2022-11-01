import {escapeText} from "../../../common"

export const chapterTemplate = ({part, contents}) => `
    ${
    part && part.length ?
        `<h1 class="part">${escapeText(part)}</h1>` :
        ""
}
    ${contents}`

export const printHTMLTemplate = ({css, html, title, settings}) => `<!DOCTYPE html>
<html lang="${settings.language.split("-")[0]}">
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link type="text/css" rel="stylesheet" href="${staticUrl("css/book.css")}" />
        <style>
            ${css}
        </style>
    </head>
    <body class="user-contents">
        ${html}
    </body>
</html>`
