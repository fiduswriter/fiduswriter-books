import {bookListTemplate,
    bookDialogTemplate,
    bookChapterListTemplate, bookDocumentListTemplate, bookChapterDialogTemplate,
    bookEpubDataCoverTemplate
  } from "./templates"
import {ImageDB} from "../images/database"
import {ImageSelectionDialog} from "../images/selection-dialog"
import {defaultDocumentStyle, documentStyleList} from "../style/documentstyle-list"
import {defaultCitationStyle, citationDefinitions} from "../style/citation-definitions"
import {deactivateWait, addAlert, csrfToken} from "../common"


export class BookActions {

    constructor(bookList) {
        bookList.mod.actions = this
        this.bookList = bookList
    }

    deleteBook(id) {
        let postData = {}
        postData['id'] = id
        jQuery.ajax({
            url: '/book/delete/',
            data: postData,
            type: 'POST',
            dataType: 'json',
            crossDomain: false, // obviates need for sameOrigin test
            beforeSend: (xhr, settings) =>
                xhr.setRequestHeader("X-CSRFToken", csrfToken),
            success: (data, textStatus, jqXHR) => {
                this.stopBookTable()
                jQuery('#Book_' + id).detach()
                this.bookList.bookList = this.bookList.bookList.filter(book => book.id !== id)
                this.startBookTable()
            },
        })
    }

    stopBookTable() {
        jQuery('#book-table').dataTable().fnDestroy()
    }

    startBookTable() {
        // The sortable table seems not to have an option to accept new data added to the DOM. Instead we destroy and recreate it.
        jQuery('#book-table').dataTable({
            "bPaginate": false,
            "bLengthChange": false,
            "bFilter": true,
            "bInfo": false,
            "bAutoWidth": false,
            "oLanguage": {
                "sSearch": ''
            },
            "aoColumnDefs": [{
                "bSortable": false,
                "aTargets": [0, 5, 6]
            }],
        })

        jQuery('#book-table_filter input').attr('placeholder', gettext('Search for Book Title'))
        jQuery('#book-table_filter input').unbind('focus, blur')
        jQuery('#book-table_filter input').bind('focus', function() {
            jQuery(this).parent().addClass('focus')
        })
        jQuery('#book-table_filter input').bind('blur', function() {
            jQuery(this).parent().removeClass('focus')
        })

        let autocompleteTags = []
        jQuery('#book-table .fw-searchable').each(function() {
            autocompleteTags.push(this.textContent.replace(/^\s+/g, '').replace(/\s+$/g, ''))
        })
        autocompleteTags = [ ...new Set(autocompleteTags) ] // get unique entries
        jQuery("#book-table_filter input").autocomplete({
            source: autocompleteTags
        })
    }

    deleteBookDialog(ids) {
        let that = this
        jQuery('body').append(
            `<div id="confirmdeletion" title="${
                    gettext('Confirm deletion')
            }">
                <p>
                    <span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;">
                    </span>
                    ${gettext('Delete the book(s)?')}
                </p>
            </div>`
        )
        let buttons = {}
        buttons[gettext('Delete')] = function () {
            ids.forEach(id => that.deleteBook(id))
            jQuery(this).dialog("close")
            addAlert('success', gettext('The book(s) have been deleted'))
        }

        buttons[gettext('Cancel')] = function () {
            jQuery(this).dialog("close")
        }

        jQuery("#confirmdeletion").dialog({
            resizable: false,
            height: 180,
            modal: true,
            close: () => jQuery("#confirmdeletion").detach(),
            buttons,
            create: function () {
                let dialog = jQuery(this).closest(".ui-dialog")
                dialog.find(".ui-button:first-child").addClass(
                    "fw-button fw-dark")
                dialog.find(".ui-button:last").addClass(
                    "fw-button fw-orange")
            },
        })
    }

    unpackBooks(booksFromServer) {
        // metadata and settings are stored as a json stirng in a text field on
        // the server, so they need to be unpacked before being available.
        return booksFromServer.map(book => {
            let uBook = Object.assign({}, book)
            uBook.metadata = JSON.parse(book.metadata)
            uBook.settings = JSON.parse(book.settings)
            return uBook
        })
    }


