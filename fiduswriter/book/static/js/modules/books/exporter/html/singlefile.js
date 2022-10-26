import pretty from "pretty"

import {singleFileHTMLBookTemplate, singleFileHTMLBookChapterTemplate, htmlBookIndexBodyTemplate} from "./templates"
import {HTMLBookExporter} from "./multifile"

const CSS_PAPER_SIZES = {
    folio: "12in 15in",
    quarto: "9.5in 12in",
    octavo: "6in 9in",
    a5: "A5",
    a4: "A4"
}


export class SingleFileHTMLBookExporter extends HTMLBookExporter {

    constructor(schema, csl, documentStyles, book, user, docList) {
        super(schema, csl, documentStyles, book, user, docList)
        this.chapterTemplate = singleFileHTMLBookChapterTemplate
        this.indexTemplate = htmlBookIndexBodyTemplate
        this.multiDoc = false

    }

    getChapterLink(chapterNumber) {
        return `#_${chapterNumber}_0`
    }

    exportThree() {
        let html = ""
        this.outputList = this.outputList.sort(
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
            }).filter(({filename, contents}) => {
            if (filename.slice(-5) !== ".html") {
                return true
            }
            html += contents
            return false
        })
        const css = this.getBookCSS(),
            title = this.book.title,
            settings = this.book.settings,
            htmlDoc = singleFileHTMLBookTemplate({css, html, title, styleSheets: this.styleSheets, settings})


        this.outputList.push({filename: "index.html", contents: pretty(htmlDoc, {ocd: true})})

        return super.exportThree()

    }


    getBookCSS() {
        const css = `a.fn {
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

        return css
    }


}
