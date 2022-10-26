import {bookDialogTemplate, bookBasicInfoTemplate, bookDialogChaptersTemplate, bookBibliographyDataTemplate,
    bookEpubDataTemplate, bookPrintDataTemplate,
    bookChapterListTemplate, bookChapterDialogTemplate,
    bookEpubDataCoverTemplate, bookSanityCheckTemplate
} from "./templates"
import {exportMenuModel} from "./menu"
import {bookSanityCheck} from "./sanity_check"
import {ImageSelectionDialog} from "../images/selection_dialog"
import {addAlert, postJson, post, Dialog, findTarget, FileSelector, longFilePath, escapeText, ContentMenu} from "../common"


function emptyMetadata() {
    return {
        author: "",
        subtitle: "",
        version: "",
        publisher: "",
        copyright: "",
        keywords: ""
    }
}

export class BookActions {

    constructor(bookOverview) {
        bookOverview.mod.actions = this
        this.bookOverview = bookOverview
        this.exportMenu = exportMenuModel()
        this.onSave = []
        this.dialogParts = [
            {
                title: gettext("Basic info"),
                description: gettext("Basic book information"),
                template: bookBasicInfoTemplate
            },
            {
                title: gettext("Chapters"),
                description: gettext("Documents assigned as chapters"),
                template: bookDialogChaptersTemplate
            },
            {
                title: gettext("Bibliography"),
                description: gettext("Bibliography related settings"),
                template: bookBibliographyDataTemplate
            },
            {
                title: gettext("Epub"),
                description: gettext("Epub related settings"),
                template: bookEpubDataTemplate
            },
            {
                title: gettext("Print/PDF"),
                description: gettext("Print related settings"),
                template: bookPrintDataTemplate
            },
            {
                title: gettext("Sanity check"),
                description: gettext("Perform sanity check on book"),
                template: bookSanityCheckTemplate
            }
        ]
    }

    deleteBook(id) {
        const book = this.bookOverview.bookList.find(book => book.id === id)
        if (!book) {
            return Promise.return()
        }

        return post(
            "/api/book/delete/",
            {id}
        ).catch(
            error => {
                addAlert("error", `${gettext("Could not delete book")}: '${longFilePath(book.title, book.path)}'`)
                throw (error)
            }
        ).then(() => {
            addAlert("success", `${gettext("Book has been deleted")}: '${longFilePath(book.title, book.path)}'`)
            this.bookOverview.bookList = this.bookOverview.bookList.filter(book => book.id !== id)
            this.bookOverview.initTable()
        })

    }

    deleteBookDialog(ids) {
        const bookPaths = ids.map(id => {
            const book = this.bookOverview.bookList.find(book => book.id === id)
            return escapeText(longFilePath(book.title, book.path))
        })
        const buttons = [
            {
                text: gettext("Delete"),
                classes: "fw-dark",
                click: () => {
                    Promise.all(ids.map(id => this.deleteBook(id))).then(
                        () => {
                            dialog.close()
                            this.bookOverview.initTable()
                        }
                    )
                }
            },
            {
                type: "close"
            }
        ]

        const dialog = new Dialog({
            title: gettext("Confirm deletion"),
            id: "confirmdeletion",
            icon: "exclamation-triangle",
            height: Math.min(50 + 15 * ids.length, 500),
            body: `<p>${
                ids.length > 1 ?
                    gettext("Do you really want to delete the following books?") :
                    gettext("Do you really want to delete the following book?")
            }</p>
            <p>
                ${bookPaths.join("<br>")}
            </p>`,
            buttons
        })
        dialog.open()
    }


    editChapterDialog(chapter, book) {
        const doc = this.bookOverview.documentList.find(doc => doc.id === chapter.text)
        let docTitle = doc.title
        if (!docTitle.length) {
            docTitle = gettext("Untitled")
        }

        const buttons = [
            {
                text: gettext("Submit"),
                classes: "fw-dark",
                click: () => {
                    chapter.part = document.getElementById("book-chapter-part").value
                    document.getElementById("book-chapter-list").innerHTML =
                        bookChapterListTemplate({
                            book,
                            documentList: this.bookOverview.documentList
                        })
                    dialog.close()
                }
            },
            {
                type: "cancel"
            }
        ]

        const dialog = new Dialog({
            title: `${gettext("Edit Chapter")}: ${chapter.number}. ${docTitle}`,
            body: bookChapterDialogTemplate({chapter}),
            width: 300,
            height: 100,
            buttons
        })
        dialog.open()
    }