    getBookListData(id) {
        jQuery.ajax({
            url: '/book/booklist/',
            data: {},
            type: 'POST',
            dataType: 'json',
            crossDomain: false, // obviates need for sameOrigin test
            beforeSend: (xhr, settings) =>
                xhr.setRequestHeader("X-CSRFToken", csrfToken),
            success: (response, textStatus, jqXHR) => {
                this.bookList.bookList = this.unpackBooks(response.books)
                this.bookList.documentList = response.documents
                this.bookList.teamMembers = response.team_members
                this.bookList.accessRights = response.access_rights
                this.bookList.user = response.user
                this.bookList.styles = response.styles
                jQuery.event.trigger({
                    type: "bookDataLoaded",
                })
            },
            error: (jqXHR, textStatus, errorThrown) =>
                addAlert('error', jqXHR.responseText),
            complete: () => deactivateWait()
        })
    }

    editChapterDialog(chapter, book) {
        let doc = this.bookList.documentList.find(doc => doc.id === chapter.text),
            docTitle = doc.title
        if (!docTitle.length) {
            docTitle = gettext('Untitled')
        }
        let dialogHeader = `${gettext('Edit Chapter')}: ${chapter.number}. ${docTitle}`
        let dialogBody = bookChapterDialogTemplate({
            dialogHeader,
            chapter
        })

        jQuery('body').append(dialogBody)
        let diaButtons = {}
        let that = this
        diaButtons[gettext('Submit')] = function () {
            chapter.part = jQuery('#book-chapter-part').val()
            jQuery('#book-chapter-list').html(
                bookChapterListTemplate({
                    book,
                    documentList: that.bookList.documentList
                })
            )
            jQuery(this).dialog('close')
        }
        diaButtons[gettext('Cancel')] = function () {
            jQuery(this).dialog("close")
        }
        jQuery('#book-chapter-dialog').dialog({
            draggable: false,
            resizable: false,
            top: 10,
            width: 300,
            height: 200,
            modal: true,
            buttons: diaButtons,
            create: function () {
                let theDialog = jQuery(this).closest(".ui-dialog")
                theDialog.find(".ui-button:first-child").addClass(
                    "fw-button fw-dark")
                theDialog.find(".ui-button:last").addClass(
                    "fw-button fw-orange")
            },
            close: () =>
                jQuery('#book-chapter-dialog').dialog('destroy').remove()
        })

    }


    saveBook(book, oldBook = false) {

        let bookData = Object.assign({}, book)
        delete bookData.cover_image_data
        return new Promise((resolve, reject) => {
            jQuery.ajax({
                url: '/book/save/',
                data: {
                    book: JSON.stringify(bookData)
                },
                type: 'POST',
                dataType: 'json',
                crossDomain: false, // obviates need for sameOrigin test
                beforeSend: (xhr, settings) =>
                    xhr.setRequestHeader("X-CSRFToken", csrfToken),
                success: (response, textStatus, jqXHR) => {
                    if (jqXHR.status == 201) {
                        book.id = response.id
                        book.added = response.added
                    }
                    book.updated = response.updated
                    if (oldBook) {
                        this.bookList.bookList = this.bookList.bookList.filter(
                            book => book !== oldBook
                        )
                    }
                    this.bookList.bookList.push(book)
                    this.stopBookTable()
                    jQuery('#book-table tbody').html(bookListTemplate({
                        bookList: this.bookList.bookList,
                        user: this.bookList.user
                    }))
                    this.startBookTable()
                    resolve()
                },
                error: (jqXHR, textStatus, errorThrown) => {
                    addAlert('error', jqXHR.responseText)
                    reject()
                },
                complete: () => {}
            })
        })
    }

