import {katexRender} from "../../../katex"
import {getMissingChapterData, getImageAndBibDB, uniqueObjects} from "../tools"
import {htmlBookExportTemplate, htmlBookIndexTemplate} from "./templates"
import {docSchema} from "../../../schema/document"
import {removeHidden} from "../../../exporter/tools/doc-contents"
import {BaseEpubExporter} from "../../../exporter/epub/base"
import {createSlug} from "../../../exporter/tools/file"
import {findImages} from "../../../exporter/tools/html"
import {ZipFileCreator} from "../../../exporter/tools/zip"
import {RenderCitations} from "../../../citations/render"
import {addAlert} from "../../../common"

import download from "downloadjs"
import {DOMSerializer} from "prosemirror-model"

export class HTMLBookExporter extends BaseEpubExporter { // extension is correct. Neds orderLinks/setLinks methods from base epub exporter.
    constructor(book, user, docList, styles) {
        super()
        this.book = book
        this.user = user
        this.docList = docList
        this.styles = styles
        this.chapters = []
        this.math = false
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
            (a,b) => a.number > b.number
        ).map(chapter => {
            let doc = this.docList.find(doc => doc.id === chapter.text),
                schema = docSchema
            schema.cached.imageDB = {db: doc.images}
            let docContents = removeHidden(doc.contents),
                serializer = DOMSerializer.fromSchema(schema),
                contents = serializer.serializeNode(schema.nodeFromJSON(docContents)),
                equations = [].slice.call(contents.querySelectorAll('.equation')),
                figureEquations = [].slice.call(contents.querySelectorAll('.figure-equation'))
            if (equations.length > 0 || figureEquations.length > 0) {
                this.math = true
            }

            equations.forEach(el => {
                let formula = el.getAttribute('data-equation')
                katexRender(formula, el, {throwOnError: false})
            })

            figureEquations.forEach(el => {
                let formula = el.getAttribute('data-equation')
                katexRender(formula, el, {displayMode: true, throwOnError: false})
            })

            return {
                doc,
                contents
            }

        })

        let citRendererPromises = this.chapters.map(chapter => {
            // add bibliographies (asynchronously)

            let citRenderer = new RenderCitations(
                chapter.contents,
                this.book.settings.citationstyle,
                {db: chapter.doc.bibliography},
                this.styles.citation_styles,
                this.styles.citation_locales,
                true
            )
            return citRenderer.init().then(
                () => {
                    let bibHTML = citRenderer.fm.bibHTML
                    if (bibHTML.length > 0) {
                        chapter.contents.innerHTML += bibHTML
                    }
                    return Promise.resolve()
                }
            )
        })
        Promise.all(citRendererPromises).then(() => this.exportTwo())

    }

    exportTwo() {
        let styleSheets = [],
            contentItems = [],
            images = [],
            includeZips = []

        let outputList = this.chapters.map((chapter, index) => {
            let contents = chapter.contents,
                doc = chapter.doc,
                title = doc.title

            images = images.concat(findImages(contents))
            contents = this.cleanHTML(contents)

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
            contentItems = contentItems.concat(this.setLinks(contents,
                this.book.chapters[index].number))


            let contentsCode = this.replaceImgSrc(contents.innerHTML)

            let htmlCode = htmlBookExportTemplate({
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
        if (this.math) {
            includeZips.push({
                'directory': '',
                'url': window.staticUrl + 'zip/katex-style.zip'
            })
        }

        images = uniqueObjects(images)

        let zipper = new ZipFileCreator(
            outputList,
            images,
            includeZips
        )

        zipper.init().then(
            blob => download(blob, createSlug(this.book.title) + '.html.zip', 'application/zip')
        )
    }


}
