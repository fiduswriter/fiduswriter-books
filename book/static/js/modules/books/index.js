import {DataTable} from "simple-datatables"

import {BookActions} from "./actions"
import {BookAccessRightsDialog} from "./accessrights"
import {ImageDB} from "../images/database"
import {OverviewMenuView, escapeText, findTarget, whenReady, postJson, activateWait, deactivateWait, addAlert, baseBodyTemplate, ensureCSS, setDocTitle} from "../common"
import {SiteMenu} from "../menu"
import {menuModel} from "./menu"
import {FeedbackTab} from "../feedback"
import {
    docSchema
} from "../schema/document"

export class BookOverview {
    // A class that contains everything that happens on the books page.
    // It is currently not possible to initialize more than one such class, as it
    // contains bindings to menu items, etc. that are uniquely defined.
    constructor({app, user, staticUrl}) {
        this.app = app
        this.user = user
        this.staticUrl = staticUrl
        this.schema = docSchema
        this.mod = {}
        this.bookList = []
        this.styles = false
        this.documentList = []
        this.teamMembers = []
        this.accessRights = []
    }

    init() {
        whenReady().then(() => {
            this.render()
            const smenu = new SiteMenu("books")
            smenu.init()
            new BookActions(this)
            this.menu = new OverviewMenuView(this, menuModel)
            this.menu.init()
            this.bind()
            this.getBookListData()
        })
    }

    render() {
        document.body = document.createElement('body')
        document.body.innerHTML = baseBodyTemplate({
            contents: '<ul id="fw-overview-menu"></ul>',
            username: this.user.username,
            staticUrl: this.staticUrl
        })
        ensureCSS([
            'add_remove_dialog.css',
            'access_rights_dialog.css',
            'book.css'
        ], this.staticUrl)
        setDocTitle(gettext('Book Overview'))
        const feedbackTab = new FeedbackTab({staticUrl: this.staticUrl})
        feedbackTab.init()
    }

    getImageDB() {
        if (!this.imageDB) {
            const imageGetter = new ImageDB()
            return new Promise(resolve => {
                imageGetter.getDB().then(
                    () => {
                        this.imageDB = imageGetter
                        resolve()
                    }
                )
            })
        } else {
            return Promise.resolve()
        }
    }

    /* Initialize the overview table */
    initTable() {
        const tableEl = document.createElement('table')
        tableEl.classList.add('fw-document-table')
        tableEl.classList.add('fw-large')
        document.querySelector('.fw-contents').appendChild(tableEl)
        this.table = new DataTable(tableEl, {
            searchable: true,
            paging: false,
            scrollY: "calc(100vh - 320px)",
            labels: {
                noRows: gettext("No books available") // Message shown when there are no search results
            },
            layout: {
                top: ""
            },
            data: {
                headings: ['', '&emsp;&emsp;', gettext("Title"), gettext("Created"), gettext("Last changed"), gettext("Owner"), gettext("Rights"), ''],
                data: this.bookList.map(book => this.createTableRow(book))
            },
            columns: [
                {
                    select: 0,
                    hidden: true
                },
                {
                    select: [1, 6, 7],
                    sortable: false
                }
            ]
        })
        this.lastSort = {column: 0, dir: 'asc'}

        this.table.on('datatable.sort', (column, dir) => {
            this.lastSort = {column, dir}
        })
    }

    createTableRow(book) {
        return [
            String(book.id),
            `<input type="checkbox" class="entry-select" data-id="${book.id}">`,
            `<span class="fw-document-table-title fw-inline">
                <i class="fa fa-book"></i>
                <span class="book-title fw-link-text fw-searchable"
                        data-id="${book.id}">
                    ${
                        book.title.length ?
                        escapeText(book.title) :
                        gettext('Untitled')
                    }
                </span>
            </span>`,
            book.added, // format?
            book.updated, // format ?
            `<span>
                <img class="fw-avatar" src="${book.owner_avatar}" />
            </span>
            <span class="fw-inline fw-searchable">${escapeText(book.owner_name)}</span>`,
            `<span class="${this.user.id === book.owner ? 'owned-by-user ' : ''}rights fw-inline" data-id="${book.id}">
                <i data-id="${book.id}" class="icon-access-right icon-access-${book.rights}"></i>
            </span>`,
            `<span class="delete-book fw-inline fw-link-text" data-id="${book.id}" data-title="${escapeText(book.title)}">
                ${this.user.id === book.owner ? '<i class="fa fa-trash-o"></i>' : ''}
           </span>`
        ]
    }

    removeTableRows(ids) {
        const existingRows = this.table.data.map((data, index) => {
            const id = parseInt(data.cells[0].textContent)
            if (ids.includes(id)) {
                return index
            } else {
                return false
            }
        }).filter(rowIndex => rowIndex !== false)

        if (existingRows.length) {
            this.table.rows().remove(existingRows)
        }
    }

    addBookToTable(book) {
        this.table.insert({data: [this.createTableRow(book)]})
        // Redo last sort
        this.table.columns().sort(this.lastSort.column, this.lastSort.dir)
    }

    getBookListData() {
        activateWait()
        postJson(
            '/book/booklist/'
        ).catch(
            error => {
                addAlert('error', gettext('Cannot load data of books.'))
                throw (error)
            }
        ).then(
            ({json}) => {
                this.bookList = this.unpackBooks(json.books)
                this.documentList = json.documents
                this.teamMembers = json.team_members
                this.accessRights = json.access_rights
                this.styles = json.styles
                this.initTable()
            }
        ).then(
            () => deactivateWait()
        )
    }

    unpackBooks(booksFromServer) {
        // metadata and settings are stored as a json stirng in a text field on
        // the server, so they need to be unpacked before being available.
        return booksFromServer.map(book => {
            const uBook = Object.assign({}, book)
            uBook.metadata = JSON.parse(book.metadata)
            uBook.settings = JSON.parse(book.settings)
            return uBook
        })
    }

    bind() {
        document.body.addEventListener('click', event => {
            const el = {}
            let bookId
            switch (true) {
                case findTarget(event, '.delete-book', el):
                    bookId = parseInt(el.target.dataset.id)
                    this.mod.actions.deleteBookDialog([bookId])
                    break
                case findTarget(event, '.owned-by-user.rights', el): {
                    bookId = parseInt(el.target.dataset.id)
                    const accessDialog = new BookAccessRightsDialog(
                        [bookId],
                        this.teamMembers,
                        this.accessRights
                    )
                    accessDialog.init().then(
                        accessRights => this.accessRights = accessRights
                    )
                    break
                }
                case findTarget(event, '.book-title', el):
                    bookId = parseInt(el.target.dataset.id)
                    this.getImageDB().then(() => {
                        this.mod.actions.createBookDialog(bookId, this.imageDB)
                    })
                    break
                case findTarget(event, 'a', el):
                    if (el.target.hostname === window.location.hostname && el.target.getAttribute('href')[0] === '/') {
                        event.preventDefault()
                        this.app.goTo(el.target.href)
                    }
                    break
                default:
                    break
            }
        })
    }

    getSelected() {
        return Array.from(
            document.querySelectorAll('.entry-select:checked:not(:disabled)')
        ).map(el => parseInt(el.getAttribute('data-id')))
    }
}
