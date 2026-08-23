import {getMissingDocumentListData} from "@fiduswriter/frontend/documents/tools"

/**
 * Browser `ChapterLoader` adapter.
 *
 * Implements the `ChapterLoader` interface from `@fiduswriter/books-document`
 * by delegating to the Fidus Writer core `getMissingDocumentListData` fetch
 * helper, which lazily loads a chapter's content, comments, bibliography and
 * images from the server and updates the document list entries in place.
 *
 * @param {Object} app - The Fidus Writer app instance (provides `apiConnectors.document`).
 * @returns {Object} A `ChapterLoader` with a `loadChapters` method.
 */
export const createChapterLoader = app => ({
    loadChapters(chapterIds, documentList, schema, rawContent = false) {
        return getMissingDocumentListData(
            chapterIds,
            documentList,
            schema,
            app.apiConnectors.document,
            rawContent
        )
    }
})
