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

import download from "downloadjs"
import pretty from "pretty"
import {DOMSerializer} from "prosemirror-model"

export class HTMLBookExporter extends DOMExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated) {
        super(schema, csl, bookStyles)
        this.book = book
        this.user = user
        this.docList = docList
        this.updated = updated

        this.chapters = []
        this.includeZips = []
        this.outputList = []
        this.math = false
        this.chapterTemplate = htmlBookExportTemplate
    }

    init() {
        if (this.book.chapters.length === 0) {
            addAlert('error', gettext('Book cannot be exported due to lack of chapters.'))
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
                new RegExp(filename, 'g'),
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

    exportOne() {
        this.chapters = this.book.chapters.sort(
            (a, b) => a.number > b.number ? 1 : -1
        ).map(chapter => {
            const doc = this.docList.find(doc => doc.id === chapter.text),
                schema = this.schema
            schema.cached.imageDB = {db: doc.images}
            const docContent = removeHidden(doc.content),
                serializer = DOMSerializer.fromSchema(schema),
                contents = serializer.serializeNode(schema.nodeFromJSON(docContent)),
                equations = contents.querySelectorAll('.equation'),
                figureEquations = contents.querySelectorAll('.figure-equation')
            if (equations.length || figureEquations.length) {
                this.math = true
            }
            contents.querySelectorAll("figure[data-category='figure'] figcaption span.label").forEach(
                el => {
                    el.innerHTML = CATS['figure'][doc.settings.language]
                }
            )
            contents.querySelectorAll("figure[data-category='equation'] figcaption span.label").forEach(
                el => {
                    el.innerHTML = CATS['equation'][doc.settings.language]
                }
            )
            contents.querySelectorAll("figure[data-category='photo'] figcaption span.label").forEach(
                el => {
                    el.innerHTML = CATS['photo'][doc.settings.language]
                }
            )
            contents.querySelectorAll("figure[data-category='table'] figcaption span.label,table[data-category='table'] caption span.label").forEach(
                el => {
                    el.innerHTML = CATS['table'][doc.settings.language]
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

            if (this.book.chapters[index].part !== '') {
                contentItems.push({
                    link: `document-${this.book.chapters[index].number}.html`,
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
            filename: 'index.html',
            contents: pretty(htmlBookIndexTemplate({
                contentItems,
                book: this.book,
                creator: this.user.name,
                styleSheets: [{filename: bookStyle}],
                // TODO: specify a book language rather than using the current users UI language
                language: gettext('English')
            }), {ocd: true})
        })

        return this.exportThree()

    }

    exportThree() {
        this.binaryFiles = uniqueObjects(this.binaryFiles.concat(this.fontFiles))
        this.styleSheets = uniqueObjects(this.styleSheets)
        if (this.math) {
            this.includeZips.push({
                'directory': 'css',
                'url': `${settings_STATIC_URL}zip/mathlive_style.zip?v=${transpile_VERSION}`
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
        return download(blob, createSlug(this.book.title) + '.html.zip', 'application/zip')
    }

}
