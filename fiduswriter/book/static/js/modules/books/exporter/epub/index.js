import download from "downloadjs"
import pretty from "pretty"
import {addAlert, get} from "../../../common"
import {HTMLExporterConvert} from "../../../exporter/html/convert"
import {htmlExportTemplate} from "../../../exporter/html/templates"
import {removeHidden} from "../../../exporter/tools/doc_content"
import {createSlug} from "../../../exporter/tools/file"
import {ZipFileCreator} from "../../../exporter/tools/zip"
import {LANGUAGES} from "../../../schema/const"
import {getMissingChapterData} from "../tools"
import {
    containerTemplate,
    epubBookCopyrightTemplate,
    epubBookCoverTemplate,
    epubBookOpfTemplate,
    epubBookTitlepageTemplate,
    navTemplate,
    ncxTemplate
} from "./templates"
import {
    buildHierarchy,
    getFontMimeType,
    getImageMimeType,
    getTimestamp
} from "./tools"

export class EpubBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated) {
        this.schema = schema
        this.csl = csl
        this.bookStyles = bookStyles
        this.book = book
        this.user = user
        this.docList = docList
        this.updated = updated
        this.textFiles = []
        this.images = []
        this.fontFiles = []
        this.styleSheets = [{url: staticUrl("css/book.css")}]
        this.chapters = []
        this.contentItems = []
        this.includeZips = []
        this.math = false
    }

    async init() {
        if (this.book.chapters.length === 0) {
            addAlert(
                "error",
                gettext("Book cannot be exported due to lack of chapters.")
            )
            return false
        }

        await getMissingChapterData(this.book, this.docList, this.schema)

        this.addBookStyle()
        await this.exportContents()
        return true
    }

    addBookStyle() {
        const bookStyle = this.bookStyles.find(
            style => style.slug === this.book.settings.book_style
        )
        if (!bookStyle) {
            return false
        }

        let contents = bookStyle.contents
        bookStyle.bookstylefile_set.forEach(([_url, filename]) => {
            contents = contents.replace(
                new RegExp(filename, "g"),
                `media/${filename}`
            )
        })

        this.styleSheets.push({contents, filename: `css/${bookStyle.slug}.css`})
        this.fontFiles = this.fontFiles.concat(
            bookStyle.bookstylefile_set.map(([url, filename]) => ({
                filename: `css/media/${filename}`,
                url
            }))
        )
    }

    async exportContents() {
        await Promise.all(
            this.styleSheets.map(async sheet => await this.loadStyle(sheet))
        )

        // Create cover
        if (this.book.cover_image) {
            const coverImage = this.book.cover_image_data
            this.images.push({
                url: coverImage.image.split("?")[0],
                filename: coverImage.image.split("/").pop().split("?")[0],
                coverImage: true
            })

            this.textFiles.push({
                filename: "cover.xhtml",
                contents: pretty(
                    epubBookCoverTemplate({
                        book: this.book,
                        coverImage,
                        shortLang: this.book.settings.language.split("-")[0]
                    })
                )
            })
        }

        // Create title page
        this.textFiles.push({
            filename: "titlepage.xhtml",
            contents: pretty(
                epubBookTitlepageTemplate({
                    book: this.book,
                    shortLang: this.book.settings.language.split("-")[0]
                })
            )
        })

        // Export chapters
        this.chapters = await Promise.all(
            this.book.chapters
                .sort((a, b) => a.number - b.number)
                .map(async chapter => {
                    const doc = this.docList.find(
                        doc => doc.id === chapter.text
                    )
                    if (!doc) {
                        return false
                    }

                    const docContent = removeHidden(doc.content)

                    const converter = new HTMLExporterConvert(
                        doc.title,
                        doc.settings,
                        docContent,
                        htmlExportTemplate,
                        {db: doc.images},
                        {db: doc.bibliography},
                        this.csl,
                        this.styleSheets,
                        {
                            xhtml: true,
                            epub: true,
                            footnoteNumbering: "decimal",
                            affiliationNumbering: "alpha",
                            idPrefix: `c-${chapter.number}-`
                        }
                    )
                    const {html, imageIds, metaData, extraStyleSheets} =
                        await converter.init()

                    if (!html) {
                        return false
                    }

                    imageIds.forEach(id => {
                        const image = doc.images[id]
                        this.images.push({
                            filename: `images/${image.image.split("/").pop()}`,
                            url: image.image
                        })
                    })

                    await Promise.all(
                        extraStyleSheets.map(
                            async sheet => await this.loadStyle(sheet)
                        )
                    )

                    // Check for math
                    if (converter.features.math) {
                        this.math = true
                    }

                    this.textFiles.push({
                        filename: `document-${chapter.number}.xhtml`,
                        contents: pretty(html)
                    })

                    return {
                        number: chapter.number,
                        part: chapter.part,
                        title: doc.title,
                        docNum: chapter.number,
                        metaData
                    }
                })
        )

        // Filter out any failed chapter exports
        this.chapters = this.chapters.filter(chapter => chapter !== false)

        // Create copyright page
        this.textFiles.push({
            filename: "copyright.xhtml",
            contents: pretty(
                epubBookCopyrightTemplate({
                    book: this.book,
                    creator: this.user.name,
                    language: this.book.settings.language,
                    shortLang: this.book.settings.language.split("-")[0]
                })
            )
        })

        // Create navigation
        const contentItems = this.chapters.reduce((items, chapter) => {
            if (chapter.part) {
                items.push({
                    title: chapter.part,
                    docNum: chapter.number,
                    link: `document-${chapter.number}.xhtml`,
                    level: -1
                })
            }
            items = items.concat(
                chapter.metaData.toc.map(item => ({
                    ...item,
                    docNum: chapter.number,
                    link: `document-${chapter.number}.xhtml#c-${chapter.number}-${item.id}`
                }))
            )
            return items
        }, [])

        const toc = buildHierarchy(contentItems)

        this.textFiles = this.textFiles.concat([
            {
                filename: "META-INF/container.xml",
                contents: pretty(containerTemplate())
            },
            {
                filename: "document.opf",
                contents: pretty(
                    epubBookOpfTemplate({
                        book: this.book,
                        language: this.book.settings.language,
                        idType: "fidus",
                        date: getTimestamp(new Date(this.updated * 1000)).slice(
                            0,
                            10
                        ),
                        modified: getTimestamp(new Date(this.updated * 1000)),
                        styleSheets: this.styleSheets,
                        math: this.math,
                        images: this.images.map(image => ({
                            ...image,
                            mimeType: getImageMimeType(image.filename)
                        })),
                        fontFiles: this.fontFiles.map(font => ({
                            ...font,
                            mimeType: getFontMimeType(font.filename)
                        })),
                        chapters: this.chapters,
                        user: this.user
                    })
                )
            },
            {
                filename: "document.ncx",
                contents: pretty(
                    ncxTemplate({
                        shortLang: this.book.settings.language.split("-")[0],
                        title: this.book.title,
                        idType: "fidus",
                        id: this.book.id,
                        toc
                    })
                )
            },
            {
                filename: "document-nav.xhtml",
                contents: pretty(
                    navTemplate({
                        shortLang: this.book.settings.language.split("-")[0],
                        toc,
                        styleSheets: this.styleSheets
                    })
                )
            }
        ])
        if (this.math) {
            this.includeZips.push({
                directory: "css",
                url: staticUrl("zip/mathlive_style.zip")
            })
        }

        this.httpFiles = this.images.concat(this.fontFiles)
        this.prefixFiles()
        return this.createZip()
    }

    async loadStyle(sheet) {
        const filename =
            sheet.filename || `css/${sheet.url.split("/").pop().split("?")[0]}`
        const existing = this.textFiles.find(file => file.filename === filename)
        if (existing) {
            // Already loaded
            return Promise.resolve(existing)
        }
        if (sheet.url) {
            const response = await get(sheet.url)
            const text = await response.text()
            sheet.contents = text
            sheet.filename = filename
            delete sheet.url
        }
        if (sheet.filename) {
            this.textFiles.push(sheet)
        }
        return Promise.resolve(sheet)
    }

    prefixFiles() {
        // prefix almost all files with "EPUB/"
        this.textFiles = this.textFiles.map(file => {
            if (
                ["META-INF/container.xml", "mimetype"].includes(file.filename)
            ) {
                return file
            }
            return Object.assign({}, file, {filename: `EPUB/${file.filename}`})
        })
        this.httpFiles = this.httpFiles.map(file =>
            Object.assign({}, file, {filename: `EPUB/${file.filename}`})
        )
        this.includeZips = this.includeZips.map(file =>
            Object.assign({}, file, {directory: `EPUB/${file.directory}`})
        )
    }

    async createZip() {
        const zipper = new ZipFileCreator(
            this.textFiles,
            this.httpFiles,
            this.includeZips,
            "application/epub+zip",
            this.updated
        )
        const blob = await zipper.init()
        return this.download(blob)
    }

    download(blob) {
        return download(
            blob,
            `${createSlug(this.book.title)}.epub`,
            "application/epub+zip"
        )
    }
}
