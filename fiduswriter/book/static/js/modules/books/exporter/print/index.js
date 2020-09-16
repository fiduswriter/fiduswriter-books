import {printHTML} from '@vivliostyle/print'

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

    constructor(schema, csl, documentStyles, book, user, docList) {
        super(schema, csl, documentStyles, book, user, docList)
        this.chapterTemplate = chapterTemplate
    }

    // We can ignore preparing binary files in print
    prepareBinaryFiles() {
        return []
    }

    exportThree() {
        const html = this.outputList.map(({filename, contents}) => {
                if (filename.slice(0, 9) !== 'document-' || filename.slice(-5) !== '.html') {
                    return ''
                }
                return contents
            }).join(''),
            css = this.getBookCSS(),
            title = this.book.title,
            htmlDoc = printHTMLTemplate({css, html, title})
        printHTML(
            htmlDoc,
            {
                title
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
            vertical-align: baseline;
            font-size: 70%;
            position: relative;
            top: -0.3em;

        }
        .article-title, section[role=doc-footnotes] {
            counter-reset: figure-cat-0 figure-cat-1 figure-cat-2 footnote-counter footnote-marker-counter;
        }
        section[role=doc-footnote] > *:first-child:before {
            counter-increment: footnote-counter;
            content: counter(footnote-counter) ". ";
        }
        section[role=doc-footnote] .figure-cat-figure::after {
            content: ' ' counter(figure-cat-0) 'A';
        }
        section[role=doc-footnote] .figure-cat-photo::after {
            content: ' ' counter(figure-cat-1) 'A';
        }
        section[role=doc-footnote] .figure-cat-table::after {
            content: ' ' counter(figure-cat-2) 'A';
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
        figure img {
            max-width: 100%;
        }
        .article-title {
            page-break-before: right;
        }
        h1.part {
            page-break-before: right;
        }`
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
