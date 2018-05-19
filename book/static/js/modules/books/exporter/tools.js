import {getMissingDocumentListData} from "../../documents/tools"
import {addAlert} from "../../common"

export let getMissingChapterData = function (book, documentList) {
    let bookDocuments = book.chapters.map(chapter =>
        documentList.find(doc => doc.id === chapter.text)
    )

    if (bookDocuments.some(doc => doc === undefined)) {
        addAlert('error', "Cannot produce book as you lack access rights to its chapters.")
        return Promise.reject()
    }

    let docIds = book.chapters.map(chapter => chapter.text)

    return getMissingDocumentListData(docIds, documentList)
}

export let uniqueObjects = function (array) {
    let results = []

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
