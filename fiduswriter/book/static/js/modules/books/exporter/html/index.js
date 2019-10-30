import {getMissingChapterData, uniqueObjects} from "../tools"
import {htmlBookExportTemplate, htmlBookIndexTemplate} from "./templates"
import {removeHidden} from "../../../exporter/tools/doc_contents"
import {setLinks, orderLinks} from "../../../exporter/epub/tools"
import {DOMExporter} from "../../../exporter/tools/dom_export"
import {createSlug} from "../../../exporter/tools/file"
import {modifyImages} from "../../../exporter/tools/html"
import {ZipFileCreator} from "../../../exporter/tools/zip"
import {RenderCitations} from "../../../citations/render"
import {addAlert} from "../../../common"
import {BIBLIOGRAPHY_HEADERS, FIG_CATS} from "../../../schema/i18n"

import download from "downloadjs"
import {DOMSerializer} from "prosemirror-model"

export class HTMLBookExporter extends DOMExporter {
    constructor(schema, staticUrl, csl, bookStyles, book, user, docList) {
        super(schema, staticUrl, csl, bookStyles)
        this.book = book
        this.user = user
        this.docList = docList
        this.chapters = []
        this.math = false
        this.chapterTemplate = htmlBookExportTemplate
    }

    init() {
        if (this.book.chapters.length === 0) {
            addAlert('error', gettext('Book cannot be exported due to lack of chapters.'))
            return false
        }

        getMissingChapterData(this.book, this.docList, this.schema).then(
            () => this.exportOne()
        )
    }

    addBookStyle() {
        const bookStyle = this.documentStyles.find(bookStyle => bookStyle.slug===this.book.settings.book_style)
        if (!bookStyle) {
            return false
        }
        // The files will be in the base directory. The filenames of
        // BookStyleFiles will therefore not need to replaced with their URLs.

        this.styleSheets.push({contents: bookStyle.contents, filename: `${bookStyle.slug}.css`})
        this.fontFiles = this.fontFiles.concat(bookStyle.bookstylefile_set.map(([url, filename]) => ({
            filename,
            url
        })))
        return `${bookStyle.slug}.css`
    }

    exportOne() {

        this.chapters = this.book.chapters.sort(
            (a, b) => a.number > b.number
        ).map(chapter => {
            const doc = this.docList.find(doc => doc.id === chapter.text),
                schema = this.schema
            schema.cached.imageDB = {db: doc.images}
            const docContents = removeHidden(doc.contents),
                serializer = DOMSerializer.fromSchema(schema),
                contents = serializer.serializeNode(schema.nodeFromJSON(docContents)),
                equations = contents.querySelectorAll('.equation'),
                figureEquations = contents.querySelectorAll('.figure-equation')
            if (equations.length || figureEquations.length) {
                this.math = true
            }

            contents.querySelectorAll('*[class^="figure-cat-"]').forEach(el => el.innerHTML = FIG_CATS[el.dataset.figureCategory][doc.settings.language])

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
                    this.contents = chapter.contents
                    this.cleanHTML(citRenderer.fm)
                    chapter.contents = this.contents
                    delete this.contents
                    return Promise.resolve()
                }
            )
        })
        Promise.all(citRendererPromises).then(() => this.exportTwo())

    }

    prepareBinaryFiles(contents) {
        this.binaryFiles = this.binaryFiles.concat(modifyImages(contents))
    }

    exportTwo() {
        const bookStyle = this.addBookStyle()
        let contentItems = []
        const outputList = this.chapters.map((chapter, index) => {
            const contents = chapter.contents,
                doc = chapter.doc,
                title = doc.title,
                styleSheets = []
            if (bookStyle) {
                styleSheets.push({filename: bookStyle})
            }
            this.prepareBinaryFiles(contents)

            if (this.book.chapters[index].part && this.book.chapters[index].part !== '') {
                contentItems.push({
                    link: `document-${this.book.chapters[index].number}.html`,
                    title: this.book.chapters[index].part,
                    docNum: this.book.chapters[index].number,
                    id: 0,
                    level: -1,
                    subItems: []
                })
            }

            contentItems.push({
                link: `document-${this.book.chapters[index].number}.html`,
                title,
                docNum: this.book.chapters[index].number,
                id: 0,
                level: 0,
                subItems: []
            })

            // Make links to all H1-3 and create a TOC list of them
            contentItems.push(...setLinks(contents, this.book.chapters[index].number))

            const contentsCode = this.replaceImgSrc(contents.innerHTML)

            const htmlCode = this.chapterTemplate({
                part: this.book.chapters[index].part,
                title,
                metadata: doc.metadata,
                settings: doc.settings,
                styleSheets,
                contents: contentsCode,
                math: this.math
            })

            return {
                filename: `document-${this.book.chapters[index].number}.html`,
                contents: htmlCode
            }
        })

        contentItems = orderLinks(contentItems)

        outputList.push({
            filename: 'index.html',
            contents: htmlBookIndexTemplate({
                contentItems,
                book: this.book,
                creator: this.user.name,
                // TODO: specify a book language rather than using the current users UI language
                language: gettext('English')
            })
        })



        this.exportThree(outputList)

    }

    exportThree(outputList) {
        this.binaryFiles = uniqueObjects(this.binaryFiles.concat(this.fontFiles))
        this.styleSheets = uniqueObjects(this.styleSheets)
        const includeZips = this.math ?
            [{
                'directory': '',
                'url': `${this.staticUrl}zip/mathlive_style.zip?v=${process.env.TRANSPILE_VERSION}`
            }] : []

        this.loadStyles().then(
            () => {
                this.styleSheets.forEach(styleSheet => {
                    if (styleSheet.filename) {
                        outputList.push(styleSheet)
                    }
                })
                const zipper = new ZipFileCreator(
                    outputList,
                    this.binaryFiles,
                    includeZips
                )

                return zipper.init()
            }
        ).then(
            blob => download(blob, createSlug(this.book.title) + '.html.zip', 'application/zip')
        )
    }

}
