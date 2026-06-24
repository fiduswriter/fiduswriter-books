import {addAlert, postJson} from "fwtoolkit"
import {NativeImporter} from "../../../importer/native"

export const FIDUSBOOK_VERSION = "1.0"
export const MIN_FIDUSBOOK_VERSION = 1.0
export const MAX_FIDUSBOOK_VERSION = 1.0

/**
 * Imports a `.fidusbook` ZIP file.
 *
 * Steps performed:
 *  1. Validate the ZIP (magic bytes + required files).
 *  2. Parse book.json.
 *  3. For each chapter (in chapter_index order) call NativeImporter to create
 *     the document on the server and collect the resulting document IDs.
 *  4. Optionally upload the cover image via /api/usermedia/save/.
 *  5. Create the book on the server via /api/book/save/ using the new doc IDs.
 *
 * E2EE support:
 *  When `useE2EE` is true a fresh AES-GCM key is generated for every chapter.
 *  If the user has their passphrase keys in session the encrypted document
 *  password is also persisted to the server so access survives future sessions.
 */
export class NativeBookImporter {
    /**
     * @param {File}    file     - The .fidusbook file selected by the user.
     * @param {Object}  user     - The logged-in user object (id, name, …).
     * @param {string}  path     - The folder path where the book should land.
     * @param {boolean} useE2EE  - When true, import every chapter as an E2EE
     *                             encrypted document.
     */
    constructor(file, user, path = "/", useE2EE = false) {
        this.file = file
        this.user = user
        this.path = path.endsWith("/") ? path : path + "/"
        this.useE2EE = useE2EE

        this.ok = false
        this.statusText = ""
        this.bookId = null
    }

    /**
     * Entry point.  Validates the file is a ZIP, then delegates to readZip().
     * @returns {Promise<NativeBookImporter>} resolves with `this`
     */
    init() {
        return new Promise(resolve => {
            const reader = new window.FileReader()
            reader.onloadend = () => {
                if (
                    reader.result.length > 60 &&
                    reader.result.substring(0, 2) === "PK"
                ) {
                    this.readZip().then(() => resolve(this))
                } else {
                    this.statusText = gettext(
                        "The uploaded file does not appear to be a Fidusbook file."
                    )
                    resolve(this)
                }
            }
            // Read just the first 64 bytes to check the ZIP magic number.
            reader.readAsText(this.file.slice(0, 64))
        })
    }

    readZip() {
        return import("jszip")
            .then(({default: JSZip}) => new JSZip())
            .then(zipfs => zipfs.loadAsync(this.file))
            .then(zipfs => {
                const filenames = []
                zipfs.forEach(filename => filenames.push(filename))

                // Minimal sanity check before we start reading anything.
                if (
                    !filenames.includes("book.json") ||
                    !filenames.includes("filetype-version")
                ) {
                    this.statusText = gettext(
                        "The uploaded file does not appear to be a Fidusbook file."
                    )
                    return Promise.resolve(this)
                }

                // Read every entry, splitting text (.json / version / mimetype)
                // from binary blobs (images, cover, …).
                const textFiles = []
                const binaryFiles = []
                const reads = []

                filenames
                    .filter(f => !f.endsWith("/"))
                    .forEach(filename => {
                        reads.push(
                            new Promise(resolve => {
                                const isText =
                                    filename.endsWith(".json") ||
                                    filename === "filetype-version" ||
                                    filename === "mimetype"
                                const fileList = isText
                                    ? textFiles
                                    : binaryFiles
                                const fileType = isText ? "string" : "blob"
                                zipfs.files[filename]
                                    .async(fileType)
                                    .then(content => {
                                        fileList.push({filename, content})
                                        resolve()
                                    })
                            })
                        )
                    })

                return Promise.all(reads).then(() =>
                    this.processFidusbookFile(textFiles, binaryFiles)
                )
            })
    }

