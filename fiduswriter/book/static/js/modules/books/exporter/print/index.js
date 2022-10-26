import {printHTML} from "@vivliostyle/print"

import {printHTMLTemplate, chapterTemplate} from "./templates"
import {HTMLBookExporter, htmlBookIndexBodyTemplate} from "../html"

const CSS_PAPER_SIZES = {
    folio: "12in 15in",
    quarto: "9.5in 12in",
    octavo: "6in 9in",
    a5: "A5",
    a4: "A4"
}


export class PrintBookExporter extends HTMLBookExporter {

    constructor(schema, csl, documentStyles, book, user, docList) {
        super(schema, csl, documentStyles, book, user, docList)
        this.chapterTemplate = chapterTemplate
        this.indexTemplate = htmlBookIndexBodyTemplate
        this.multiDoc = false
    }

    // We can ignore preparing binary files in print
    prepareBinaryFiles() {
        return []
    }

    exportThree() {
        const html = this.outputList.filter(
                ({filename}) => filename.slice(-5) === ".html"
            ).sort(
                (a, b) => {
                    if (a.filename === "index.html") {
                        return -1
                    }
                    if (b.filename === "index.html") {
                        return 1
                    }
                    if (parseInt(a.filename.match(/\d+/g)) < parseInt(b.filename.match(/\d+/g))) {
                        return -1
                    }
                    if (parseInt(a.filename.match(/\d+/g)) > parseInt(b.filename.match(/\d+/g))) {
                        return 1
                    }
                    return 0
                }).map(({contents}) => contents).join(""),
            css = this.getBookCSS(),
            title = this.book.title,
            settings = this.book.settings,
            htmlDoc = printHTMLTemplate({css, html, title, settings})

        const config = {title}

        if (navigator.userAgent.includes("Gecko/")) {
            // Firefox has issues printing images when in iframe. This workaround can be
            // removed once that has been fixed. TODO: Add gecko bug number if there is one.
            config.printCallback = iframeWin => {
                const oldBody = document.body
                document.body.parentElement.dataset.vivliostylePaginated = true
                document.body = iframeWin.document.body
                iframeWin.document.querySelectorAll("style").forEach(el => document.body.appendChild(el))
                const backgroundStyle = document.createElement("style")
                backgroundStyle.innerHTML = "body {background-color: white;}"
                document.body.appendChild(backgroundStyle)
                window.print()
                document.body = oldBody
                delete document.body.parentElement.dataset.vivliostylePaginated
            }
        }

        printHTML(
            htmlDoc,
            config
        )

    }

    getBookCSS() {
        let css = `a.fn {
            -adapt-template: url(data:application/xml,${
    encodeURI(
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:s=\"http://www.pyroxy.com/ns/shadow\"><head><style>.footnote-content{float:footnote}</style></head><body><s:template id=\"footnote\"><s:content/><s:include class=\"footnote-content\"/></s:template></body></html>#footnote"
    )
});
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
        .article-title {
            counter-reset: cat-figure cat-equation cat-photo cat-table;
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
            size: ${CSS_PAPER_SIZES[this.book.settings.papersize]};
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
        .article-title {
            page-break-before: right;
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
        const bookStyle = this.documentStyles.find(style => style.slug === this.book.settings.book_style)
        if (bookStyle) {
            let contents = bookStyle.contents
            bookStyle.bookstylefile_set.forEach(
                ([url, filename]) => contents = contents.replace(
                    new RegExp(filename, "g"),
                    url
                )
            )
            css += contents
        }

        return css
    }
}
