import {addAlert} from "../../common"
import {getMissingDocumentListData} from "../../documents/tools"

export const getMissingChapterData = (
    book,
    documentList,
    schema,
    rawContent
) => {
    const bookDocuments = book.chapters.map(chapter =>
        documentList.find(doc => doc.id === chapter.text)
    )

    if (bookDocuments.some(doc => doc === undefined)) {
        addAlert(
            "error",
            gettext(
                "Cannot produce book as you lack access rights to its chapters."
            )
        )
        return Promise.reject(
            new Error(
                "Cannot produce book as you lack access rights to its chapters."
            )
        )
    }

    const docIds = book.chapters.map(chapter => chapter.text)
    const returnData = getMissingDocumentListData(
        docIds,
        documentList,
        schema,
        rawContent
    )
    return returnData
}
