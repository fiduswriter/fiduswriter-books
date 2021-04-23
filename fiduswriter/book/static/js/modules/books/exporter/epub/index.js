import {DOMSerializer} from "prosemirror-model"
import download from "downloadjs"
import pretty from "pretty"

import {BIBLIOGRAPHY_HEADERS} from "../../../schema/i18n"

import {getMissingChapterData, uniqueObjects} from "../tools"
import {epubBookOpfTemplate, epubBookCoverTemplate, epubBookTitlepageTemplate,
    epubBookCopyrightTemplate} from "./templates"
import {mathliveOpfIncludes} from "../../../mathlive/opf_includes"
import {DOMExporter} from "../../../exporter/tools/dom_export"
import {setLinks, orderLinks, getTimestamp, styleEpubFootnotes, addCategoryLabels} from "../../../exporter/epub/tools"

import {ncxTemplate, ncxItemTemplate, navTemplate, containerTemplate, xhtmlTemplate} from "../../../exporter/epub/templates"
import {node2Obj, obj2Node} from "../../../exporter/tools/json"
import {removeHidden} from "../../../exporter/tools/doc_content"
import {modifyImages} from "../../../exporter/tools/html"
import {createSlug} from "../../../exporter/tools/file"
import {ZipFileCreator} from "../../../exporter/tools/zip"
import {RenderCitations} from "../../../citations/render"
import {addAlert} from "../../../common"


export class EpubBookExporter extends DOMExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated) {
        super(schema, csl, bookStyles)
        this.book = book
        this.user = user
        this.docList = docList
        this.updated = updated

        this.chapters = []
        this.images = []
        this.outputList = []
        this.includeZips = []
        this.math = false
        this.coverImage = false
        this.contentItems = []
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
        let currentPart = false
        this.chapters = this.book.chapters.map(chapter => {
            const doc = this.docList.find(doc => doc.id === chapter.text),
                schema = this.schema
            schema.cached.imageDB = {db: doc.images}
            const docContent = removeHidden(doc.content),
                serializer = DOMSerializer.fromSchema(schema),
                tempNode = serializer.serializeNode(schema.nodeFromJSON(docContent))
            const contentsEl = document.createElement('body')
            let math = false
            while (tempNode.firstChild) {
                contentsEl.appendChild(tempNode.firstChild)
            }

            this.images = this.images.concat(modifyImages(contentsEl))
            addCategoryLabels(contentsEl, doc.settings.language)
            const equations = contentsEl.querySelectorAll('.equation')

            const figureEquations = contentsEl.querySelectorAll('.figure-equation')

            if (equations.length || figureEquations.length) {
                math = true
                this.math = true
            }

            if (chapter.part?.length) {
                this.contentItems.push({
                    link: `document-${chapter.number}.xhtml`,
                    title: chapter.part,
                    docNum: chapter.number,
                    id: 0,
                    level: -1,
                    subItems: [],
                })
                currentPart = chapter.part
            }

            // Make links to all H1-3 and create a TOC list of them
            this.contentItems = this.contentItems.concat(setLinks(
                contentsEl, chapter.number))


            return {
                contents: contentsEl,
                number: chapter.number,
                currentPart,
                part: chapter.part,
                math,
                doc
            }
        })
        const citRendererPromises = this.chapters.map(chapter => {

            const bibliographyHeader = chapter.doc.settings.bibliography_header[chapter.doc.settings.language] || BIBLIOGRAPHY_HEADERS[chapter.doc.settings.language]
            // add bibliographies (asynchronously)
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

    exportTwo() {
        const bookStyle = this.addBookStyle()
        this.outputList = this.outputList.concat(
            this.chapters.map(chapter => {
                chapter.contents = styleEpubFootnotes(chapter.contents)
                const styleSheets = [{filename: 'css/document.css'}]
                if (bookStyle) {
                    styleSheets.push({filename: bookStyle})
                }
                let xhtmlCode = xhtmlTemplate({
                    part: chapter.part,
                    currentPart: chapter.currentPart,
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
                    contents: pretty(xhtmlCode, {ocd: true})
                }
            })
        )
        return this.loadStyles().then(
            () => this.exportThree()
        )
    }

    exportThree() {

        this.contentItems.push({
            link: 'copyright.xhtml#copyright',
            title: gettext('Copyright'),
            docNum: 0,
            id: 2,
            level: 0,
            subItems: [],
        })

        this.contentItems = orderLinks(this.contentItems)

        const timestamp = getTimestamp(this.updated)

        this.images = uniqueObjects(this.images)
        this.fontFiles = uniqueObjects(this.fontFiles)
        this.styleSheets = uniqueObjects(this.styleSheets)

        // mark cover image
        if (this.coverImage) {
            this.images.find(
                image => image.url === this.coverImage.image.split('?')[0]
            ).coverImage = true
        }

        // Take language of first chapter.
        const languages = this.chapters.map(chapter => chapter.doc.settings.language)
        const language = languages[0] || 'en-US'
        const shortLang = language.split('-')[0]

        const opfCode = epubBookOpfTemplate({
            language,
            book: this.book,
            idType: 'fidus',
            date: timestamp.slice(0, 10),
            modified: timestamp,
            styleSheets: this.styleSheets,
            math: this.math,
            images: this.images,
            fontFiles: this.fontFiles,
            chapters: this.chapters,
            coverImage: this.coverImage,
            mathliveOpfIncludes,
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
            styleSheets: this.styleSheets
        })

        this.outputList = this.outputList.concat([{
            filename: 'META-INF/container.xml',
            contents: pretty(containerTemplate({}), {ocd: true})
        }, {
            filename: 'EPUB/document.opf',
            contents: pretty(opfCode, {ocd: true})
        }, {
            filename: 'EPUB/document.ncx',
            contents: pretty(ncxCode, {ocd: true})
        }, {
            filename: 'EPUB/document-nav.xhtml',
            contents: pretty(navCode, {ocd: true})
        }, {
            filename: 'EPUB/titlepage.xhtml',
            contents: pretty(epubBookTitlepageTemplate({
                book: this.book
            }), {ocd: true})
        }, {
            filename: 'EPUB/copyright.xhtml',
            contents: pretty(epubBookCopyrightTemplate({
                book: this.book,
                creator: this.user.name,
                languages
            }), {ocd: true})
        }])

        this.outputList = this.outputList.concat(
            this.styleSheets.map(sheet => ({
                filename: `EPUB/${sheet.filename}`,
                contents: sheet.contents
            }))
        )

        this.binaryFiles = this.binaryFiles.concat(
            this.images.map(image => ({
                filename: `EPUB/${image.filename}`,
                url: image.url
            }))
        )

        this.fontFiles.forEach(font => {
            this.binaryFiles.push({
                filename: `EPUB/${font.filename}`,
                url: font.url
            })
        })

        this.binaryFiles = uniqueObjects(this.binaryFiles)

        if (this.math) {
            this.includeZips.push({
                'directory': 'EPUB/css',
                'url': `${settings_STATIC_URL}zip/mathlive_style.zip?v=${transpile_VERSION}`
            })
        }
        return this.createZip()
    }

    createZip() {
        const zipper = new ZipFileCreator(
            this.outputList,
            this.binaryFiles,
            this.includeZips,
            'application/epub+zip',
            this.updated
        )
        return zipper.init().then(
            blob => this.download(blob)
        )
    }

    download(blob) {
        return download(
            blob,
            createSlug(this.book.title) + '.epub',
            'application/epub+zip'
        )
    }

}
