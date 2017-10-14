import {DOMSerializer} from "prosemirror-model"

import {escapeText} from "../common"

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
export let bookPrintTemplate = ({book, docSchema}) => {
    let serializer = DOMSerializer.fromSchema(docSchema)
    return book.chapters.map(
        chapter => {
            let subtitleNode = docSchema.nodeFromJSON(
                chapter.contents.content.find(node => node.type==="subtitle")
            )
            let abstractNode = docSchema.nodeFromJSON(
                chapter.contents.content.find(node => node.type==="abstract")
            )

            return `${
                chapter.part && chapter.part.length ?
                `<div class="part">
                    <h1>${escapeText(chapter.part)}</h1>
                </div>` :
                ''
            }
            <div class="chapter">
                <h1 class="title">${escapeText(chapter.title)}</h1>
                ${
                    subtitleNode.attrs.hidden ?
                        '' :
                        serializer.serializeNode(subtitleNode).outerHTML
                }
                ${
                    abstractNode.attrs.hidden ?
                        '' :
                        serializer.serializeNode(abstractNode).outerHTML
                }
                ${
                    serializer.serializeNode(
                        docSchema.nodeFromJSON(
                            chapter.contents.content.find(node => node.type==="body")
                        )
                    ).outerHTML
                }
            </div>`
        }
    ).join('')
}
