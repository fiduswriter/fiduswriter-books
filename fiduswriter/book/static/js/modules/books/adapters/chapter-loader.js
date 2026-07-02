import {getMissingDocumentListData} from "../../documents/tools"

/**
 * Browser `ChapterLoader` adapter.
 *
 * Implements the `ChapterLoader` interface from `@fiduswriter/books-document`
 * by delegating to the Fidus Writer core `getMissingDocumentListData` fetch
 * helper, which lazily loads a chapter's content, comments, bibliography and
 * images from the server and updates the document list entries in place.
 */
export const chapterLoader = {
    loadChapters(chapterIds, documentList, schema, rawContent = false) {
        return getMissingDocumentListData(
            chapterIds,
            documentList,
            schema,
            rawContent
        )
    }
}
