import download from "downloadjs"

import {ShrinkFidus} from "@fiduswriter/document/exporter/native/shrink"
import {createSlug} from "@fiduswriter/document/exporter/tools/file"
import {ZipFileCreator} from "@fiduswriter/document/exporter/tools/zip"
import {addAlert} from "../../../common"
import {getMissingChapterData} from "../tools"

export const FIDUSBOOK_VERSION = "1.0"

/**
 * Exports a book and all its chapters as a single `.fidusbook` file.
 *
 * ZIP structure:
 *
 *   mimetype                         → "application/fidusbook+zip"
 *   filetype-version                 → FIDUSBOOK_VERSION
 *   book.json                        → book metadata + ordered chapter list
 *   chapters/<n>/document.json       → chapter document (same format as .fidus)
 *   chapters/<n>/images.json         → image DB entries for that chapter
 *   chapters/<n>/bibliography.json   → bibliography DB entries for that chapter
 *   chapters/<n>/images/<filename>   → binary image files for that chapter
 *   cover/<filename>                 → cover image (optional)
 *
 * Image paths inside each chapter's images.json retain their original
 * relative form ("images/photo.jpg").  Only the ZIP storage path is
 * prefixed with the chapter directory so files do not collide.
 */
export class NativeBookExporter {
    constructor(schema, book, user, documentList, updated) {
        this.schema = schema
        this.book = book
        this.user = user
        this.documentList = documentList
        this.updated = updated
    }

    init() {
        if (this.book.chapters.length === 0) {
            addAlert(
                "error",
                gettext("Book cannot be exported due to lack of chapters.")
            )
            return Promise.resolve(false)
        }

        addAlert(
            "info",
            `${this.book.title}: ${gettext("Fidusbook export has been initiated.")}`
        )

        return getMissingChapterData(this.book, this.documentList, this.schema)
            .then(() => this.exportContents())
            .catch(error => {
                addAlert(
                    "error",
                    `${this.book.title}: ${gettext("Fidusbook export failed.")}`
                )
                throw error
            })
    }

    exportContents() {
        const textFiles = []
        const httpFiles = []

        // Sort chapters by their display number so chapter_index values in
        // book.json reflect the reading order.
        const sortedChapters = [...this.book.chapters].sort(
            (a, b) => a.number - b.number
        )

        // ── book.json ────────────────────────────────────────────────────────
        const bookData = {
            title: this.book.title,
            path: this.book.path || "/",
            metadata: this.book.metadata || {},
            settings: this.book.settings || {},
            chapters: sortedChapters.map((chapter, index) => ({
                number: chapter.number,
                part: chapter.part || "",
                chapter_index: index
            }))
        }

        // ── Cover image ──────────────────────────────────────────────────────
        if (this.book.cover_image_data) {
            const coverImage = this.book.cover_image_data
            const imageUrl = coverImage.image.split("?")[0]
            const filename = imageUrl.split("/").pop()
            bookData.cover_image = {
                title: coverImage.title || "",
                checksum: coverImage.checksum || "",
                file_type: coverImage.file_type,
                image: `cover/${filename}`
            }
            httpFiles.push({url: imageUrl, filename: `cover/${filename}`})
        }

        // ── Chapters ─────────────────────────────────────────────────────────
        // Process sequentially to avoid hammering the server with concurrent
        // image fetches for large books.
        const processChapter = index => {
            if (index >= sortedChapters.length) {
                return Promise.resolve()
            }
            const chapter = sortedChapters[index]
            const doc = this.documentList.find(d => d.id === chapter.text)
            if (!doc) {
                return processChapter(index + 1)
            }

            // ShrinkFidus normally shows one "export initiated" alert per
            // call.  Pass silent=true so it suppresses that for individual
            // chapters; we already showed a single book-level alert above.
            const shrinker = new ShrinkFidus(
                doc,
                {db: doc.images || {}},
                {db: doc.bibliography || {}},
                true // silent – suppresses per-chapter alert
            )

            return shrinker
                .init()
                .then(
                    ({
                        doc: shrunkDoc,
                        shrunkImageDB,
                        shrunkBibDB,
                        httpIncludes
                    }) => {
                        // Prefix the in-zip path for binary image files so
                        // chapters do not overwrite each other's images.
                        // The path stored *inside* images.json keeps its
                        // original "images/<name>" form so that GetImages
                        // (which NativeImporter uses) can still find the
                        // file once we strip the prefix on import.
                        httpIncludes.forEach(include => {
                            include.filename = `chapters/${index}/${include.filename}`
                        })

                        textFiles.push(
                            {
                                filename: `chapters/${index}/document.json`,
                                contents: JSON.stringify(shrunkDoc)
                            },
                            {
                                filename: `chapters/${index}/images.json`,
                                contents: JSON.stringify(shrunkImageDB)
                            },
                            {
                                filename: `chapters/${index}/bibliography.json`,
                                contents: JSON.stringify(shrunkBibDB)
                            }
                        )
                        httpFiles.push(...httpIncludes)
                    }
                )
                .then(() => processChapter(index + 1))
        }

        return processChapter(0).then(() => {
            textFiles.push(
                {filename: "book.json", contents: JSON.stringify(bookData)},
                {filename: "filetype-version", contents: FIDUSBOOK_VERSION}
            )

            const zipper = new ZipFileCreator(
                textFiles,
                httpFiles,
                [],
                "application/fidusbook+zip",
                this.updated
            )
            return zipper
                .init()
                .then(blob =>
                    download(
                        blob,
                        `${createSlug(this.book.title)}.fidusbook`,
                        "application/fidusbook+zip"
                    )
                )
        })
    }
}
