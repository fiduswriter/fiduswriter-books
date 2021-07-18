import {longFilePath} from "../common"

import {getMissingChapterData} from "./exporter/tools"


const labelChapter = (chapter, doc) => `(${gettext('Chapter')} ${chapter.number}, ${longFilePath(doc.title, doc.path)})`

function findContentIssues(node, chapter, doc, messages) {
    if (node.attrs?.track?.length) {
        messages.warnings.push(`${gettext('Unresolved tracked changes')} ${labelChapter(chapter, doc)}`)
    }
    if (node.marks) {
        node.marks.forEach(mark => {
            if (mark.type == 'link' && mark.attrs.href.charAt(0) === '#' && !mark.attrs.title) {
                messages.warnings.push(`${gettext('Internal links without target')} ${labelChapter(chapter, doc)}`)
            } else if (mark.type == 'comment' && doc.comments[parseInt(mark.attrs.id)].resolved === false) {
                messages.warnings.push(`${gettext('Unresolved comments')} ${labelChapter(chapter, doc)}`)
            } else if (mark.type === 'deletion' || (mark.type === 'insertion' && mark.attrs.approved === false)) {
                messages.warnings.push(`${gettext('Unresolved tracked changes')} ${labelChapter(chapter, doc)}`)
            }
        })
    }
    if (node.type === 'cross_reference' && !node.attrs.title) {
        messages.warnings.push(`${gettext('Cross references without targets')} ${labelChapter(chapter, doc)}`)
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
            book.chapters.forEach(chapter => {
                const doc = documentList.find(doc => doc.id === chapter.text)
                if (!doc || !doc.rawContent) {
                    messages.errors.push(`${gettext('No access')} ${labelChapter(chapter, doc)}`)
                    return
                }
                if (!doc.title || !doc.title.length) {
                    messages.warnings.push(`${gettext('No chapter title')} ${labelChapter(chapter, doc)}`)
                }
                findContentIssues(doc.rawContent, chapter, doc, messages)
            })

            const warnings = Array.from(new Set(messages.warnings))
            const errors = Array.from(new Set(messages.errors))
            if (!warnings.length && !errors.length) {
                return `<p>${gettext('No issues were found:')}</p>
                    <p>${gettext('The book contains chapters.')}</p>
                    <p>${gettext('Each chapter has a title.')}</p>
                    <p>${gettext('There are no unresolved tracked changes.')}</p>
                    <p>${gettext('There are no unresolved comments.')}</p>
                    <p>${gettext('All cross references have working targets.')}</p>
                    <p>${gettext('All internal links have working targets.')}</p>`
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
