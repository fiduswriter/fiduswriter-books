import download from "downloadjs"

import {removeHidden, fixTables} from "../../../exporter/tools/doc_content"
import {createSlug} from "../../../exporter/tools/file"
import {XmlZip} from "../../../exporter/tools/xml_zip"
import {getMissingChapterData} from "../tools"
import {addAlert} from "../../../common"


import {ODTExporterCitations} from "../../../exporter/odt/citations"
import {ODTExporterImages} from "../../../exporter/odt/images"

import {ODTExporterRichtext} from "../../../exporter/odt/richtext"
import {ODTExporterFootnotes} from "../../../exporter/odt/footnotes"
import {ODTExporterMetadata} from "../../../exporter/odt/metadata"
import {ODTExporterStyles} from "../../../exporter/odt/styles"
import {ODTExporterMath} from "../../../exporter/odt/math"
import {ODTExporterTracks} from "../../../exporter/odt/track"

import {ODTBookExporterRender} from "./render"


export class ODTBookExporter {
    constructor(schema, csl, book, user, docList, updated) {
        this.schema = schema
        this.csl = csl
        this.book = book
        this.user = user
        this.docList = docList
        this.templateUrl = book.odt_template
        this.updated = updated
        this.textFiles = []
        this.httpFiles = []

        this.mimeType = "application/vnd.oasis.opendocument.text"
    }

    init() {
        if (this.book.chapters.length === 0) {
            addAlert(
                "error",
                gettext("Book cannot be exported due to lack of chapters.")
            )
            return false
        }
        return getMissingChapterData(this.book, this.docList, this.schema, true).then(
            () => this.export()
        )
    }

    export() {
        this.book.chapters.sort((a, b) => (a.number > b.number ? 1 : -1))
        const xml = new XmlZip(
            this.templateUrl,
            this.mimeType
        )
        const styles = new ODTExporterStyles(xml)
        const math = new ODTExporterMath(xml)
        const tracks = new ODTExporterTracks(xml)
        const render = new ODTBookExporterRender(xml, styles)
        const metadata = new ODTExporterMetadata(xml, styles, this.getBaseMetadata())

        return xml.init().then(
            () => styles.init()
        ).then(
            () => tracks.init()
        ).then(
            () => render.init()
        ).then(
            () => metadata.init()
        ).then(
            () => math.init()
        ).then(
            () => this.exportChapters(xml, render, styles, math, tracks)
        ).then(
            () => xml.prepareBlob()
        ).then(
            blob => this.download(blob)
        )
    }

    exportChapters(xml, render, styles, math, tracks) {

        return this.book.chapters.map(chapter => {
            return () => {
                const doc = this.docList.find(doc => doc.id === chapter.text)
                const docContent = fixTables(removeHidden(doc.rawContent))
                const citations = new ODTExporterCitations(
                    docContent,
                    doc.settings,
                    styles,
                    {db: doc.bibliography},
                    this.csl
                )
                const footnotes = new ODTExporterFootnotes(
                    docContent,
                    doc.settings,
                    xml,
                    citations,
                    styles,
                    {db: doc.bibliography},
                    {db: doc.images},
                    this.csl
                )

                const images = new ODTExporterImages(
                    docContent,
                    xml,
                    {db: doc.images}
                )
                const richtext = new ODTExporterRichtext(
                    doc.comments,
                    doc.settings,
                    styles,
                    tracks,
                    footnotes,
                    citations,
                    math,
                    images
                )
                return citations.init().then(
                    () => images.init()
                ).then(
                    () => footnotes.init()
                ).then(
                    () => {
                        const pmBib = footnotes.pmBib || citations.pmBib
                        render.render(docContent, pmBib, doc.settings, richtext, citations)
                        return Promise.resolve()
                    }
                )
            }
        }).reduce((promiseChain, currentChapter) => {
            return promiseChain.then(() => currentChapter())
        }, Promise.resolve()).then(
            () => {
                return render.assemble()
            }
        )
    }


    getBaseMetadata() {
        const authors = this.book.metadata.author.length ? [{institution: this.book.metadata.author}] : []
        const keywords = this.book.metadata.keywords.length ? this.book.metadata.keywords.split(",").map(keyword => keyword.trim()) : []
        return {
            authors,
            keywords,
            title: this.book.title,
            language: this.book.settings.language
        }
    }

    download(blob) {
        return download(blob, createSlug(this.book.title) + ".odt", this.mimeType)
    }
}
