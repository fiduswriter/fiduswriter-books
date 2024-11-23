import download from "downloadjs"
import pretty from "pretty"

import {addAlert} from "../../../common"
import {JATSExporterConverter} from "../../../exporter/jats/convert"
import {darManifest} from "../../../exporter/jats/templates"
import {createSlug} from "../../../exporter/tools/file"
import {ZipFileCreator} from "../../../exporter/tools/zip"
import {getMissingChapterData} from "../tools"

import {bitsTemplate} from "./templates"

export class BITSBookExporter {
    constructor(schema, csl, book, user, docList, updated) {
        this.schema = schema
        this.csl = csl
        this.book = book
        this.user = user
        this.docList = docList
        this.updated = updated
        this.type = "book"
        this.textFiles = []
        this.httpFiles = []
    }

    init() {
        if (this.book.chapters.length === 0) {
            addAlert(
                "error",
                gettext("Book cannot be exported due to lack of chapters.")
            )
            return false
        }
        return getMissingChapterData(this.book, this.docList, this.schema).then(
            () => this.export()
        )
    }

    export() {
        this.book.chapters.sort((a, b) => (a.number > b.number ? 1 : -1))

        const imageDict = {}
        Promise.all(
            this.book.chapters.map(chapter => {
                const doc = this.docList.find(doc => doc.id === chapter.text)
                const converter = new JATSExporterConverter(
                    this.type,
                    doc,
                    this.csl,
                    {db: doc.images},
                    {db: doc.bibliography}
                )
                return converter
                    .init()
                    .then(({front, body, back, imageIds}) => {
                        imageIds.forEach(
                            imageId =>
                                (imageDict[imageId] = doc.images[imageId])
                        )
                        return {front, body, back}
                    })
            })
        ).then(chapters => this.createFiles(chapters, imageDict))
    }

    createFiles(chapters, imageDict) {
        const images = Object.values(imageDict).map(image => ({
            filename: image.image.split("/").pop().split("?")[0],
            url: image.image.split("?")[0],
            title: image.title
        }))

        this.zipFileName = `${createSlug(this.book.title)}.bits.zip`

        this.textFiles = [
            {
                filename: "manuscript.xml",
                contents: pretty(bitsTemplate(this.book, chapters), {ocd: true})
            },
            {
                filename: "manifest.xml",
                contents: pretty(
                    darManifest({
                        title: this.book.title,
                        type: this.type,
                        images
                    }),
                    {ocd: true}
                )
            }
        ]

        images.forEach(image => {
            this.httpFiles.push({filename: image.filename, url: image.url})
        })

        return this.createZip()
    }

    createZip() {
        const zipper = new ZipFileCreator(
            this.textFiles,
            this.httpFiles,
            undefined,
            undefined,
            this.updated
        )
        return zipper.init().then(blob => this.download(blob))
    }

    download(blob) {
        return download(blob, this.zipFileName, "application/zip")
    }
}
