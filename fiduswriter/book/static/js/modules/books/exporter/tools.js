import {getSettings} from "@fiduswriter/document/schema/convert"
import {addAlert} from "../../common"
import {getMissingDocumentListData} from "../../documents/tools"
import {E2EEEncryptor} from "../../editor/e2ee/encryptor"
import {enterPassphraseDialog} from "../../editor/e2ee/passphrase-dialog"
import {PassphraseManager} from "../../editor/e2ee/passphrase-manager"
import {acceptAllNoInsertions} from "../../editor/track"

/**
 * Ensure the user's personal passphrase keys are available in the session.
 * If keys are already unlocked, resolves immediately with true.
 * If the user has no passphrase set up, resolves with false.
 * Otherwise opens the passphrase dialog and resolves true on success or false
 * if the user cancels.
 *
 * @returns {Promise<boolean>}
 */
const ensurePassphraseUnlocked = () => {
    if (PassphraseManager.hasKeysInSession()) {
        return Promise.resolve(true)
    }
    return PassphraseManager.hasEncryptionKeys().then(hasKeys => {
        if (!hasKeys) {
            return false
        }
        return new Promise(resolve => {
            const tryUnlock = (errorMessage = "") => {
                let unlockAttempted = false
                enterPassphraseDialog(
                    passphrase => {
                        unlockAttempted = true
                        PassphraseManager.unlockWithPassphrase(passphrase)
                            .then(() => resolve(true))
                            .catch(() => {
                                tryUnlock(
                                    gettext(
                                        "Wrong passphrase. Please try again."
                                    )
                                )
                            })
                    },
                    null,
                    errorMessage ? {errorMessage} : {}
                ).then(() => {
                    // Dialog resolved — if unlock was never attempted the user
                    // clicked Cancel.
                    if (!unlockAttempted) {
                        resolve(false)
                    }
                })
            }
            tryUnlock()
        })
    })
}

/**
 * Decrypt all E2EE chapters in the book whose content is still an encrypted
 * string (i.e. chapters that have an e2ee_snapshot but haven't been
 * decrypted yet in this session).
 *
 * Fetches the document password for each chapter via PassphraseManager,
 * derives the AES-GCM key from the stored salt, then decrypts and parses
 * the ProseMirror content — updating doc.content, doc.rawContent (when
 * rawContent is true), and doc.settings in-place on the documentList entry.
 *
 * Rejects if the passphrase is unavailable or any chapter cannot be
 * decrypted.
 *
 * @param {Object} book
 * @param {Array}  documentList
 * @param {Object} schema      - ProseMirror schema
 * @param {boolean} rawContent - whether to also populate doc.rawContent
 * @returns {Promise<void>}
 */
