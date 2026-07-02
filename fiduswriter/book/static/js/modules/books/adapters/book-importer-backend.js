import {addAlert, postJson} from "fwtoolkit"

/**
 * Browser `BookImporterBackend` factory.
 *
 * Implements the `BookImporterBackend` interface from
 * `@fiduswriter/books-document` by posting the imported book record to the
 * Fidus Writer server `/api/book/save/` endpoint. The chapter documents have
 * already been created on the server by `NativeImporter` (via the native
 * importer backend), so this only needs to persist the book itself.
 *
 * @param {string} path - The folder path where the imported book should land.
 * @returns {{createBook: Function}}
 */
export const createBookImporterBackend = (path = "/") => ({
    createBook(bookData, chapters, coverImageId) {
        const bookObj = {
            id: 0,
            title: bookData.title || gettext("Untitled"),
            path: path.endsWith("/") ? path : path + "/",
            metadata: bookData.metadata || {},
            settings: bookData.settings || {},
            chapters,
            rights: "write" // required by the server-side save guard
        }

        if (coverImageId) {
            bookObj.cover_image = coverImageId
        }

        return postJson("/api/book/save/", {book: bookObj})
            .then(({json}) => {
                bookObj.id = json.id
                return bookObj
            })
            .catch(error => {
                addAlert("error", gettext("Could not create book record."))
                throw error
            })
    }
})
