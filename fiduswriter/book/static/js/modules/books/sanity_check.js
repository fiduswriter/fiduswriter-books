import {escapeText} from "../common"

import {getMissingChapterData} from "./exporter/tools"


function findContentIssues(node, chapter, doc, messages) {
    if (node.attrs?.track?.length || node.marks?.find(mark => mark.type === 'deletion' || (mark.type === 'insertion' && mark.attrs.approved === false))) {
        messages.warnings.push(`${gettext('Unresolved tracked changes')} (${gettext('Chapter')} ${chapter.number}, ${escapeText(chapter.title)})`)
    }
    if (node.marks?.find(mark => {
        if (mark.type !== 'comment') {
            return false
        }
        return doc.comments[parseInt(mark.attrs.id)].resolved === false
    })) {
        messages.warnings.push(`${gettext('Unresolved comments')} (${gettext('Chapter')} ${chapter.number}, ${escapeText(chapter.title)})`)
    }
    if (node.content) {
        node.content.forEach(subNode => findContentIssues(subNode, chapter, doc, messages))
    }

}

export const bookSanityCheck = (book, documentList, schema) => {
    if (!book.chapters.length) {
        return Promise.resolve(
            `<ul class="errorlist"><li>${
                gettext('The book contains no chapters.')
            }</li></ul>`
        )
    }
    return getMissingChapterData(book, documentList, schema, true).then(
        () => {
            const messages = {
                warnings: [],
                errors: []
            }
            console.log({book, documentList, schema, messages})
            book.chapters.forEach(chapter => {
                const doc = documentList.find(doc => doc.id === chapter.text)
                if (!doc.rawContent) {
                    messages.errors.push(`${gettext('No access')} (${gettext('Chapter')} ${chapter.number}, ${escapeText(chapter.title)})`)
                    return
                }
                findContentIssues(doc.rawContent, chapter, doc, messages)
            })

            const warnings = Array.from(new Set(messages.warnings))
            const errors = Array.from(new Set(messages.errors))
            if (!warnings.length && !errors.length) {
                return `<p>${gettext('No issues were found.')}</p>`
            }
            return `<ul class="warninglist">
                    ${warnings.map(warning => `<li>${warning}</li>`).join('')}
                </ul>
                <ul class="errorlist">
                    ${errors.map(error => `<li>${error}</li>`).join('')}
                </ul>`
        }
    )


}
