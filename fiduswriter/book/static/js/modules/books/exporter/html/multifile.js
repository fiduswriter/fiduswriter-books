import download from "downloadjs"
import pretty from "pretty"
import {DOMSerializer} from "prosemirror-model"

import {getMissingChapterData, uniqueObjects} from "../tools"
import {htmlBookExportTemplate, htmlBookIndexTemplate} from "./templates"
import {removeHidden} from "../../../exporter/tools/doc_content"
import {setLinks, orderLinks} from "../../../exporter/epub/tools"
import {DOMExporter} from "../../../exporter/tools/dom_export"
import {createSlug} from "../../../exporter/tools/file"
import {modifyImages} from "../../../exporter/tools/html"
import {ZipFileCreator} from "../../../exporter/tools/zip"
import {RenderCitations} from "../../../citations/render"
import {addAlert} from "../../../common"
import {BIBLIOGRAPHY_HEADERS, CATS} from "../../../schema/i18n"
import {LANGUAGES} from "../../../schema/const"

export class HTMLBookExporter extends DOMExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated) {
        super(schema, csl, bookStyles)
        this.book = book
        this.user = user
        this.docList = docList
        this.updated = updated

        this.multiDoc = true
        this.chapters = []
        this.includeZips = []
        this.outputList = []
        this.math = false
        this.chapterTemplate = htmlBookExportTemplate
        this.indexTemplate = htmlBookIndexTemplate
        this.styleSheets = [
            {url: staticUrl("css/book.css")}
        ]
    }

    init() {
        if (this.book.chapters.length === 0) {
            addAlert("error", gettext("Book cannot be exported due to lack of chapters."))
            return false
        }

        return getMissingChapterData(this.book, this.docList, this.schema).then(
            () => this.exportOne()
        )
    }

    addBookStyle() {
        const bookStyle = this.documentStyles.find(bookStyle => bookStyle.slug === this.book.settings.book_style)
        if (!bookStyle) {
            return false
        }
        // The files will be in the base directory. The filenames of
        // BookStyleFiles will therefore not need to replaced with their URLs.
        let contents = bookStyle.contents
        bookStyle.bookstylefile_set.forEach(
            ([_url, filename]) => contents = contents.replace(
                new RegExp(filename, "g"),
                `media/${filename}`
            )
        )

        this.styleSheets.push({contents, filename: `css/${bookStyle.slug}.css`})
        this.fontFiles = this.fontFiles.concat(bookStyle.bookstylefile_set.map(([url, filename]) => ({
            filename: `css/media/${filename}`,
            url
        })))
        return `css/${bookStyle.slug}.css`
    }


    getBookFootnoteAnchor(chapterCounter, bookCounter) {
        const footnoteAnchor = document.createElement("a")
        footnoteAnchor.setAttribute("href", "#fn" + bookCounter)
        // RASH 0.5 doesn't mark the footnote anchors, so we add this class
        footnoteAnchor.classList.add("fn")
        footnoteAnchor.innerHTML = `<span class="footnote-counter" data-chapter-counter="${chapterCounter}" data-book-counter="${bookCounter}"></span>`
        return footnoteAnchor
    }

    addFootnotes(
        contentsEl,
        offset // Offset for continous footnote counting throughout book.
    ) {
        // Replace the footnote markers with anchors and put footnotes with contents
        // at the back of the document.
        // Also, link the footnote anchor with the footnote according to
        // https://rawgit.com/essepuntato/rash/master/documentation/index.html#footnotes.
        const footnotes = contentsEl.querySelectorAll(".footnote-marker")
        const footnotesContainer = document.createElement("section")
        footnotesContainer.classList.add("fnlist")
        footnotesContainer.setAttribute("role", "doc-footnotes")

        footnotes.forEach(
            (footnote, index) => {
                const chapterCounter = index + 1
                const bookCounter = offset + chapterCounter
                const footnoteAnchor = this.getBookFootnoteAnchor(chapterCounter, bookCounter)
                footnote.parentNode.replaceChild(footnoteAnchor, footnote)
                const newFootnote = document.createElement("section")
                newFootnote.id = "fn" + bookCounter
                newFootnote.setAttribute("role", "doc-footnote")
                newFootnote.dataset.chapterCounter = chapterCounter
                newFootnote.dataset.bookCounter = bookCounter
                newFootnote.innerHTML = footnote.dataset.footnote
                const newFootnoteCounter = document.createElement("span")
                newFootnoteCounter.classList.add("footnote-counter")
                newFootnoteCounter.dataset.chapterCounter = chapterCounter
                newFootnoteCounter.dataset.bookCounter = bookCounter
                if (["P", "H1", "H2", "H3", "H4", "H5", "H6"].includes(newFootnote.firstElementChild?.tagName)) {
                    newFootnote.firstElementChild.prepend(newFootnoteCounter)
                } else {
                    newFootnote.prepend(newFootnoteCounter)
                }
                footnotesContainer.appendChild(newFootnote)
            }
        )
        contentsEl.appendChild(footnotesContainer)
        return offset + footnotes.length
    }

    getChapterLink(chapterNumber) {
        return `document-${chapterNumber}.html`
    }

    exportOne() {
        let footnoteCounter = 0, figureCounter = 0, equationCounter = 0,
            photoCounter = 0, tableCounter = 0

        this.chapters = this.book.chapters.sort(
            (a, b) => a.number > b.number ? 1 : -1
        ).map(chapter => {
            let chapterFigureCounter = 0, chapterEquationCounter = 0,
                chapterPhotoCounter = 0, chapterTableCounter = 0
            const doc = this.docList.find(doc => doc.id === chapter.text),
                schema = this.schema
            schema.cached.imageDB = {db: doc.images}
            const docContent = removeHidden(doc.content, false),
                serializer = DOMSerializer.fromSchema(schema),
                contents = serializer.serializeNode(schema.nodeFromJSON(docContent)),
                equations = contents.querySelectorAll(".equation"),
                figureEquations = contents.querySelectorAll(".figure-equation")
            footnoteCounter = this.addFootnotes(contents, footnoteCounter)
            if (equations.length || figureEquations.length) {
                this.math = true
            }
            contents.querySelectorAll("figure[data-category='figure'] figcaption span.label").forEach(
                el => {
                    el.innerHTML = CATS["figure"][doc.settings.language]
                    el.dataset.bookCounter = ++figureCounter
                    el.dataset.chapterCounter = ++chapterFigureCounter
                    el.classList.add("label-counter")
                    el.classList.remove("label")
                }
            )
            contents.querySelectorAll("figure[data-category='equation'] figcaption span.label").forEach(
                el => {
                    el.innerHTML = CATS["equation"][doc.settings.language]
                    el.dataset.bookCounter = ++equationCounter
                    el.dataset.chapterCounter = ++chapterEquationCounter
                    el.classList.add("label-counter")
                    el.classList.remove("label")
                }
            )
            contents.querySelectorAll("figure[data-category='photo'] figcaption span.label").forEach(
                el => {
                    el.innerHTML = CATS["photo"][doc.settings.language]
                    el.dataset.bookCounter = ++photoCounter
                    el.dataset.chapterCounter = ++chapterPhotoCounter
                    el.classList.add("label-counter")
                    el.classList.remove("label")
                }
            )
            contents.querySelectorAll("figure[data-category='table'] figcaption span.label,table[data-category='table'] caption span.label").forEach(
                el => {
                    el.innerHTML = CATS["table"][doc.settings.language]
                    el.dataset.bookCounter = ++tableCounter
                    el.dataset.chapterCounter = ++chapterTableCounter
                    el.classList.add("label-counter")
                    el.classList.remove("label")
                }
            )
            contents.querySelectorAll(".cross-reference").forEach(
                el => {
                    const rEl = contents.querySelector(`#${el.dataset.id} .label-counter`)
                    if (!rEl) {
                        return
                    }
                    el.innerHTML = `<a href="#${el.dataset.id}" class="reference-counter" data-chapter-counter="${rEl.dataset.chapterCounter}" data-book-counter="${rEl.dataset.bookCounter}">${rEl.innerHTML}</a>`
                    delete el.dataset.title
                }
            )

            return {
                doc,
                contents
            }

        })

        const citRendererPromises = this.chapters.map(chapter => {
            // add bibliographies (asynchronously)
            const bibliographyHeader = chapter.doc.settings.bibliography_header[chapter.doc.settings.language] || BIBLIOGRAPHY_HEADERS[chapter.doc.settings.language]
            const citRenderer = new RenderCitations(
                chapter.contents,
                this.book.settings.citationstyle,
                bibliographyHeader,
                {db: chapter.doc.bibliography},
                this.csl
            )
            return citRenderer.init().then(
                () => {
                    const bibHTML = citRenderer.fm.bibHTML
                    if (bibHTML.length > 0) {
                        chapter.contents.innerHTML += bibHTML
                    }
                    this.content = chapter.contents
                    this.cleanHTML(citRenderer.fm)
                    chapter.contents = this.content
                    delete this.content
                    return Promise.resolve()
                }
            )
        })
        return Promise.all(citRendererPromises).then(() => this.exportTwo())

    }

    prepareBinaryFiles(contents) {
        this.binaryFiles = this.binaryFiles.concat(modifyImages(contents))
    }

    exportTwo() {
        const bookStyle = this.addBookStyle()
        let contentItems = []
        let currentPart = false
        this.chapters.forEach((chapter, index) => {
            const contents = chapter.contents,
                doc = chapter.doc,
                title = doc.title,
                styleSheets = []
            if (bookStyle) {
                styleSheets.push({filename: bookStyle})
            }
            this.prepareBinaryFiles(contents)

            if (this.book.chapters[index].part !== "") {
                contentItems.push({
                    link: this.getChapterLink(this.book.chapters[index].number),
                    title: this.book.chapters[index].part,
                    docNum: this.book.chapters[index].number,
                    id: 0,
                    level: -1,
                    subItems: []
                })
                currentPart = this.book.chapters[index].part
            }

            // Make links to all H1-3 and create a TOC list of them
            contentItems.push(...setLinks(contents, this.book.chapters[index].number))

            const contentsCode = this.replaceImgSrc(contents.innerHTML)

            const htmlCode = this.chapterTemplate({
                part: this.book.chapters[index].part,
                currentPart,
                title,
                metadata: doc.metadata,
                settings: doc.settings,
                styleSheets,
                contents: contentsCode,
                math: this.math
            })

            this.outputList.push({
                filename: `document-${this.book.chapters[index].number}.html`,
                contents: pretty(htmlCode, {ocd: true})
            })
        })

        contentItems = orderLinks(contentItems)

        this.outputList.push({
            filename: "index.html",
            contents: pretty(this.indexTemplate({
                contentItems,
                book: this.book,
                creator: this.user.name,
                styleSheets: [{filename: bookStyle}],
                language: LANGUAGES.find(lang => lang[0] === this.book.settings.language)[1],
                multiDoc: this.multiDoc
            }), {ocd: true})
        })

        return this.exportThree()

    }

    exportThree() {
        this.binaryFiles = uniqueObjects(this.binaryFiles.concat(this.fontFiles))
        this.styleSheets = uniqueObjects(this.styleSheets)
        if (this.math) {
            this.includeZips.push({
                "directory": "css",
                "url": staticUrl("zip/mathlive_style.zip")
            })
        }

        return this.loadStyles().then(
            () => {
                this.styleSheets.forEach(styleSheet => {
                    if (styleSheet.filename) {
                        this.outputList.push(styleSheet)
                    }
                })
                return this.createZip()
            }
        )
    }

    createZip() {
        const zipper = new ZipFileCreator(
            this.outputList,
            this.binaryFiles,
            this.includeZips,
            undefined,
            this.updated
        )
        return zipper.init().then(
            blob => this.download(blob)
        )
    }

    download(blob) {
        return download(blob, createSlug(this.book.title) + ".html.zip", "application/zip")
    }

}
