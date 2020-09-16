import {escapeText} from "../../../common"

export const chapterTemplate = ({part, contents}) => `
    ${
    part && part.length ?
        `<h1 class="part">${escapeText(part)}</h1>` :
        ''
}
    ${contents}`

export const printHTMLTemplate = ({css, html, title}) => `<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link type="text/css" rel="stylesheet" href="${settings_STATIC_URL}css/document.css?v=${transpile_VERSION}" />
        <style>
            ${css}
        </style>
    </head>
    <body class="user-contents">
        ${html}
    </body>
</html>`
