import katex from "katex"
import {getMissingChapterData, uniqueObjects} from "../tools"
import {htmlBookExportTemplate, htmlBookIndexTemplate} from "./templates"
import {removeHidden} from "../../../exporter/tools/doc_contents"
import {BaseEpubExporter} from "../../../exporter/epub/base"
import {createSlug} from "../../../exporter/tools/file"
import {modifyImages} from "../../../exporter/tools/html"
import {ZipFileCreator} from "../../../exporter/tools/zip"
import {RenderCitations} from "../../../citations/render"
import {addAlert} from "../../../common"

import download from "downloadjs"
import {DOMSerializer} from "prosemirror-model"

export class HTMLBookExporter extends BaseEpubExporter { // extension is correct. Neds orderLinks/setLinks methods from base epub exporter.
    constructor(schema, book, user, docList, styles, staticUrl) {
        super(schema)
        this.book = book
        this.user = user
        this.docList = docList
        this.styles = styles
        this.staticUrl = staticUrl
        this.chapters = []
        this.math = false
        this.chapterTemplate = htmlBookExportTemplate
        this.modifyImages = true
    }

    init() {
        if (this.book.chapters.length === 0) {
            addAlert('error', gettext('Book cannot be exported due to lack of chapters.'))
            return false
        }

        getMissingChapterData(this.book, this.docList).then(
            () => this.exportOne()
        ).catch(
            () => {}
        )
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

            equations.forEach(el => {
                const formula = el.getAttribute('data-equation')
                katex.render(formula, el, {throwOnError: false})
            })

            figureEquations.forEach(el => {
                const formula = el.getAttribute('data-equation')
                katex.render(formula, el, {displayMode: true, throwOnError: false})
            })

            return {
                doc,
                contents
            }

        })

        const citRendererPromises = this.chapters.map(chapter => {
            // add bibliographies (asynchronously)

            const citRenderer = new RenderCitations(
                chapter.contents,
                this.book.settings.citationstyle,
                {db: chapter.doc.bibliography},
                this.styles.citation_styles,
                this.styles.citation_locales,
                true
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

    exportTwo() {
        let contentItems = [],
            images = []

        const styleSheets = []

        let outputList = this.chapters.map((chapter, index) => {
            const contents = chapter.contents,
                doc = chapter.doc,
                title = doc.title

            if (this.modifyImages) {
                images = images.concat(modifyImages(contents))
            }

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
            contentItems.push(...this.setLinks(contents, this.book.chapters[index].number))

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

        contentItems = this.orderLinks(contentItems)

        outputList = outputList.concat(styleSheets)

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

        images = uniqueObjects(images)

        this.exportThree(outputList, images)

    }

    exportThree(outputList, images) {
        const includeZips = this.math ?
            [{
                'directory': '',
                'url': `${this.staticUrl}zip/katex_style.zip?v=${$StaticUrls.transpile.version$}`
            }] : []

        const zipper = new ZipFileCreator(
            outputList,
            images,
            includeZips
        )

        zipper.init().then(
            blob => download(blob, createSlug(this.book.title) + '.html.zip', 'application/zip')
        )
    }


}
