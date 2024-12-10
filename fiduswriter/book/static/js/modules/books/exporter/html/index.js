import download from "downloadjs"
import pretty from "pretty"
import {addAlert, get} from "../../../common"
import {HTMLExporter} from "../../../exporter/html/index"
import {createSlug} from "../../../exporter/tools/file"
import {ZipFileCreator} from "../../../exporter/tools/zip"
import {LANGUAGES} from "../../../schema/const"
import {getMissingChapterData} from "../tools"
import {
    htmlBookChapterTemplate,
    htmlBookExportTemplate,
    htmlBookIndexBodyTemplate,
    htmlBookIndexTemplate,
    singleFileHTMLBookCSSTemplate,
    singleFileHTMLBookChapterTemplate,
    singleFileHTMLBookTemplate
} from "./templates"
import {orderLinks} from "./tools"

export class HTMLBookExporter {
    constructor(
        schema,
        csl,
        bookStyles,
        book,
        user,
        docList,
        updated,
        multiDoc = true,
        {relativeUrls = true} = {}
    ) {
        this.schema = schema
        this.csl = csl
        this.bookStyles = bookStyles
        this.book = book
        this.user = user
        this.docList = docList
        this.updated = updated
        this.multiDoc = multiDoc
        this.relativeUrls = relativeUrls
        this.chapters = []
        this.includeZips = []
        this.textFiles = []
        this.httpFiles = []
        this.math = false
        this.bibCSS = ""
        this.chapterTemplate = multiDoc
            ? htmlBookExportTemplate
            : singleFileHTMLBookChapterTemplate
        this.indexTemplate = multiDoc
            ? htmlBookIndexTemplate
            : htmlBookIndexBodyTemplate
        this.singleFileHTMLBookTemplate = singleFileHTMLBookTemplate
        this.singleFileHTMLBookCSSTemplate = singleFileHTMLBookCSSTemplate
        this.styleSheets = [{url: staticUrl("css/book.css")}]
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

        await Promise.all(
            this.styleSheets.map(async sheet => await this.loadStyle(sheet))
        )

        await this.exportChapters()

        return true
    }

    async loadStyle(sheet) {
        if (sheet.url) {
            const response = await get(sheet.url)
            const text = await response.text()
            sheet.contents = text
            sheet.filename = `css/${sheet.url.split("/").pop().split("?")[0]}`
            delete sheet.url
        }
        if (sheet.filename) {
            this.textFiles.push(sheet)
        }
        return Promise.resolve(sheet)
    }

    async exportChapters() {
        let footnoteCounter = 0,
            affiliationCounter = 0,
            figureCounter = 0,
            equationCounter = 0,
            photoCounter = 0,
            tableCounter = 0

        for (const chapterInfo of this.book.chapters.sort(
            (a, b) => a.number - b.number
        )) {
            const chapterNumber = chapterInfo.number
            const chapterPart = chapterInfo.part
            const doc = this.docList.find(doc => doc.id === chapterInfo.text)

            if (!doc) {
                continue
            }

            const imageDB = {db: doc.images}
            const bibDB = {db: doc.bibliography}
            const styleSheets = this.styleSheets.slice()

            const options = {
                xhtml: false,
                epub: false,
                relativeUrls: this.relativeUrls,
                footnoteNumbering: "decimal",
                affiliationNumbering: "alpha",
                idPrefix: `c-${chapterNumber}-`,
                footnoteOffset: footnoteCounter,
                affiliationOffset: affiliationCounter,
                figureOffset: {
                    figure: figureCounter,
                    equation: equationCounter,
                    photo: photoCounter,
                    table: tableCounter
                }
            }

            const documentHTMLExporter = new HTMLExporter(
                doc,
                bibDB,
                imageDB,
                this.csl,
                this.updated,
                [],
                options,
                htmlBookChapterTemplate
            )

            await documentHTMLExporter.process()
            const {metaData, converter, textFiles, httpFiles} =
                documentHTMLExporter.getProcessedFiles()

            const contents = textFiles.find(
                textFile => textFile.filename === "document.html"
            )?.contents
            if (!contents) {
                continue
            }
            this.httpFiles = this.httpFiles.concat(httpFiles)

            // Update counters
            footnoteCounter = converter.fnCounter
            affiliationCounter = converter.affCounter
            figureCounter = converter.categoryCounter.figure || figureCounter
            equationCounter =
                converter.categoryCounter.equation || equationCounter
            photoCounter = converter.categoryCounter.photo || photoCounter
            tableCounter = converter.categoryCounter.table || tableCounter

            if (converter.features.math) {
                this.math = true
                styleSheets.push({filename: "css/mathlive.css"})
            }

            // Collect stylesheets
            if (converter.citations.bibCSS) {
                if (!this.bibCSS) {
                    this.bibCSS = pretty(converter.citations.bibCSS, {
                        ocd: true
                    })
                }
                styleSheets.push({filename: "css/bibliography.css"})
            }

            const chapterHTML = this.chapterTemplate({
                part: chapterInfo.part,
                currentPart: chapterPart,
                contents,
                title: doc.title,
                settings: doc.settings,
                styleSheets
            })

            this.textFiles.push({
                filename: `document-${chapterNumber}.html`,
                contents: pretty(chapterHTML, {ocd: true})
            })

            // Store chapter info for TOC
            this.chapters.push({
                number: chapterNumber,
                part: chapterPart,
                doc,
                metaData,
                toc: converter.metaData.toc
            })
        }

        await this.exportBook()
    }

