import {bookListTemplate,
    bookDialogTemplate,
    bookChapterListTemplate, bookDocumentListTemplate, bookChapterDialogTemplate,
    bookEpubDataCoverTemplate
  } from "./templates"
import {ImageDB} from "../images/database"
import {ImageSelectionDialog} from "../images/selection_dialog"
import {deactivateWait, addAlert, csrfToken, postJson, post, Dialog, findTarget} from "../common"


export class BookActions {

    constructor(bookOverview) {
        bookOverview.mod.actions = this
        this.bookOverview = bookOverview
    }

    deleteBook(id) {
        let book = this.bookOverview.bookList.find(book => book.id === id)
        if (!book) {
            return
        }

        post(
            '/book/delete/',
            {id}
        ).catch(
            error => {
                addAlert('error', gettext(`${gettext('Could not delete book')}: '${book.title}'`))
                throw(error)
            }
        ).then(()=> {
            addAlert('success', gettext(`${gettext('Book has been deleted')}: '${book.title}'`))
            this.bookOverview.removeTableRows([id])
            this.bookOverview.bookList = this.bookOverview.bookList.filter(book => book.id !== id)
        })

    }

    deleteBookDialog(ids) {
        let dialog
        let buttons = [
            {
                text: gettext('Delete'),
                classes: "fw-dark",
                click: () => {
                    ids.forEach(id => this.deleteBook(parseInt(id)))
                    addAlert('success', gettext('The book(s) have been deleted'))
                    dialog.close()
                }
            },
            {
                type: 'close'
            }
        ]

        dialog = new Dialog({
            title: gettext('Confirm deletion'),
            id: 'confirmdeletion',
            icon: 'exclamation-triangle',
            body: `<p>${gettext('Delete the book(s)?')}</p>`,
            buttons
        })
        dialog.open()
    }


    editChapterDialog(chapter, book) {
        let doc = this.bookOverview.documentList.find(doc => doc.id === chapter.text),
            docTitle = doc.title
        if (!docTitle.length) {
            docTitle = gettext('Untitled')
        }

        let dialog

        let buttons = [
            {
                text: gettext('Submit'),
                classes: "fw-dark",
                click: () => {
                    chapter.part = document.getElementById('book-chapter-part').value
                    document.getElementById('book-chapter-list').innerHTML =
                        bookChapterListTemplate({
                            book,
                            documentList: this.bookOverview.documentList
                        })
                    dialog.close()
                }
            },
            {
                type: 'cancel'
            }
        ]

        dialog = new Dialog({
            title: `${gettext('Edit Chapter')}: ${chapter.number}. ${docTitle}`,
            body: bookChapterDialogTemplate({chapter}),
            width: 300,
            height: 100,
        })
        dialog.open()
    }


    saveBook(book, oldBook = false) {

        let bookData = Object.assign({}, book)
        delete bookData.cover_image_data


        return postJson(
            '/book/save/',
            {book: JSON.stringify(bookData)}
        ).catch(
            error => {
                addAlert('error', gettext('The book could not be saved'))
                throw(error)
            }
        ).then(
            ({status, json}) => {
                if (status == 201) {
                    book.id = json.id
                    book.added = json.added
                }
                book.updated = json.updated
                if (oldBook) {
                    this.bookOverview.bookList = this.bookOverview.bookList.filter(
                        book => book !== oldBook
                    )
                }
                this.bookOverview.bookList.push(book)
                if (oldBook) {
                    this.bookOverview.removeTableRows([oldBook.id])
                }
                this.bookOverview.addBookToTable(book)
            }
        )
    }

    copyBook(oldBook) {
        let book = Object.assign({}, oldBook)
        book.is_owner = true
        book.owner_avatar = this.bookOverview.user.avatar
        book.owner_name = this.bookOverview.user.name
        book.owner = this.bookOverview.user.id
        book.rights = 'write'
        return postJson(
            '/book/copy/',
            {book_id: book.id}
        ).catch(
            error => {
                addAlert('error', gettext('The book could not be copied'))
                throw(error)
            }
        ).then(
            ({json}) => {
                book.id = json['new_book_id']
                this.bookOverview.bookList.push(book)
                this.bookOverview.addBookToTable(book)
            }
        )
    }

