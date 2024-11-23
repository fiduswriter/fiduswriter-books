import download from "downloadjs"

import {addAlert} from "../../../common"
import {fixTables, removeHidden} from "../../../exporter/tools/doc_content"
import {createSlug} from "../../../exporter/tools/file"
import {XmlZip} from "../../../exporter/tools/xml_zip"
import {getMissingChapterData} from "../tools"

import {DOCXExporterCitations} from "../../../exporter/docx/citations"
import {DOCXExporterComments} from "../../../exporter/docx/comments"
import {DOCXExporterFootnotes} from "../../../exporter/docx/footnotes"
import {DOCXExporterImages} from "../../../exporter/docx/images"
import {DOCXExporterLists} from "../../../exporter/docx/lists"
import {DOCXExporterMath} from "../../../exporter/docx/math"
import {DOCXExporterMetadata} from "../../../exporter/docx/metadata"
import {DOCXExporterRels} from "../../../exporter/docx/rels"
import {DOCXExporterRichtext} from "../../../exporter/docx/richtext"
import {DOCXExporterTables} from "../../../exporter/docx/tables"
import {moveFootnoteComments} from "../../../exporter/docx/tools"

import {DOCXBookExporterRender} from "./render"

export class DOCXBookExporter {
    constructor(schema, csl, book, user, docList, updated) {
        this.schema = schema
        this.csl = csl
        this.book = book
        this.user = user
        this.docList = docList
        this.templateUrl = book.docx_template
        this.updated = updated
        this.textFiles = []
        this.httpFiles = []

        this.mimeType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }

    init() {
        if (this.book.chapters.length === 0) {
            addAlert(
                "error",
                gettext("Book cannot be exported due to lack of chapters.")
            )
            return false
        }
        return getMissingChapterData(
            this.book,
            this.docList,
            this.schema,
            true
        ).then(() => this.export())
    }

    export() {
        this.book.chapters.sort((a, b) => (a.number > b.number ? 1 : -1))
        const xml = new XmlZip(this.templateUrl, this.mimeType)

        const tables = new DOCXExporterTables(xml)
        const math = new DOCXExporterMath(xml)
        const render = new DOCXBookExporterRender(xml)
        const rels = new DOCXExporterRels(xml, "document")
        const metadata = new DOCXExporterMetadata(xml, this.getBaseMetadata())

        return xml
            .init()
            .then(() => metadata.init())
            .then(() => tables.init())
            .then(() => math.init())
            .then(() => render.init())
            .then(() => rels.init())
            .then(() => this.exportChapters(xml, render, rels, math, tables))
            .then(() => xml.prepareBlob())
            .then(blob => this.download(blob))
    }

    exportChapters(xml, render, rels, math, tables) {
        return this.book.chapters
            .map((chapter, chapterIndex) => {
                return () => {
                    const doc = this.docList.find(
                        doc => doc.id === chapter.text
                    )
                    const docContent = moveFootnoteComments(
                        fixTables(removeHidden(doc.rawContent))
                    )

                    const images = new DOCXExporterImages(
                        docContent,
                        {db: doc.images},
                        xml,
                        rels
                    )
                    const lists = new DOCXExporterLists(docContent, xml, rels)
                    const citations = new DOCXExporterCitations(
                        docContent,
                        doc.settings,
                        {db: doc.bibliography},
                        this.csl,
                        xml
                    )

                    const footnotes = new DOCXExporterFootnotes(
                        doc,
                        docContent,
                        doc.settings,
                        {db: doc.images},
                        {db: doc.bibliography},
                        xml,
                        citations,
                        this.csl,
                        lists,
                        math,
                        tables,
                        rels
                    )

                    const richtext = new DOCXExporterRichtext(
                        doc,
                        doc.settings,
                        lists,
                        footnotes,
                        math,
                        tables,
                        rels,
                        citations,
                        images
                    )

                    const comments = new DOCXExporterComments(
                        docContent,
                        doc.comments,
                        xml,
                        rels,
                        richtext
                    )

                    return citations
                        .init()
                        .then(() => images.init())
                        .then(() => comments.init())
                        .then(() => lists.init())
                        .then(() => footnotes.init())
                        .then(() => {
                            const pmBib = footnotes.pmBib || citations.pmBib
                            render.render(
                                docContent,
                                pmBib,
                                doc.settings,
                                richtext,
                                citations,
                                chapterIndex
                            )
                            return Promise.resolve()
                        })
                }
            })
            .reduce((promiseChain, currentChapter) => {
                return promiseChain.then(() => currentChapter())
            }, Promise.resolve())
            .then(() =>
                render.renderAmbles(
                    Object.assign(
                        {
                            title: this.book.title,
                            language: this.book.settings.language
                        },
                        this.book.metadata
                    )
                )
            )
            .then(() => render.assemble())
    }

    getBaseMetadata() {
        const authors = this.book.metadata.author.length
            ? [{institution: this.book.metadata.author}]
            : []
        const keywords = this.book.metadata.keywords.length
            ? this.book.metadata.keywords
                  .split(",")
                  .map(keyword => keyword.trim())
            : []
        return {
            authors,
            keywords,
            title: this.book.title,
            language: this.book.settings.language
        }
    }

    download(blob) {
        return download(
            blob,
            createSlug(this.book.title) + ".docx",
            this.mimeType
        )
    }
}