    async processFidusbookFile(textFiles, binaryFiles) {
        const versionEntry = textFiles.find(
            f => f.filename === "filetype-version"
        )
        const filetypeVersion = Number.parseFloat(versionEntry.content)

        if (
            filetypeVersion < MIN_FIDUSBOOK_VERSION ||
            filetypeVersion > MAX_FIDUSBOOK_VERSION
        ) {
            this.statusText =
                gettext(
                    "The Fidusbook file version is not supported by this server: "
                ) + versionEntry.content
            return
        }

        const mimetypeEntry = textFiles.find(f => f.filename === "mimetype")
        if (
            mimetypeEntry &&
            mimetypeEntry.content !== "application/fidusbook+zip"
        ) {
            this.statusText = gettext(
                "The uploaded file does not appear to be a Fidusbook file."
            )
            return
        }

        const bookData = JSON.parse(
            textFiles.find(f => f.filename === "book.json").content
        )

        // Chapters sorted by chapter_index so we process them in the correct
        // order (which also matches the storage directory numbering).
        const sortedChapters = [...bookData.chapters].sort(
            (a, b) => a.chapter_index - b.chapter_index
        )

        // Mapping from chapter_index → newly-created document ID on this server.
        const importedDocIds = {}

        // ── E2EE: resolve passphrase state once, before the chapter loop ──
        // This avoids repeated network calls to /api/user/encryption_key/.
        let passphraseInSession = false
        if (this.useE2EE) {
            const {PassphraseManager} = await import(
                "../../../editor/e2ee/passphrase-manager"
            )
            const hasPassphraseKeys =
                await PassphraseManager.hasEncryptionKeys()
            passphraseInSession =
                hasPassphraseKeys && PassphraseManager.hasKeysInSession()
        }

        // ── Import chapters one at a time (sequential) ────────────────────
        for (const chapter of sortedChapters) {
            const ci = chapter.chapter_index

            const docFile = textFiles.find(
                f => f.filename === `chapters/${ci}/document.json`
            )
            const imagesFile = textFiles.find(
                f => f.filename === `chapters/${ci}/images.json`
            )
            const bibFile = textFiles.find(
                f => f.filename === `chapters/${ci}/bibliography.json`
            )

            if (!docFile || !imagesFile || !bibFile) {
                addAlert(
                    "error",
                    gettext("Fidusbook file is missing data for chapter ") +
                        (sortedChapters.indexOf(chapter) + 1)
                )
                throw new Error(`Missing chapter data for index ${ci}`)
            }

            const docJson = JSON.parse(docFile.content)
            const imagesJson = JSON.parse(imagesFile.content)
            const bibJson = JSON.parse(bibFile.content)

            // Re-create the otherFiles list that NativeImporter / GetImages
            // expects: {filename: "images/<name>", content: <Blob>}.
            // The zip stores the binary at "chapters/<ci>/images/<name>" so
            // we strip the chapter prefix here.
            const chapterPrefix = `chapters/${ci}/images/`
            const chapterOtherFiles = binaryFiles
                .filter(f => f.filename.startsWith(chapterPrefix))
                .map(f => ({
                    filename: `images/${f.filename.slice(chapterPrefix.length)}`,
                    content: f.content
                }))

            // Put imported chapters in a subfolder named after the book so
            // they are neatly organised in the document overview.
            const safeBookTitle = (bookData.title || "Untitled").replace(
                /[/\\]/g,
                "-"
            )
            const chapterPath = `${this.path}${safeBookTitle}/${docJson.title || "Untitled"}`

            // ── Per-chapter E2EE key generation ──────────────────────────
            let e2eeOptions = null
            let chapterPassword = null
            if (this.useE2EE) {
                const result =
                    await this._generateE2EEOptions(passphraseInSession)
                e2eeOptions = result.options
                chapterPassword = result.password
            }

            const importer = new NativeImporter(
                docJson,
                bibJson,
                imagesJson,
                chapterOtherFiles,
                this.user,
                null, // importId – let NativeImporter extract it from the doc
                chapterPath,
                null, // template – extracted from doc content
                e2eeOptions
            )

            let doc
            try {
                ;({doc} = await importer.init())
            } catch (error) {
                addAlert(
                    "error",
                    gettext("Could not import chapter ") +
                        (docJson.title || sortedChapters.indexOf(chapter) + 1)
                )
                throw error
            }

            importedDocIds[ci] = doc.id

            // ── Persist E2EE password for future sessions ─────────────────
            // NativeImporter already stores the raw key in sessionStorage via
            // E2EEKeyManager.storeKeyInSession() — that is sufficient for
            // decryptE2EETitles() and for accessing the document within the
            // current browser session.  We additionally store the password
            // so that decryptE2EEChapters() (used during export) can derive
            // the key from it, and — when passphrase keys are available —
            // save it to the server so it survives future sessions.
            if (this.useE2EE && chapterPassword !== null) {
                const {E2EEKeyManager} = await import(
                    "../../../editor/e2ee/key-manager"
                )
                E2EEKeyManager.storePasswordInSession(doc.id, chapterPassword)

                if (passphraseInSession) {
                    const {PassphraseManager} = await import(
                        "../../../editor/e2ee/passphrase-manager"
                    )
                    try {
                        await PassphraseManager.saveDocumentPassword(
                            doc.id,
                            chapterPassword,
                            null,
                            "user",
                            true
                        )
                    } catch (_e) {
                        // Non-fatal: the key is still cached for this session.
                    }
                }
            }
        }

        const coverImageId = await this.importCoverImage(bookData, binaryFiles)
        await this.createBook(
            bookData,
            sortedChapters,
            importedDocIds,
            coverImageId
        )
        this.ok = true
        this.statusText = `"${bookData.title}" ${gettext("successfully imported.")}`
    }

