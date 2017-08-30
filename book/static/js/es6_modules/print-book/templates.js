import {escapeText} from "../../common"

/** A template for the initial pages of a book before the contents begin. */
export let bookPrintStartTemplate = ({book}) =>
    `<h1 id="document-title">${escapeText(book.title)}</h1>
    ${
        book.metadata.subtitle && book.metadata.subtitle.length ?
        `<h2 id="metadata-subtitle">${escapeText(book.metadata.subtitle)}</h2>` :
        ''
    }
    ${
        book.metadata.author && book.metadata.author.length ?
        `<h3>${escapeText(book.metadata.author)}</h3>` :
        ''
    }
    <div class="pagination-pagebreak"></div>
    ${
        book.metadata.publisher && book.metadata.publisher.length ?
        `<div class="publisher">${escapeText(book.metadata.publisher)}</div>` :
        ''
    }
    ${
        book.metadata.copyright && book.metadata.copyright.length ?
        `<div class="copyright">${escapeText(book.metadata.copyright)}</div>` :
        ''
    }
    <div class="pagination-pagebreak">`

/** A template for the print view of a book. */
export let bookPrintTemplate = ({book, docSchema}) =>
    book.chapters.map(
        chapter =>
        `${
            chapter.part && chapter.part.length ?
            `<div class="part">
                <h1>${escapeText(chapter.part)}</h1>
            </div>` :
            ''
        }
        <div class="chapter">
            <h1 class="title">${escapeText(chapter.title)}</h1>
            ${
                chapter.metadata.subtitle ?
                `<h2 class="metadata-subtitle">${escapeText(chapter.metadata.subtitle)}</h2>` :
                ''
            }
            ${
                chapter.metadata.abstract ?
                `<div class="metadata-abstract">${escapeText(chapter.metadata.abstract)}</div>` :
                ''
            }
            ${
                docSchema.nodeFromJSON(
                    chapter.contents.content.find(node => node.type==="body")
                ).toDOM().innerHTML
            }
        </div>`
    ).join('')
