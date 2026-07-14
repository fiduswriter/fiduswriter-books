import {getMissingChapterData} from "@fiduswriter/books-document/exporter/tools"
import {longFilePath} from "fwtoolkit"

import {chapterLoader} from "./adapters/chapter-loader"
import {e2eeStrategy} from "./adapters/e2ee-strategy"

const labelChapter = (chapter, doc) =>
    `(${gettext("Chapter")} ${chapter.number}, ${longFilePath(
        doc.title,
        doc.path
    )})`

function findContentIssues(node, chapter, doc, messages) {
    if (node.attrs?.track?.length) {
        messages.warnings.push(
            `${gettext("Unresolved tracked changes")} ${labelChapter(chapter, doc)}`
        )
    }
    if (node.marks) {
        node.marks.forEach(mark => {
            if (
                mark.type == "link" &&
                mark.attrs.href.charAt(0) === "#" &&
                !mark.attrs.title
            ) {
                messages.warnings.push(
                    `${gettext("Internal links without target")} ${labelChapter(
                        chapter,
                        doc
                    )}`
                )
            } else if (
                mark.type == "comment" &&
                doc.comments[Number.parseInt(mark.attrs.id)]?.resolved === false
            ) {
                messages.warnings.push(
                    `${gettext("Unresolved comments")} ${labelChapter(chapter, doc)}`
                )
            } else if (
                mark.type === "deletion" ||
                (mark.type === "insertion" && mark.attrs.approved === false)
            ) {
                messages.warnings.push(
                    `${gettext("Unresolved tracked changes")} ${labelChapter(
                        chapter,
                        doc
                    )}`
                )
            }
        })
    }
    if (node.type === "cross_reference" && !node.attrs.title) {
        messages.warnings.push(
            `${gettext("Cross references without targets")} ${labelChapter(
                chapter,
                doc
            )}`
        )
    }

    if (node.content) {
        node.content.forEach(subNode =>
            findContentIssues(subNode, chapter, doc, messages)
        )
    }
}

export const bookSanityCheck = (book, documentList, schema) => {
    if (!book.chapters.length) {
        return Promise.resolve(
            `<ul class="fw-errorlist"><li>${gettext(
                "The book contains no chapters."
            )}</li></ul>`
        )
    }
    return getMissingChapterData(book, documentList, schema, {
        rawContent: true,
        loader: chapterLoader,
        e2ee: e2eeStrategy
    })
        .then(() => {
            const messages = {
                warnings: [],
                errors: []
            }
            book.chapters.forEach(chapter => {
                const doc = documentList.find(doc => doc.id === chapter.text)
                if (!doc || !doc.rawContent) {
                    messages.errors.push(
                        `${gettext("No access")} ${labelChapter(chapter, doc)}`
                    )
                    return
                }
                if (!doc.title || !doc.title.length) {
                    messages.warnings.push(
                        `${gettext("No chapter title")} ${labelChapter(chapter, doc)}`
                    )
                }
                findContentIssues(doc.rawContent, chapter, doc, messages)
            })

            const warnings = Array.from(new Set(messages.warnings))
            const errors = Array.from(new Set(messages.errors))
            if (!warnings.length && !errors.length) {
                return `<p>${gettext("No issues were found:")}</p>
                    <p>${gettext("The book contains chapters.")}</p>
                    <p>${gettext("Each chapter has a title.")}</p>
                    <p>${gettext("There are no unresolved tracked changes.")}</p>
                    <p>${gettext("There are no unresolved comments.")}</p>
                    <p>${gettext("All cross references have working targets.")}</p>
                    <p>${gettext(
                        "All internal links have working targets."
                    )}</p>`
            }
            return `<ul class="warninglist">
                    ${warnings.map(warning => `<li>${warning}</li>`).join("")}
                </ul>
                <ul class="fw-errorlist">
                    ${errors.map(error => `<li>${error}</li>`).join("")}
                </ul>`
        })
        .catch(err => {
            // Passphrase unavailable or user cancelled the unlock dialog.
            if (
                err.message &&
                err.message.toLowerCase().includes("passphrase is required")
            ) {
                return `<ul class="fw-errorlist"><li>${gettext(
                    "This book contains encrypted chapters. A personal passphrase is required to perform a sanity check. Please set up or unlock your personal passphrase in your profile settings."
                )}</li></ul>`
            }
            // Individual chapter decryption failure — alerts were already
            // shown by decryptE2EEChapters; show a summary here.
            return `<ul class="fw-errorlist"><li>${gettext(
                "One or more encrypted chapters could not be decrypted. See the error notifications for details."
            )}</li></ul>`
        })
}