    /**
     * Generate a fresh AES-GCM key for one E2EE chapter.
     *
     * When the user has passphrase keys unlocked in session a random document
     * password (raw DEK) is generated via PassphraseManager so that it can
     * later be saved to the server (encrypted with the master key).  Otherwise
     * a random 32-byte DEK is generated directly — access is session-scoped.
     *
     * @param {boolean} passphraseInSession
     * @returns {Promise<{options: Object, password: string}>}
     */
    async _generateE2EEOptions(passphraseInSession) {
        const {E2EEKeyManager} = await import(
            "../../../editor/e2ee/key-manager"
        )
        const {PassphraseManager} = await import(
            "../../../editor/e2ee/passphrase-manager"
        )

        let password
        if (passphraseInSession) {
            // Generates a 44-char base64-encoded random 32-byte DEK.
            // resolvePasswordToKey() will import it directly — no PBKDF2 round.
            password = await PassphraseManager.generateDocumentPassword()
        } else {
            // No passphrase system — generate a raw DEK directly.
            const rawKey = crypto.getRandomValues(new Uint8Array(32))
            password = btoa(String.fromCharCode(...rawKey))
        }

        const salt = E2EEKeyManager.generateSalt()
        const saltBase64 = btoa(String.fromCharCode(...salt))
        const iterations = 600000

        const key = await PassphraseManager.resolvePasswordToKey(
            password,
            salt,
            iterations
        )

        return {
            options: {enabled: true, key, salt: saltBase64, iterations},
            password
        }
    }

    /**
     * Upload the cover image to the user's media library.
     * @returns {Promise<number|false>} new image ID, or false if none / failed
     */
    importCoverImage(bookData, binaryFiles) {
        if (!bookData.cover_image) {
            return Promise.resolve(false)
        }
        const coverImagePath = bookData.cover_image.image
        const coverEntry = binaryFiles.find(f => f.filename === coverImagePath)
        if (!coverEntry) {
            // Cover image data was described but the binary is missing –
            // import proceeds without it rather than aborting.
            return Promise.resolve(false)
        }

        const filename = coverImagePath.split("/").pop()
        const imageFile = new File([coverEntry.content], filename, {
            type: bookData.cover_image.file_type
        })

        return postJson(
            "/api/usermedia/save/",
            {
                title: bookData.cover_image.title || "",
                checksum: bookData.cover_image.checksum || "",
                copyright: {
                    holder: false,
                    year: false,
                    freeToRead: true,
                    licenses: []
                },
                cats: ""
            },
            {image: {file: imageFile, filename}}
        )
            .then(({json}) => (json.values ? json.values.id : false))
            .catch(() => false) // Non-fatal: book still gets created without cover
    }

    /**
     * Create the book record on the server.
     */
    createBook(bookData, sortedChapters, importedDocIds, coverImageId) {
        const chapters = sortedChapters.map(chapter => ({
            text: importedDocIds[chapter.chapter_index],
            number: chapter.number,
            part: chapter.part || ""
        }))

        const bookObj = {
            id: 0,
            title: bookData.title || gettext("Untitled"),
            path: this.path,
            metadata: bookData.metadata || {},
            settings: bookData.settings || {},
            chapters,
            rights: "write" // required by client-side saveBook guard
        }

        if (coverImageId) {
            bookObj.cover_image = coverImageId
        }

        return postJson("/api/book/save/", {book: bookObj})
            .then(({json}) => {
                this.bookId = json.id
            })
            .catch(error => {
                addAlert("error", gettext("Could not create book record."))
                throw error
            })
    }
}
