import katex from "katex"
import {DOMSerializer} from "prosemirror-model"
import download from "downloadjs"

import {getMissingChapterData, uniqueObjects} from "../tools"
import {epubBookOpfTemplate, epubBookCoverTemplate, epubBookTitlepageTemplate,
  epubBookCopyrightTemplate} from "./templates"
import {katexOpfIncludes} from "../../../katex/opf_includes"
import {BaseEpubExporter} from "../../../exporter/epub/base"
import {ncxTemplate, ncxItemTemplate, navTemplate, navItemTemplate,
  containerTemplate, xhtmlTemplate} from "../../../exporter/epub/templates"
import {node2Obj, obj2Node} from "../../../exporter/tools/json"
import {removeHidden} from "../../../exporter/tools/doc_contents"
import {modifyImages} from "../../../exporter/tools/html"
import {createSlug} from "../../../exporter/tools/file"
import {ZipFileCreator} from "../../../exporter/tools/zip"
import {RenderCitations} from "../../../citations/render"
import {addAlert} from "../../../common"


export class EpubBookExporter extends BaseEpubExporter {
    constructor(schema, book, user, docList, styles, staticUrl) {
        super(schema)
        this.book = book
        this.user = user
        this.docList = docList
        this.styles = styles
        this.staticUrl = staticUrl
        this.chapters = []
        this.images = []
        this.outputList = []
        this.math = false
        this.coverImage = false
        this.contentItems = []
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
        this.book.chapters.sort((a, b) => a.number > b.number ? 1 : -1)

        if (this.book.cover_image) {
            this.coverImage = this.book.cover_image_data
            this.images.push({
                url: this.coverImage.image.split('?')[0],
                filename: this.coverImage.image.split('/').pop().split('?')[0]
            })

            this.outputList.push({
                filename: 'EPUB/cover.xhtml',
                contents: epubBookCoverTemplate({book: this.book, coverImage: this.coverImage})
            })
            this.contentItems.push({
                link: 'cover.xhtml#cover',
                title: gettext('Cover'),
                docNum: 0,
                id: 0,
                level: 0,
                subItems: [],
            })
        }
        this.contentItems.push({
            link: 'titlepage.xhtml#title',
            title: gettext('Title page'),
            docNum: 0,
            id: 1,
            level: 0,
            subItems: [],
        })
        this.chapters = this.book.chapters.map(chapter => {
            const doc = this.docList.find(doc => doc.id === chapter.text),
                schema = this.schema
            schema.cached.imageDB = {db: doc.images}
            const docContents = removeHidden(doc.contents),
                serializer = DOMSerializer.fromSchema(schema),
                tempNode = serializer.serializeNode(schema.nodeFromJSON(docContents))
            let contents = document.createElement('body'), math = false
            while (tempNode.firstChild) {
                contents.appendChild(tempNode.firstChild)
            }

            this.images = this.images.concat(modifyImages(contents))
            contents = this.addFigureNumbers(contents)

            const equations = contents.querySelectorAll('.equation')

            const figureEquations = contents.querySelectorAll('.figure-equation')

            if (equations.length || figureEquations.length) {
                math = true
                this.math = true
            }

            equations.forEach(el => {
                const formula = el.getAttribute('data-equation')
                katex.render(formula, el, {throwOnError: false})
            })
            figureEquations.forEach(el => {
                const formula = el.getAttribute('data-equation')
                katex.render(formula, el, {throwOnError: false})
            })
            if (chapter.part && chapter.part.length) {
                this.contentItems.push({
                    link: `document-${chapter.number}.xhtml`,
                    title: chapter.part,
                    docNum: chapter.number,
                    id: 0,
                    level: -1,
                    subItems: [],
                })
            }

            // Make links to all H1-3 and create a TOC list of them
            this.contentItems = this.contentItems.concat(this.setLinks(
                contents, chapter.number))


            return {
                contents,
                number : chapter.number,
                part: chapter.part,
                math,
                doc
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
        const includeZips = [],
            styleSheets = []
        let httpOutputList = []

        this.outputList = this.outputList.concat(
            this.chapters.map(chapter => {
                chapter.contents = this.styleEpubFootnotes(chapter.contents)
                let xhtmlCode = xhtmlTemplate({
                    part: chapter.part,
                    shortLang: chapter.doc.settings.language.split('-')[0],
                    title: chapter.doc.title,
                    metadata: chapter.doc.metadata,
                    settings: chapter.doc.settings,
                    styleSheets,
                    body: obj2Node(node2Obj(chapter.contents), 'xhtml').innerHTML,
                    math: chapter.math
                })
                xhtmlCode = this.replaceImgSrc(xhtmlCode)

                return {
                    filename: `EPUB/document-${chapter.number}.xhtml`,
                    contents: xhtmlCode
                }
            })
        )

        this.contentItems.push({
            link: 'copyright.xhtml#copyright',
            title: gettext('Copyright'),
            docNum: 0,
            id: 2,
            level: 0,
            subItems: [],
        })

        this.contentItems = this.orderLinks(this.contentItems)

        const timestamp = this.getTimestamp()

        this.images = uniqueObjects(this.images)

        // mark cover image
        if (this.coverImage) {
            this.images.find(
                image => image.url === this.coverImage.image.split('?')[0]
            ).coverImage = true
        }

        // Take language of first chapter.
        let language = 'en-US'
        if (this.chapters.length) {
            language = this.chapters[0].doc.settings.language
        }
        const shortLang = language.split('-')[0]

        const opfCode = epubBookOpfTemplate({
            language,
            book: this.book,
            idType: 'fidus',
            date: timestamp.slice(0, 10), // TODO: the date should probably be the original document creation date instead
            modified: timestamp,
            styleSheets,
            math: this.math,
            images: this.images,
            chapters: this.chapters,
            coverImage: this.coverImage,
            katexOpfIncludes,
            user: this.user
        })

        const ncxCode = ncxTemplate({
            shortLang,
            title: this.book.title,
            idType: 'fidus',
            id: this.book.id,
            contentItems: this.contentItems,
            templates: {ncxTemplate, ncxItemTemplate}
        })

        const navCode = navTemplate({
            shortLang,
            contentItems: this.contentItems,
            templates: {navTemplate, navItemTemplate}
        })

        this.outputList = this.outputList.concat([{
            filename: 'META-INF/container.xml',
            contents: containerTemplate({})
        }, {
            filename: 'EPUB/document.opf',
            contents: opfCode
        }, {
            filename: 'EPUB/document.ncx',
            contents: ncxCode
        }, {
            filename: 'EPUB/document-nav.xhtml',
            contents: navCode
        }, {
            filename: 'EPUB/titlepage.xhtml',
            contents: epubBookTitlepageTemplate({
                book: this.book
            })
        }, {
            filename: 'EPUB/copyright.xhtml',
            contents: epubBookCopyrightTemplate({
                book: this.book,
                creator: this.user.name,
                language
            })
        }])

        this.outputList = this.outputList.concat(
            styleSheets.map(sheet => ({
                filename: `EPUB/${sheet.filename}`,
                contents: sheet.contents
            }))
        )

        httpOutputList = httpOutputList.concat(
            this.images.map(image => ({
                filename: `EPUB/${image.filename}`,
                url: image.url
            }))
        )

        if (this.math) {
            includeZips.push({
                'directory': 'EPUB',
                'url': `${this.staticUrl}zip/katex_style.zip?v=${$StaticUrls.transpile.version$}`
            })
        }
        const zipper = new ZipFileCreator(
            this.outputList,
            httpOutputList,
            includeZips,
            'application/epub+zip'
        )
        zipper.init().then(
            blob => {
                return download(
                    blob,
                    createSlug(this.book.title) + '.epub',
                    'application/epub+zip'
                )
            }
        )

    }

}
