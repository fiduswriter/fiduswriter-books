import {getMissingChapterData, uniqueObjects} from "../tools"
import {LatexExporterConvert} from "../../../exporter/latex/convert"
import {bookTexTemplate} from "./templates"
import {createSlug} from "../../../exporter/tools/file"
import {removeHidden} from "../../../exporter/tools/doc-contents"
import {BibLatexExporter} from "biblatex-csl-converter"
import {ZipFileCreator} from "../../../exporter/tools/zip"
import download from "downloadjs"

export class LatexBookExporter {

    constructor(book, user, docList) {
        this.book = book
        this.book.chapters.sort((a,b) => a.number > b.number)
        this.user = user // Not used, but we keep it for consistency
        this.docList = docList
        this.textFiles = []
        this.httpFiles = []

        getMissingChapterData(this.book, this.docList).then(
            () => this.init()
        ).catch(
            () => {}
        )
    }

    init() {
        this.zipFileName = `${createSlug(this.book.title)}.latex.zip`
        let bibIds = [], imageIds = [], features = {}, combinedBibliography = {}, combinedImages = {}
        this.book.chapters.forEach((chapter, index) => {
            let doc = this.docList.find(doc => doc.id === chapter.text)
            let converter = new LatexExporterConvert(this, {db: doc.images}, {db: doc.bibliography})
            let chapterContents = removeHidden(doc.contents)
            let convertedDoc = converter.init(chapterContents)
            this.textFiles.push({
                filename: `chapter-${index+1}.tex`,
                contents: convertedDoc.latex
            })
            bibIds = [...new Set(bibIds.concat(Object.keys(convertedDoc.usedBibDB)))]
            imageIds = [...new Set(imageIds.concat(convertedDoc.imageIds))]
            Object.assign(features, converter.features)
            Object.keys(convertedDoc.usedBibDB).forEach(bibId => combinedBibliography[bibId] = doc.bibliography[bibId])
            convertedDoc.imageIds.forEach(imageId => combinedImages[imageId] = doc.images[imageId])
        })
        if (bibIds.length > 0) {
            let bibExport = new BibLatexExporter(combinedBibliography, bibIds)
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
        let bookConverter = new LatexExporterConvert(this, {db: combinedImages}, {db: combinedBibliography})
        bookConverter.features = features
        let preamble = bookConverter.assemblePreamble()
        let epilogue = bookConverter.assembleEpilogue()
        this.textFiles.push({
            filename: 'book.tex',
            contents: bookTexTemplate({
                book: this.book,
                preamble,
                epilogue
            })
        })
        let zipper = new ZipFileCreator(
            this.textFiles,
            this.httpFiles
        )

        zipper.init().then(
            blob => download(blob, this.zipFileName, 'application/zip')
        )
    }
}
