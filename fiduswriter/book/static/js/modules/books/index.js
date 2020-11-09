import {DataTable} from "simple-datatables"

import * as plugins from "../../plugins/books_overview"
import {BookActions} from "./actions"
import {BookAccessRightsDialog} from "./accessrights"
import {ImageDB} from "../images/database"
import {OverviewMenuView, escapeText, findTarget, whenReady, postJson, activateWait, deactivateWait, addAlert, baseBodyTemplate, ensureCSS, setDocTitle, DatatableBulk, localizeDate} from "../common"
import {SiteMenu} from "../menu"
import {menuModel, bulkMenuModel} from "./menu"
import {FeedbackTab} from "../feedback"
import {
    docSchema
} from "../schema/document"

export class BookOverview {
    // A class that contains everything that happens on the books page.
    // It is currently not possible to initialize more than one such class, as it
    // contains bindings to menu items, etc. that are uniquely defined.
    constructor({app, user}) {
        this.app = app
        this.user = user
        this.schema = docSchema
        this.mod = {}
        this.bookList = []
        this.styles = false
        this.documentList = []
        this.teamMembers = []
        this.accessRights = []
        this.citationStyles = []
    }

    init() {
        if (this.app.isOffline()) {
            return whenReady().then(() => this.showCached())
        }
        return this.app.csl.getStyles().then(
            styles => {
                this.citationStyles = styles
                return whenReady()
            }
        ).then(
            () => {
                this.render()
                const smenu = new SiteMenu(this.app, "books")
                smenu.init()
                new BookActions(this)
                this.menu = new OverviewMenuView(this, menuModel)
                this.menu.init()
                this.dtBulkModel = bulkMenuModel()
                this.activateFidusPlugins()
                this.bind()
                return this.getBookListData()
            }
        )
    }

    showCached() {
        // We only show an empty page with a warning for now
        // TODO: implement actual caching
        this.render()
        const smenu = new SiteMenu("books")
        smenu.init()
        new BookActions(this)
        this.menu = new OverviewMenuView(this, menuModel)
        this.menu.init()
        this.dtBulkModel = bulkMenuModel()
        this.activateFidusPlugins()
        this.bind()
        this.initTable()
        deactivateWait()
    }

    activateFidusPlugins() {
        // Add plugins.
        this.plugins = {}

        Object.keys(plugins).forEach(plugin => {
            if (typeof plugins[plugin] === 'function') {
                this.plugins[plugin] = new plugins[plugin](this)
                this.plugins[plugin].init()
            }
        })
    }

    render() {
        this.dom = document.createElement('body')
        this.dom.innerHTML = baseBodyTemplate({
            contents: '',
            user: this.user,
            hasOverview: true
        })
        document.body = this.dom
        ensureCSS([
            'add_remove_dialog.css',
            'access_rights_dialog.css',
            'book.css'
        ])
        setDocTitle(gettext('Book Overview'), this.app)
        const feedbackTab = new FeedbackTab()
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

    onResize() {
        if (!this.table) {
            return
        }
        this.initTable()
    }

    /* Initialize the overview table */
    initTable() {
        const tableEl = document.createElement('table')
        tableEl.classList.add('fw-data-table')
        tableEl.classList.add('fw-large')
        this.dom.querySelector('.fw-contents').innerHTML = ''
        this.dom.querySelector('.fw-contents').appendChild(tableEl)

        this.dtBulk = new DatatableBulk(this, this.dtBulkModel)

        const hiddenCols = [0]

        if (window.innerWidth < 500) {
            hiddenCols.push(1)
            if (window.innerWidth < 400) {
                hiddenCols.push(3)
            }
        }

        this.table = new DataTable(tableEl, {
            searchable: true,
            paging: false,
            scrollY: `${Math.max(window.innerHeight - 360, 100)}px`,
            labels: {
                noRows: gettext("No books available") // Message shown when there are no search results
            },
            layout: {
                top: ""
            },
            data: {
                headings: ['', this.dtBulk.getHTML(), gettext("Title"), gettext("Created"), gettext("Last changed"), gettext("Owner"), gettext("Rights"), ''],
                data: this.bookList.map(book => this.createTableRow(book))
            },
            columns: [
                {
                    select: hiddenCols,
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

        this.dtBulk.init(this.table.table)
    }

    createTableRow(book) {
        return [
            String(book.id),
            `<input type="checkbox" class="entry-select fw-check" data-id="${book.id}" id="book-${book.id}"><label for="book-${book.id}"></label>`,
            `<span class="fw-data-table-title fw-inline">
                <i class="fas fa-book"></i>
                <span class="book-title fw-link-text fw-searchable"
                        data-id="${book.id}">
                    ${
    book.title.length ?
        escapeText(book.title) :
        gettext('Untitled')
}
                </span>
            </span>`,
            `<span class="date">${localizeDate(book.added * 1000, 'sortable-date')}</span>`,
            `<span class="date">${localizeDate(book.updated * 1000, 'sortable-date')}</span>`,
            `<span>
                <img class="fw-avatar" src="${book.owner_avatar}" />
            </span>
            <span class="fw-inline fw-searchable">${escapeText(book.owner_name)}</span>`,
            `<span class="${this.user.id === book.owner ? 'owned-by-user ' : ''}rights fw-inline" data-id="${book.id}">
                <i data-id="${book.id}" class="icon-access-right icon-access-${book.rights}"></i>
            </span>`,
            `<span class="delete-book fw-inline fw-link-text" data-id="${book.id}" data-title="${escapeText(book.title)}">
                ${this.user.id === book.owner ? '<i class="fas fa-trash-alt"></i>' : ''}
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
        if (this.app.isOffline()) {
            return this.showCached()
        }
        activateWait()
        return postJson(
            '/api/book/list/'
        ).catch(
            error => {
                if (this.app.isOffline()) {
                    return this.showCached()
                } else {
                    addAlert('error', gettext('Cannot load data of books.'))
                    throw (error)
                }
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
        this.dom.addEventListener('click', event => {
            const el = {}
            switch (true) {
            case findTarget(event, '.delete-book', el): {
                const bookId = parseInt(el.target.dataset.id)
                this.mod.actions.deleteBookDialog([bookId])
                break
            }
            case findTarget(event, '.owned-by-user.rights', el): {
                const bookId = parseInt(el.target.dataset.id)
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
            case findTarget(event, '.book-title', el): {
                const bookId = parseInt(el.target.dataset.id)
                this.getImageDB().then(() => {
                    this.mod.actions.createBookDialog(bookId, this.imageDB)
                })
                break
            }
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
            this.dom.querySelectorAll('.entry-select:checked:not(:disabled)')
        ).map(el => parseInt(el.getAttribute('data-id')))
    }
}