    saveBook(book, oldBookId = false) {
        const oldBook = oldBookId ? this.bookOverview.bookList.find(
            book => book.id === oldBookId
        ) : false
        if (book.rights !== "write") {
            return Promise.resolve()
        }
        book.title = document.getElementById("book-title").value
        book.metadata.author = document.getElementById("book-metadata-author").value
        book.metadata.subtitle = document.getElementById("book-metadata-subtitle").value
        book.metadata.version = document.getElementById("book-metadata-version").value
        book.metadata.copyright = document.getElementById("book-metadata-copyright").value
        book.metadata.publisher = document.getElementById("book-metadata-publisher").value
        book.metadata.keywords = document.getElementById("book-metadata-keywords").value
        book.settings.language = document.getElementById("book-settings-language").value
        book.path = oldBook?.path || this.bookOverview.path
        const bookData = Object.assign({}, book)
        delete bookData.cover_image_data


        return postJson(
            "/api/book/save/",
            {book: JSON.stringify(bookData)}
        ).catch(
            error => {
                addAlert("error", gettext("The book could not be saved"))
                throw (error)
            }
        ).then(
            ({status, json}) => {
                if (status == 201) {
                    book.id = json.id
                    book.added = json.added
                }
                book.updated = json.updated
                if (oldBookId) {
                    this.bookOverview.bookList = this.bookOverview.bookList.filter(
                        book => book.id !== oldBookId
                    )
                }
                this.bookOverview.bookList.push(book)
                this.bookOverview.initTable()
                return Promise.all(this.onSave.map(method => method(book)))
            }
        )
    }

    copyBook(oldBook) {
        const book = Object.assign({}, oldBook)
        book.is_owner = true
        book.owner = this.bookOverview.user
        book.rights = "write"
        const path = longFilePath(oldBook.title, oldBook.path, `${gettext("Copy of")} `)
        return postJson(
            "/api/book/copy/",
            {id: book.id, path}
        ).catch(
            error => {
                addAlert("error", gettext("The book could not be copied"))
                throw (error)
            }
        ).then(
            ({json}) => {
                book.id = json["id"]
                book.path = json["path"]
                this.bookOverview.bookList.push(book)
                this.bookOverview.initTable()
            }
        )
    }