const decryptE2EEChapters = (book, documentList, schema, rawContent) => {
    // Only process chapters whose document still has encrypted string content.
    const e2eeChapters = book.chapters.filter(chapter => {
        const doc = documentList.find(doc => doc.id === chapter.text)
        return doc && doc.e2ee && typeof doc.content === "string"
    })

    if (!e2eeChapters.length) {
        return Promise.resolve()
    }

    return ensurePassphraseUnlocked().then(unlocked => {
        if (!unlocked) {
            addAlert(
                "error",
                gettext(
                    "A personal passphrase is required to work with books that contain encrypted chapters. Please set up or unlock your personal passphrase in your profile settings."
                )
            )
            return Promise.reject(
                new Error("Passphrase required for encrypted chapters")
            )
        }

        return Promise.all(
            e2eeChapters.map(chapter => {
                const doc = documentList.find(d => d.id === chapter.text)
                const chapterLabel = doc.title
                    ? `"${doc.title}"`
                    : gettext("Untitled")

                return PassphraseManager.getDocumentPassword(doc.id).then(
                    password => {
                        if (!password) {
                            addAlert(
                                "error",
                                `${gettext("No encryption key found for chapter:")} ${chapterLabel}. ${gettext("The key may not have been shared with you.")}`
                            )
                            return Promise.reject(
                                new Error(
                                    `No encryption key for document ${doc.id}`
                                )
                            )
                        }

                        // Decode the base64-encoded salt stored by
                        // getMissingDocumentListData on the doc object.
                        let salt
                        if (doc.e2ee_salt) {
                            const binary = atob(doc.e2ee_salt)
                            salt = new Uint8Array(binary.length)
                            for (let i = 0; i < binary.length; i++) {
                                salt[i] = binary.charCodeAt(i)
                            }
                        } else {
                            // No salt means the document has no encrypted
                            // snapshot yet — skip gracefully.
                            return Promise.resolve()
                        }
                        const iterations = doc.e2ee_iterations || 600000

                        return PassphraseManager.resolvePasswordToKey(
                            password,
                            salt,
                            iterations
                        )
                            .then(key =>
                                // Keep key in scope for image decryption by
                                // nesting the next step inside this .then().
                                E2EEEncryptor.decryptObject(
                                    doc.content,
                                    key
                                ).then(decryptedContent => {
                                    // --- 1. Update the plaintext title -------
                                    // doc.title is the encrypted ciphertext
                                    // until we overwrite it here.  The title
                                    // node is always the first child of the
                                    // document node.
                                    const titleContent =
                                        decryptedContent?.content?.[0]
                                            ?.content || []
                                    let title = ""
                                    titleContent.forEach(child => {
                                        // Skip text that belongs to a tracked
                                        // deletion so the title matches what
                                        // the user actually sees.
                                        if (
                                            !(child.marks || []).some(
                                                m => m.type === "deletion"
                                            )
                                        ) {
                                            title += child.text || ""
                                        }
                                    })
                                    if (title) {
                                        doc.title = title.substring(0, 255)
                                        // Keep sessionStorage in sync so the
                                        // document overview also shows the
                                        // decrypted title.
                                        sessionStorage.setItem(
                                            `e2ee_title_${doc.id}`,
                                            doc.title
                                        )
                                    }

                                    // --- 2. Parse ProseMirror content --------
                                    if (rawContent) {
                                        doc.rawContent = JSON.parse(
                                            JSON.stringify(
                                                schema
                                                    .nodeFromJSON(
                                                        decryptedContent
                                                    )
                                                    .toJSON()
                                            )
                                        )
                                    }
                                    doc.content = acceptAllNoInsertions(
                                        schema.nodeFromJSON(decryptedContent)
                                    ).toJSON()
                                    doc.settings = getSettings(doc.content)

                                    // --- 3. Decrypt encrypted images ---------
                                    // get_documentlist_extra returns
                                    // EncryptedDocumentImage records as
                                    // file_type "application/octet-stream".
                                    // We decrypt each one with the same
                                    // AES-GCM key and replace the server URL
                                    // with a local blob URL so that exporters
                                    // (HTML, EPUB, …) can include the images
                                    // without encountering encrypted bytes.
                                    const encryptedImageEntries =
                                        Object.entries(doc.images || {}).filter(
                                            ([, entry]) =>
                                                entry.file_type ===
                                                    "application/octet-stream" &&
                                                entry.image
                                        )

                                    if (!encryptedImageEntries.length) {
                                        return
                                    }

                                    return Promise.all(
                                        encryptedImageEntries.map(
                                            ([id, entry]) =>
                                                E2EEEncryptor.decryptImageToUrl(
                                                    entry.image,
                                                    key
                                                )
                                                    .then(blobUrl => {
                                                        doc.images[id] = {
                                                            ...entry,
                                                            image: blobUrl,
                                                            // Replace the
                                                            // opaque octet
                                                            // type with a
                                                            // generic image
                                                            // type so the
                                                            // exporter treats
                                                            // the entry as a
                                                            // normal image.
                                                            file_type:
                                                                "image/png"
                                                        }
                                                    })
                                                    .catch(() => {
                                                        // Remove any entry
                                                        // that cannot be
                                                        // decrypted so the
                                                        // exporter never
                                                        // receives an
                                                        // undefined
                                                        // imageDBEntry.
                                                        delete doc.images[id]
                                                    })
                                        )
                                    )
                                })
                            )
                            .catch(err => {
                                // Re-throw "no key" errors that we already
                                // alerted about; for all other decryption
                                // failures show a specific message.
                                if (
                                    err.message &&
                                    err.message.startsWith("No encryption key")
                                ) {
                                    throw err
                                }
                                addAlert(
                                    "error",
                                    `${gettext("Could not decrypt chapter:")} ${chapterLabel}. ${gettext("The document may have been re-encrypted with a different password.")}`
                                )
                                throw err
                            })
                    }
                )
            })
        )
    })
}

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
    return getMissingDocumentListData(
        docIds,
        documentList,
        schema,
        rawContent
    ).then(() => decryptE2EEChapters(book, documentList, schema, rawContent))
}