    createBookDialog(bookId, imageDB) {
        let title, book, oldBook, bookImageDB = {db:{}}, dialog

        if (bookId === 0) {
            title = gettext('Create Book')
            book = {
                title: '',
                id: 0,
                chapters: [],
                is_owner: true,
                owner_avatar: this.bookOverview.user.avatar,
                owner_name: this.bookOverview.user.name,
                owner: this.bookOverview.user.id,
                rights: 'write',
                metadata: {
                    author: '',
                    subtitle: '',
                    publisher: '',
                    copyright: '',
                    keywords: ''
                },
                settings: {
                    citationstyle: this.bookOverview.styles.citation_styles[0],
                    documentstyle: this.bookOverview.styles.document_styles[0],
                    papersize: 'octavo'
                }
            }
        } else {
            oldBook = this.bookOverview.bookList.find(book => book.id===bookId)
            book = Object.assign({}, oldBook)

            if (book.cover_image && !imageDB.db[book.cover_image]) {
                // The cover image is not in the current user's image DB --
                // it was either deleted or another user originally added
                // it. As we don't do anything fancy with it, we simply add
                // the current cover image to the DB locally so that image
                // selection works as expected.
                bookImageDB.db[book.cover_image] = book.cover_image_data
            }
            title = gettext('Edit Book')
        }

        let body = bookDialogTemplate({
            book,
            documentList: this.bookOverview.documentList,
            citationDefinitions: this.bookOverview.styles.citation_styles,
            documentStyleList: this.bookOverview.styles.document_styles,
            imageDB: {db: Object.assign({}, imageDB.db, bookImageDB.db)}
        })

        let buttons = []
        if (book.rights === 'write') {
            buttons.push({
                text: gettext('Submit'),
                classes: "fw-dark",
                click: () => {
                    book.title = document.getElementById('book-title').value
                    book.metadata.author = document.getElementById('book-metadata-author').value
                    book.metadata.subtitle = document.getElementById('book-metadata-subtitle').value
                    book.metadata.copyright = document.getElementById('book-metadata-copyright').value
                    book.metadata.publisher = document.getElementById('book-metadata-publisher').value
                    book.metadata.keywords = document.getElementById('book-metadata-keywords').value
                    this.saveBook(book, oldBook).then(
                        () => dialog.close()
                    )
                }
            })
            buttons.push({type: 'cancel'})
        } else {
            buttons.push({type: 'close'})
        }

        dialog = new Dialog({
            width: 840,
            height: 460,
            title,
            body,
            buttons
        })
        dialog.open()

        // Hide all but first tab
        dialog.dialogEl.querySelectorAll('#bookoptions-tab .tab-content').forEach((el, index) => {
            if (index) {
                el.style.display = 'none'
            }
        })

        // Handle tab link clicking
        dialog.dialogEl.querySelectorAll('#bookoptions-tab .tab-link a').forEach(el => el.addEventListener('click', event => {
            event.preventDefault()
            let link = el.getAttribute('href')
            dialog.dialogEl.querySelectorAll('#bookoptions-tab .tab-content').forEach(el => {
                if (el.matches(link)) {
                    el.style.display = ''
                } else {
                    el.style.display = 'none'
                }
            })

        }))
        this.bindBookDialog(dialog, book, imageDB, bookImageDB)
    }