    createBookDialog(bookId, imageDB) {
        let title, book, oldBookId
        const bookImageDB = {db: {}}

        if (bookId === 0) {
            title = gettext("Create Book")
            book = {
                title: "",
                id: 0,
                chapters: [],
                is_owner: true,
                owner: this.bookOverview.user,
                rights: "write",
                metadata: emptyMetadata(),
                settings: {
                    bibliography_header: gettext("Bibliography"),
                    citationstyle: "apa",
                    book_style: this.bookOverview.styles[0] ? this.bookOverview.styles[0].slug : false,
                    papersize: "octavo",
                    language: "en-US"

                }
            }
        } else {
            const oldBook = this.bookOverview.bookList.find(book => book.id === bookId)
            book = Object.assign({}, oldBook)
            book.metadata = Object.assign(emptyMetadata(), oldBook.metadata)
            oldBookId = oldBook.id

            if (book.cover_image && !imageDB.db[book.cover_image]) {
                // The cover image is not in the current user's image DB --
                // it was either deleted or another user originally added
                // it. As we don't do anything fancy with it, we simply add
                // the current cover image to the DB locally so that image
                // selection works as expected.
                bookImageDB.db[book.cover_image] = book.cover_image_data
            }
            title = gettext("Edit Book")
        }
        const body = bookDialogTemplate({
            title,
            dialogParts: this.dialogParts,
            bookInfo: {
                book,
                documentList: this.bookOverview.documentList,
                citationStyles: this.bookOverview.citationStyles,
                bookStyleList: this.bookOverview.styles,
                imageDB: {db: Object.assign({}, imageDB.db, bookImageDB.db)}
            }
        })

        const buttons = []
        buttons.push({
            text: gettext("Export"),
            dropdown: true,
            classes: "fw-dark",
            click: event => {
                const contentMenu = new ContentMenu({
                    page: {
                        saveBook: () => this.saveBook(book, oldBookId),
                        book,
                        overview: this.bookOverview
                    },
                    menu: this.exportMenu,
                    menuPos: {X: event.pageX, Y: event.pageY},
                    width: 250
                })
                return contentMenu.open()
            }
        })
        if (book.rights === "write") {
            buttons.push({
                text: gettext("Submit"),
                classes: "fw-dark",
                click: () => {
                    return this.saveBook(book, oldBookId).then(
                        () => dialog.close()
                    )
                }
            })
            buttons.push({type: "cancel"})
        } else {
            buttons.push({type: "close"})
        }

        const dialog = new Dialog({
            width: 840,
            height: 520,
            title,
            body,
            buttons
        })
        dialog.open()

        // Hide all but first tab
        dialog.dialogEl.querySelectorAll("#bookoptions-tab .tab-content").forEach((el, index) => {
            if (index) {
                el.style.display = "none"
            }
        })
        let fileSelector
        if (book.rights === "write") {
            fileSelector = new FileSelector({
                dom: dialog.dialogEl.querySelector("#book-document-list"),
                files: this.bookOverview.documentList,
                multiSelect: true,
                selectFolders: false,
            })
            fileSelector.init()
        }

        // Handle tab link clicking
        dialog.dialogEl.querySelectorAll("#bookoptions-tab .tab-link a").forEach(el => el.addEventListener("click", event => {
            event.preventDefault()

            el.parentNode.parentNode.querySelectorAll(".tab-link.current-tab").forEach(el => el.classList.remove("current-tab"))
            el.parentNode.classList.add("current-tab")

            const link = el.getAttribute("href")
            dialog.dialogEl.querySelectorAll("#bookoptions-tab .tab-content").forEach(el => {
                if (el.matches(link)) {
                    el.style.display = ""
                } else {
                    el.style.display = "none"
                }
            })

        }))

        dialog.dialogEl.addEventListener("click", event => {
            const el = {}
            let chapterId, chapter
            switch (true) {
            case findTarget(event, ".book-sort-up", el): {
                chapterId = parseInt(el.target.dataset.id)
                chapter = book.chapters.find(
                    chapter => chapter.text === chapterId
                )

                const higherChapter = book.chapters.find(
                    bChapter => bChapter.number === (chapter.number - 1)
                )
                chapter.number--
                higherChapter.number++
                document.getElementById("book-chapter-list").innerHTML =
                        bookChapterListTemplate({
                            book,
                            documentList: this.bookOverview.documentList
                        })
                break
            }
            case findTarget(event, ".book-sort-down", el): {
                chapterId = parseInt(el.target.dataset.id)
                chapter = book.chapters.find(
                    chapter => chapter.text === chapterId
                )

                const lowerChapter = book.chapters.find(
                    bChapter => bChapter.number === (chapter.number + 1)
                )

                chapter.number++
                lowerChapter.number--
                document.getElementById("book-chapter-list").innerHTML =
                        bookChapterListTemplate({
                            book,
                            documentList: this.bookOverview.documentList
                        })
                break
            }
            case findTarget(event, ".delete-chapter", el):
                chapterId = parseInt(el.target.dataset.id)
                chapter = book.chapters.find(
                    chapter => chapter.text === chapterId
                )

                book.chapters.forEach(bChapter => {
                    if (bChapter.number > chapter.number) {
                        bChapter.number--
                    }
                })

                book.chapters = book.chapters.filter(bChapter => bChapter !== chapter)

                document.getElementById("book-chapter-list").innerHTML = bookChapterListTemplate({
                    book,
                    documentList: this.bookOverview.documentList
                })

                break
            case findTarget(event, "#add-chapter", el): {
                fileSelector.selected.forEach(entry => {
                    const chapNums = book.chapters.map(chapter => chapter.number),
                        number = chapNums.length ?
                            Math.max(...chapNums) + 1 :
                            1
                    book.chapters.push({
                        text: entry.file.id,
                        number,
                        part: ""
                    })
                })
                fileSelector.deselectAll()

                document.getElementById("book-chapter-list").innerHTML = bookChapterListTemplate({
                    book,
                    documentList: this.bookOverview.documentList
                })
                break
            }
            case findTarget(event, ".edit-chapter", el):
                chapterId = parseInt(el.target.dataset.id)
                chapter = book.chapters.find(
                    chapter => chapter.text === chapterId
                )
                this.editChapterDialog(chapter, book)
                break
            case findTarget(event, "#select-cover-image-button", el): {
                const imageSelection = new ImageSelectionDialog(
                    bookImageDB,
                    imageDB,
                    book.cover_image,
                    this.bookOverview
                )

                imageSelection.init().then(
                    image => {
                        if (!image) {
                            delete book.cover_image
                        } else {
                            book.cover_image = image.id
                            book.cover_image_data = image.db === "user" ?
                                imageDB.db[image.id] : bookImageDB.db[image.id]
                        }
                        document.getElementById("figure-preview-row").innerHTML = bookEpubDataCoverTemplate({
                            imageDB: {db: Object.assign({}, imageDB.db, bookImageDB.db)},
                            book
                        })
                    }
                )
                break
            }
            case findTarget(event, "#remove-cover-image-button", el):
                delete book.cover_image
                document.getElementById("figure-preview-row").innerHTML = bookEpubDataCoverTemplate({
                    book,
                    imageDB: {db: {}} // We just deleted the cover image, so we don't need a full DB
                })
                break
            case findTarget(event, "#perform-sanity-check-button", el): {
                this.saveBook(book, oldBookId).then(
                    () => bookSanityCheck(book, this.bookOverview.documentList, this.bookOverview.schema)
                ).then(
                    sanityCheckOutputHTML => document.getElementById("sanity-check-output").innerHTML = sanityCheckOutputHTML
                )
                break
            }
            default:
                break
            }
        })

        dialog.dialogEl.querySelector("#book-settings-citationstyle").addEventListener("change", event => {
            book.settings.citationstyle = event.target.value
        })

        dialog.dialogEl.querySelector("#book-settings-bookstyle").addEventListener("change", event => {
            book.settings.book_style = event.target.value
        })

        dialog.dialogEl.querySelector("#book-settings-papersize").addEventListener("change", event => {
            book.settings.papersize = event.target.value
        })
    }
}