    copyBook(oldBook) {
        let book = Object.assign({}, oldBook)
        book.is_owner = true
        book.owner_avatar = this.bookList.user.avatar
        book.owner_name = this.bookList.user.name
        book.owner = this.bookList.user.id
        book.rights = 'write'
        return new Promise((resolve, reject) => {
            jQuery.ajax({
                url: '/book/copy/',
                data: {
                    book_id: book.id
                },
                type: 'POST',
                dataType: 'json',
                crossDomain: false, // obviates need for sameOrigin test
                beforeSend: (xhr, settings) =>
                    xhr.setRequestHeader("X-CSRFToken", csrfToken),
                success: (response, textStatus, jqXHR) => {
                    book.id = response['new_book_id']
                    this.bookList.bookList.push(book)
                    this.stopBookTable()
                    jQuery('#book-table tbody').html(bookListTemplate({
                        bookList: this.bookList.bookList,
                        user: this.bookList.user
                    }))
                    this.startBookTable()
                    resolve()
                },
                error: (jqXHR, textStatus, errorThrown) => {
                    addAlert('error', jqXHR.responseText)
                    reject()
                },
                complete: () => {}
            })
        })

    }

    createBookDialog(bookId, imageDB) {
        let dialogHeader, book, oldBook, bookImageDB = {db:{}}

        if (bookId === 0) {
            dialogHeader = gettext('Create Book')
            book = {
                title: '',
                id: 0,
                chapters: [],
                is_owner: true,
                owner_avatar: this.bookList.user.avatar,
                owner_name: this.bookList.user.name,
                owner: this.bookList.user.id,
                rights: 'write',
                metadata: {
                    author: '',
                    subtitle: '',
                    publisher: '',
                    copyright: '',
                    keywords: ''
                },
                settings: {
                    citationstyle: defaultCitationStyle,
                    documentstyle: defaultDocumentStyle,
                    papersize: 'octavo'
                }
            }
        } else {
            oldBook = this.bookList.bookList.find(book => book.id===bookId)
            book = Object.assign({}, oldBook)

            if (book.cover_image && !imageDB.db[book.cover_image]) {
                // The cover image is not in the current user's image DB --
                // it was either deleted or another user originally added
                // it. As we don't do anything fancy with it, we simply add
                // the current cover image to the DB locally so that image
                // selection works as expected.
                bookImageDB.db[book.cover_image] = book.cover_image_data
            }
            dialogHeader = gettext('Edit Book')
        }

        let dialogBody = bookDialogTemplate({
            dialogHeader,
            book,
            documentList: this.bookList.documentList,
            citationDefinitions,
            documentStyleList,
            imageDB: {db: Object.assign({}, imageDB.db, bookImageDB.db)}
        })
        let that = this
        jQuery(document).on('click', '.book-sort-up', function () {
            let chapter = book.chapters.find(
                chapter => chapter.text === parseInt(jQuery(this).attr('data-id'))
            )

            let higherChapter = book.chapters.find(
                bChapter => bChapter.number === (chapter.number - 1)
            )

            chapter.number--
            higherChapter.number++
            jQuery('#book-chapter-list').html(bookChapterListTemplate({
                book,
                documentList: that.bookList.documentList
            }))
        })
        jQuery(document).on('click', '.book-sort-down', function () {
            let chapter = book.chapters.find(
                chapter => chapter.text === parseInt(jQuery(this).attr('data-id'))
            )

            let lowerChapter = book.chapters.find(
                bChapter => bChapter.number === (chapter.number + 1)
            )

            chapter.number++
            lowerChapter.number--
            jQuery('#book-chapter-list').html(bookChapterListTemplate({
                book,
                documentList: that.bookList.documentList
            }))
        })

        jQuery(document).on('click', '.delete-chapter', function () {
            let thisChapter = book.chapters.find(
                chapter => chapter.text === parseInt(jQuery(this).attr('data-id'))
            )

            book.chapters.forEach(chapter => {
                if (chapter.number > thisChapter.number) {
                    chapter.number--
                }
            })

            book.chapters = book.chapters.filter(chapter => chapter !== thisChapter)

            jQuery('#book-chapter-list').html(bookChapterListTemplate({
                book,
                documentList: that.bookList.documentList
            }))
            jQuery('#book-document-list').html(bookDocumentListTemplate({
                documentList: that.bookList.documentList,
                book
            }))
        })

        jQuery(document).on('click', '#book-document-list td', function () {
            jQuery(this).toggleClass('checked')
        })

        jQuery(document).on('click', '#add-chapter', () => {
            jQuery('#book-document-list td.checked').each(function () {
                let documentId = parseInt(jQuery(this).attr(
                    'data-id')),
                    lastChapterNumber = Math.max(
                        book.chapters.map(chapter => chapter.number)
                    )
                if (isNaN(lastChapterNumber)) {
                    lastChapterNumber = 0
                }
                book.chapters.push({
                    text: documentId,
                    title: jQuery.trim(this.textContent),
                    number: lastChapterNumber + 1,
                    part: ''
                })
            })
            jQuery('#book-chapter-list').html(bookChapterListTemplate({
                book,
                documentList: this.bookList.documentList
            }))
            jQuery('#book-document-list').html(bookDocumentListTemplate({
                documentList: this.bookList.documentList,
                book
            }))
        })

        jQuery(document).on('click', '.edit-chapter', function () {
            let thisChapter = book.chapters.find(
                chapter => chapter.text === parseInt(jQuery(this).attr('data-id'))
            )
            that.editChapterDialog(thisChapter, book)
        })


        jQuery(document).on('click', '#select-cover-image-button', () => {
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
                    jQuery('#figure-preview-row').html(bookEpubDataCoverTemplate({
                        imageDB: {db: Object.assign({}, imageDB.db, bookImageDB.db)},
                        book
                    }))
                }
            )
        })

        jQuery(document).on('click', '#remove-cover-image-button', () => {
            delete book.cover_image
            jQuery('#figure-preview-row').html(bookEpubDataCoverTemplate({
                book,
                imageDB: {db: {}} // We just deleted the cover image, so we don't need a full DB
            }))
        })

        function getFormData() {
            book.title = jQuery('#book-title').val()
            book.metadata.author = jQuery('#book-metadata-author').val()
            book.metadata.subtitle = jQuery('#book-metadata-subtitle').val()
            book.metadata.copyright = jQuery('#book-metadata-copyright')
                .val()
            book.metadata.publisher = jQuery('#book-metadata-publisher')
                .val()
            book.metadata.keywords = jQuery('#book-metadata-keywords').val()
        }

        jQuery('body').append(dialogBody)

        jQuery('#book-settings-citationstyle').dropkick({
            change: (value, label) => {
                book.settings.citationstyle = value
            }
        })

        jQuery('#book-settings-documentstyle').dropkick({
            change: (value, label) => {
                book.settings.documentstyle = value
            }
        })

        jQuery('#book-settings-papersize').dropkick({
            change: (value, label) => {
                book.settings.papersize = value
            }
        })
        let diaButtons = {}
        if (book.rights === 'write') {
            diaButtons[gettext('Submit')] = function () {
                getFormData()
                that.saveBook(book, oldBook).then(
                    jQuery(this).dialog('close')
                )
            }
            diaButtons[gettext('Cancel')] = function () {
                jQuery(this).dialog("close")
            }
        } else {
            diaButtons[gettext('Close')] = function () {
                jQuery(this).dialog("close")
            }
        }
        jQuery('#book-dialog').dialog({
            draggable: false,
            resizable: false,
            top: 10,
            width: 820,
            height: 590,
            modal: true,
            buttons: diaButtons,
            create: function () {
                let theDialog = jQuery(this).closest(".ui-dialog")
                theDialog.find(".ui-button:first-child").addClass(
                    "fw-button fw-dark")
                theDialog.find(".ui-button:last").addClass(
                    "fw-button fw-orange")
            },
            close: () => {
                jQuery(document).off('click', '#add-chapter')
                jQuery(document).off('click', '.book-sort-up')
                jQuery(document).off('click', '.book-sort-down')
                jQuery(document).off('click', '#book-document-list td')
                jQuery(document).off('click', '.delete-chapter')
                jQuery(document).off('click', '.edit-chapter')
                jQuery(document).off('click',
                    '#select-cover-image-button')
                jQuery(document).off('click',
                    '#remove-cover-image-button')
                jQuery('#book-dialog').dialog('destroy').remove()
            }
        })

        jQuery('#bookoptionsTab').tabs()
    }
}
