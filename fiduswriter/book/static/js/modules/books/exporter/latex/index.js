import {BibLatexExporter} from "biblatex-csl-converter"
import download from "downloadjs"

import {getMissingChapterData} from "../tools"
import {LatexExporterConvert} from "../../../exporter/latex/convert"
import {bookTexTemplate} from "./templates"
import {createSlug} from "../../../exporter/tools/file"
import {removeHidden} from "../../../exporter/tools/doc_content"
import {ZipFileCreator} from "../../../exporter/tools/zip"

export class LatexBookExporter {

    constructor(schema, book, user, docList, updated) {
        this.schema = schema
        this.book = book
        this.book.chapters.sort((a, b) => a.number > b.number)
        this.user = user // Not used, but we keep it for consistency
        this.docList = docList
        this.updated = updated

        this.textFiles = []
        this.httpFiles = []
    }

    init() {
        return getMissingChapterData(this.book, this.docList, this.schema).then(
            () => this.export()
        )
    }

    export() {
        this.zipFileName = `${createSlug(this.book.title)}.latex.zip`
        let bibIds = [], imageIds = []
        const features = {}, combinedBibliography = {}, combinedImages = {}
        this.book.chapters.forEach((chapter, index) => {
            const doc = this.docList.find(doc => doc.id === chapter.text)
            const converter = new LatexExporterConvert(this, {db: doc.images}, {db: doc.bibliography}, doc.settings)
            const chapterContent = removeHidden(doc.content)
            const convertedDoc = converter.init(chapterContent)
            this.textFiles.push({
                filename: `chapter-${index + 1}.tex`,
                contents: convertedDoc.latex
            })
            bibIds = [...new Set(bibIds.concat(Object.keys(convertedDoc.usedBibDB)))]
            imageIds = [...new Set(imageIds.concat(convertedDoc.imageIds))]
            Object.assign(features, converter.features)
            Object.keys(convertedDoc.usedBibDB).forEach(bibId => combinedBibliography[bibId] = doc.bibliography[bibId])
            convertedDoc.imageIds.forEach(imageId => combinedImages[imageId] = doc.images[imageId])
        })
        if (bibIds.length > 0) {
            const bibExport = new BibLatexExporter(combinedBibliography, bibIds)
            this.textFiles.push({filename: 'bibliography.bib', contents: bibExport.output})
        }
        imageIds.forEach(id => {
            this.httpFiles.push({
                filename: combinedImages[id].image.split('/').pop(),
                url: combinedImages[id].image
            })
        })
        // Start a converter, only for creating a preamble/epilogue that combines
        // the features of all of the contained chapters.
        const bookConverter = new LatexExporterConvert(this, {db: combinedImages}, {db: combinedBibliography}, {language: 'en-US', bibliography_header: {}})
        bookConverter.features = features
        const preamble = bookConverter.assemblePreamble()
        const epilogue = bookConverter.assembleEpilogue()
        this.textFiles.push({
            filename: 'book.tex',
            contents: bookTexTemplate({
                book: this.book,
                preamble,
                epilogue
            })
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

        return zipper.init().then(
            blob => this.download(blob)
        )
    }

    download(blob) {
        return download(blob, this.zipFileName, 'application/zip')
    }
}
