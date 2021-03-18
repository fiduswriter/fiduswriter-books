import {getMissingDocumentListData} from "../../documents/tools"
import {addAlert} from "../../common"

export const getMissingChapterData = function(book, documentList, schema, rawContent) {
    const bookDocuments = book.chapters.map(chapter =>
        documentList.find(doc => doc.id === chapter.text)
    )

    if (bookDocuments.some(doc => doc === undefined)) {
        addAlert('error', gettext("Cannot produce book as you lack access rights to its chapters."))
        return Promise.reject(new Error("Cannot produce book as you lack access rights to its chapters."))
    }

    const docIds = book.chapters.map(chapter => chapter.text)

    return getMissingDocumentListData(docIds, documentList, schema, rawContent)
}

export const uniqueObjects = function(array) {
    const results = []

    for (let i = 0; i < array.length; i++) {
        let willCopy = true
        for (let j = 0; j < i; j++) {
            if (JSON.stringify(array[i]) === JSON.stringify(array[j])) {
                willCopy = false
                break
            }
        }
        if (willCopy) {
            results.push(array[i])
        }
    }

    return results
}