    bindBookDialog(dialog, book, imageDB, bookImageDB) {
        dialog.dialogEl.addEventListener('click', event => {
            let el = {}, chapterId, chapter
            switch (true) {
                case findTarget(event, '.book-sort-up', el):
                    chapterId = parseInt(el.target.dataset.id)
                    chapter = book.chapters.find(
                        chapter => chapter.text === chapterId
                    )

                    let higherChapter = book.chapters.find(
                        bChapter => bChapter.number === (chapter.number - 1)
                    )

                    chapter.number--
                    higherChapter.number++
                    document.getElementById('book-chapter-list').innerHTML =
                        bookChapterListTemplate({
                            book,
                            documentList: this.bookOverview.documentList
                        })
                    break
                case findTarget(event, '.book-sort-down', el):
                    chapterId = parseInt(el.target.dataset.id)
                    chapter = book.chapters.find(
                        chapter => chapter.text === chapterId
                    )

                    let lowerChapter = book.chapters.find(
                        bChapter => bChapter.number === (chapter.number + 1)
                    )

                    chapter.number++
                    lowerChapter.number--
                    document.getElementById('book-chapter-list').innerHTML =
                        bookChapterListTemplate({
                            book,
                            documentList: this.bookOverview.documentList
                        })
                    break
                case findTarget(event, '.delete-chapter', el):
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

                    document.getElementById('book-chapter-list').innerHTML = bookChapterListTemplate({
                        book,
                        documentList: this.bookOverview.documentList
                    })

                    document.getElementById('book-document-list').innerHTML = bookDocumentListTemplate({
                        documentList: this.bookOverview.documentList,
                        book
                    })
                    break
                case findTarget(event, '#book-document-list td', el):
                    el.target.classList.toggle('checked')
                    break
                case findTarget(event, '#add-chapter', el):
                    document.querySelectorAll('#book-document-list td.checked').forEach(el =>{
                        let documentId = parseInt(el.dataset.id),
                            chapNums = book.chapters.map(chapter => chapter.number),
                            number = chapNums.length ?
                                Math.max.apply(Math, chapNums) + 1:
                                1
                        book.chapters.push({
                            text: documentId,
                            title: el.textContent.trim(),
                            number,
                            part: ''
                        })
                    })

                    document.getElementById('book-chapter-list').innerHTML = bookChapterListTemplate({
                            book,
                            documentList: this.bookOverview.documentList
                        })
                    document.getElementById('book-document-list').innerHTML = bookDocumentListTemplate({
                            documentList: this.bookOverview.documentList,
                            book
                        })
                    break
                case findTarget(event, '.edit-chapter', el):
                    chapterId = parseInt(el.target.dataset.id)
                    chapter = book.chapters.find(
                        chapter => chapter.text === chapterId
                    )
                    this.editChapterDialog(chapter, book)
                    break
                case findTarget(event, '#select-cover-image-button', el):
                    let imageSelection = new ImageSelectionDialog(
                        bookImageDB,
                        imageDB,
                        book.cover_image,
                        book.owner)

                    imageSelection.init().then(
                        image => {
                            if (!image) {
                                delete book.cover_image
                            } else {
                                book.cover_image = image.id
                                book.cover_image_data = image.db === 'user' ?
                                    imageDB.db[image.id] : bookImageDB.db[image.id]
                            }
                            document.getElementById('figure-preview-row').innerHTML = bookEpubDataCoverTemplate({
                                    imageDB: {db: Object.assign({}, imageDB.db, bookImageDB.db)},
                                    book
                                })
                        }
                    )
                    break
                case findTarget(event, '#remove-cover-image-button', el):
                    delete book.cover_image
                    document.getElementById('figure-preview-row').innerHTML = bookEpubDataCoverTemplate({
                            book,
                            imageDB: {db: {}} // We just deleted the cover image, so we don't need a full DB
                        })
                    break
                default:
                    break
            }
        })

        dialog.dialogEl.querySelector('#book-settings-citationstyle').addEventListener('change', event => {
            book.settings.citationstyle = event.target.value
        })

        dialog.dialogEl.querySelector('#book-settings-documentstyle').addEventListener('change', event => {
            book.settings.documentstyle = event.target.value
        })

        dialog.dialogEl.querySelector('#book-settings-papersize').addEventListener('change', event => {
            book.settings.papersize = event.target.value
        })
    }
}
