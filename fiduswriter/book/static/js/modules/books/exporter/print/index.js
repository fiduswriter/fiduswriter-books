import {vivliostylePrint} from "vivliostyle-print"

import {printHTMLTemplate, chapterTemplate} from "./templates"
import {HTMLBookExporter} from "../html"

const CSS_PAPER_SIZES = {
    folio: "12in 15in",
    quarto: "9.5in 12in",
    octavo: "6in 9in",
    a5: "A5",
    a4: "A4"
}


export class PrintBookExporter extends HTMLBookExporter {

    constructor(schema, staticUrl, csl, documentStyles, book, user, docList) {
        super(schema, staticUrl, csl, documentStyles, book, user, docList)
        this.chapterTemplate = chapterTemplate
    }

    // We can ignore preparing binary files in print
    prepareBinaryFiles() {
        return []
    }


    exportThree(outputList) {
        const html = outputList.map(({filename, contents}) => {
            if (filename.slice(0, 9) !== 'document-' || filename.slice(-5) !== '.html') {
                return ''
            }
            return contents
        }).join(''),
            css = this.getBookCSS(),
            title = this.book.title,
            htmlDoc = printHTMLTemplate({css, html, title, staticUrl: this.staticUrl})
        vivliostylePrint(
            htmlDoc,
            {
                title,
                resourcesUrl: `${this.staticUrl}vivliostyle-resources/`
            }
        )
    }

    getBookCSS() {
        let css = `a.fn {
            -adapt-template: url(data:application/xml,${
                encodeURI(
                    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:s="http://www.pyroxy.com/ns/shadow"><head><style>.footnote-content{float:footnote}</style></head><body><s:template id="footnote"><s:content/><s:include class="footnote-content"/></s:template></body></html>#footnote'
                )
            });
            text-decoration: none;
            color: inherit;
            vertical-align: super;
            font-size: 70%;
        }
        section[role=doc-footnote] > *:first-child:before {
            counter-increment: footnote-counter;
            content: counter(footnote-counter) ". ";
        }
        section.fnlist {
            display: none;
        }
        section:footnote-content {
            display: block;
        }
        .article-title {
            page-break-before: right;
        }
        @page {
            size: ${CSS_PAPER_SIZES[this.book.settings.papersize]};
            @bottom-center {
                content: counter(page);
            }
        }
        figure img {
            max-width: 100%;
        }
        `
        const bookStyle = this.documentStyles.find(style => style.slug === this.book.settings.book_style)
        if (bookStyle) {
            let contents = bookStyle.contents
            bookStyle.bookstylefile_set.forEach(
                ([url, filename]) => contents = contents.replace(
                    new RegExp(filename, 'g'),
                    url
                )
            )
            css += contents
        }

        return css
    }

    getFootnoteAnchor(counter) {
        const footnoteAnchor = super.getFootnoteAnchor(counter)
        // Add the counter directly into the footnote.
        footnoteAnchor.innerHTML = counter
        return footnoteAnchor
    }
}