    async exportBook() {
        // Add math stylesheets if needed
        if (this.math) {
            this.includeZips.push({
                directory: "css",
                url: staticUrl("zip/mathlive_style.zip")
            })
        }

        if (this.bibCSS) {
            this.textFiles.push({
                filename: "css/bibliography.css",
                contents: this.bibCSS
            })
        }

        let contentItems = []
        for (const chapter of this.chapters) {
            const chapterNumber = chapter.number
            const chapterPart = chapter.part

            // Prepare contentItems for TOC
            if (chapterPart && chapterPart !== "") {
                contentItems.push({
                    link: this.multiDoc
                        ? this.getChapterLink(chapterNumber)
                        : `#c-${chapterNumber}-body`,
                    title: chapterPart,
                    docNum: chapterNumber,
                    id: 0,
                    level: -1,
                    subItems: []
                })
            }

            const contentItemsFromChapter = chapter.toc.map(item => {
                return {
                    link: `${this.multiDoc ? this.getChapterLink(chapter.number) : ""}#c-${chapter.number}-${item.id}`,
                    title: item.title,
                    docNum: chapterNumber,
                    id: item.id,
                    level: item.level,
                    subItems: []
                }
            })

            contentItems = contentItems.concat(contentItemsFromChapter)
        }

        contentItems = orderLinks(contentItems)

        // Generate the index.html
        this.textFiles.push({
            filename: "index.html",
            contents: pretty(
                this.indexTemplate({
                    contentItems,
                    book: this.book,
                    creator: this.user.name,
                    styleSheets: this.styleSheets, // Include book stylesheets
                    language: LANGUAGES.find(
                        lang => lang[0] === this.book.settings.language
                    )[1],
                    multiDoc: this.multiDoc
                }),
                {ocd: true}
            )
        })
        if (!this.multiDoc) {
            this.joinChapters()
        }
        await this.createZip()
    }

    joinChapters() {
        // Used for single file export
        const styleSheets = this.styleSheets.slice()
        if (this.bibCSS) {
            styleSheets.push(
                this.relativeUrls
                    ? {filename: "css/bibliography.css"}
                    : {contents: this.bibCSS}
            )
        }
        if (this.math) {
            styleSheets.push(
                this.relativeUrls
                    ? {filename: "css/mathlive.css"}
                    : {filename: staticUrl("css/mathlive.css")} // this.loadStyle() has been executed already.
            )
        }
        let html = ""
        this.textFiles = this.textFiles
            .sort((a, b) => {
                if (a.filename === "index.html") {
                    return -1
                }
                if (b.filename === "index.html") {
                    return 1
                }
                if (
                    Number.parseInt(a.filename.match(/\d+/g)) <
                    Number.parseInt(b.filename.match(/\d+/g))
                ) {
                    return -1
                }
                if (
                    Number.parseInt(a.filename.match(/\d+/g)) >
                    Number.parseInt(b.filename.match(/\d+/g))
                ) {
                    return 1
                }
                return 0
            })
            .filter(({filename, contents}) => {
                if (filename.slice(-5) !== ".html") {
                    return true
                }
                html += contents
                return false
            })
        const css = this.singleFileHTMLBookCSSTemplate({
                papersize: this.book.settings.papersize
            }),
            title = this.book.title,
            settings = this.book.settings,
            htmlDoc = this.singleFileHTMLBookTemplate({
                css,
                html,
                title,
                styleSheets,
                settings
            })

        this.textFiles.push({
            filename: "index.html",
            contents: pretty(htmlDoc, {ocd: true})
        })
    }

    addBookStyle() {
        const bookStyle = this.bookStyles.find(
            bookStyle => bookStyle.slug === this.book.settings.book_style
        )
        if (!bookStyle) {
            return false
        }
        let contents = bookStyle.contents
        bookStyle.bookstylefile_set.forEach(
            ([_url, filename]) =>
                (contents = contents.replace(
                    new RegExp(filename, "g"),
                    `media/${filename}`
                ))
        )

        this.styleSheets.push({contents, filename: `css/${bookStyle.slug}.css`})
        this.httpFiles = this.httpFiles.concat(
            bookStyle.bookstylefile_set.map(([url, filename]) => ({
                filename: `css/media/${filename}`,
                url
            }))
        )
    }

    async createZip() {
        const zipper = new ZipFileCreator(
            this.textFiles.concat(this.styleSheets),
            this.httpFiles,
            this.includeZips,
            "application/zip",
            this.updated
        )
        const blob = await zipper.init()
        return this.download(blob)
    }

    download(blob) {
        return download(
            blob,
            `${createSlug(this.book.title)}.html.zip`,
            "application/zip"
        )
    }

    getChapterLink(chapterNumber) {
        return `document-${chapterNumber}.html`
    }
}
