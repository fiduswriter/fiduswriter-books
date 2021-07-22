import {DataTable} from "simple-datatables"
import deepEqual from "fast-deep-equal"

import * as plugins from "../../plugins/books_overview"
import {BookActions} from "./actions"
import {BookAccessRightsDialog} from "./accessrights"
import {ImageDB} from "../images/database"
import {OverviewMenuView, escapeText, findTarget, whenReady, postJson, activateWait, deactivateWait, addAlert, baseBodyTemplate, ensureCSS, setDocTitle, DatatableBulk, shortFileTitle} from "../common"
import {SiteMenu} from "../menu"
import {menuModel, bulkMenuModel} from "./menu"
import {FeedbackTab} from "../feedback"
import {
    docSchema
} from "../schema/document"
import {
    dateCell,
    deleteFolderCell
} from "./templates"

export class BookOverview {
    // A class that contains everything that happens on the books page.
    // It is currently not possible to initialize more than one such class,
    // as it contains bindings to menu items, etc. that are uniquely defined.
    constructor({app, user}, path = '/') {
        this.app = app
        this.user = user
        this.path = path
        this.schema = docSchema
        this.mod = {}
        this.bookList = []
        this.styles = false
        this.documentList = []
        this.contacts = []
        this.citationStyles = []
        this.lastSort = {column: 0, dir: 'asc'}
    }

    init() {
        return whenReady().then(() => {
            this.render()
            const smenu = new SiteMenu(this.app, "books")
            smenu.init()
            new BookActions(this)
            this.menu = new OverviewMenuView(this, menuModel)
            this.menu.init()
            this.dtBulkModel = bulkMenuModel()
            this.activateFidusPlugins()
            this.bind()
            return this.getBookListData().then(
                () => this.app.csl.getStyles().then(
                    styles => {
                        this.citationStyles = styles
                        return deactivateWait()
                    }
                )
            )
        })
    }

    showCached() {
        return this.loaddatafromIndexedDB().then(json => {
            if (!json) {
                activateWait(true)
                return
            }
            return this.initializeView(json)
        })
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
        ensureCSS([
            'add_remove_dialog.css',
            'access_rights_dialog.css',
            'book.css'
        ])
        this.dom = document.createElement('body')
        this.dom.innerHTML = baseBodyTemplate({
            contents: '',
            user: this.user,
            hasOverview: true
        })
        document.body = this.dom

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
    initTable(searching = false) {
        if (this.table) {
            this.table.destroy()
            this.table = false
        }
        const subdirs = {}
        const tableEl = document.createElement('table')
        tableEl.classList.add('fw-data-table')
        tableEl.classList.add('fw-large')
        const contentsEl = document.querySelector('.fw-contents')
        contentsEl.innerHTML = ''
        contentsEl.appendChild(tableEl)

        if (this.path !== '/') {
            const headerEl = document.createElement('h1')
            headerEl.innerHTML = escapeText(this.path)
            contentsEl.insertBefore(headerEl, tableEl)
        }

        this.dtBulk = new DatatableBulk(this, this.dtBulkModel)

        const hiddenCols = [0, 1]

        if (window.innerWidth < 500) {
            hiddenCols.push(2)
            if (window.innerWidth < 400) {
                hiddenCols.push(4)
            }
        }

        const fileList = this.bookList.map(
            book => this.createTableRow(book, subdirs, searching)
        ).filter(row => !!row)

        if (!searching && this.path !== '/') {
            const pathParts = this.path.split('/')
            pathParts.pop()
            pathParts.pop()
            const parentPath = pathParts.join('/') + '/'
            fileList.unshift([
                '-1',
                'top',
                '',
                `<a class="fw-data-table-title fw-link-text parentdir" href="/books${parentPath}" data-path="${parentPath}">
                    <i class="fas fa-folder"></i>
                    <span>..</span>
                </a>`,
                '',
                '',
                '',
                '',
                ''
            ])
        }

        this.table = new DataTable(tableEl, {
            searchable: searching,
            paging: false,
            scrollY: `${Math.max(window.innerHeight - 360, 100)}px`,
            labels: {
                noRows: gettext("No books available") // Message shown when there are no search results
            },
            layout: {
                top: ""
            },
            data: {
                headings: ['', '', this.dtBulk.getHTML(), gettext("Title"), gettext("Created"), gettext("Last changed"), gettext("Owner"), gettext("Rights"), ''],
                data: fileList
            },
            columns: [
                {
                    select: hiddenCols,
                    hidden: true
                },
                {
                    select: [2, 7, 8],
                    sortable: false
                },
                {
                    select: [this.lastSort.column],
                    sort: this.lastSort.dir
                }
            ]
        })

        this.table.on('datatable.sort', (column, dir) => {
            this.lastSort = {column, dir}
        })

        this.dtBulk.init(this.table.table)
    }

    createTableRow(book, subdirs, searching) {
        let path = book.path
        if (!path.startsWith('/')) {
            path = '/' + path
        }
        if (!path.startsWith(this.path)) {
            return false
        }
        if (path.endsWith('/')) {
            path += book.title.replace(/\//g, '')
        }

        const currentPath = path.slice(this.path.length)
        if (!searching && currentPath.includes('/')) {
            // There is a subdir
            const subdir = currentPath.split('/').shift()
            if (subdirs[subdir]) {
                // subdir has been covered already
                // We only update the update/added columns if needed.
                if (book.added < subdirs[subdir].added) {
                    subdirs[subdir].added = book.added
                    subdirs[subdir].row[5] = dateCell({date: book.added})
                }
                if (book.updated > subdirs[subdir].updated) {
                    subdirs[subdir].updated = book.updated
                    subdirs[subdir].row[6] = dateCell({date: book.updated})
                }
                if (this.user.id === book.owner.id) {
                    subdirs[subdir].ownedIds.push(book.id)
                    subdirs[subdir].row[8] = deleteFolderCell({subdir, ids: subdirs[subdir].ownedIds})
                }
                return false
            }
            const ownedIds = this.user.id === book.owner.id ? [book.id] : []
            // Display subdir
            const row = [
                '0',
                'folder',
                '',
                `<a class="fw-data-table-title fw-link-text subdir" href="/books${this.path}${subdir}/" data-path="${this.path}${subdir}/">
                    <i class="fas fa-folder"></i>
                    <span>${escapeText(subdir)}</span>
                </a>`,
                `<span class="date">${dateCell({date: book.added})}</span>`,
                `<span class="date">${dateCell({date: book.updated})}</span>`,
                '',
                '',
                ownedIds.length ? deleteFolderCell({subdir, ids: ownedIds}) : ''
            ]
            subdirs[subdir] = {row, added: book.added, updated: book.updated, ownedIds}
            return row
        }

        // This is the folder of the file. Return the file.
        return [
            String(book.id),
            'file',
            `<input type="checkbox" class="entry-select fw-check" data-id="${book.id}" id="book-${book.id}"><label for="book-${book.id}"></label>`,
            `<span class="fw-data-table-title fw-inline fw-link-text" data-id="${book.id}">
                <i class="fas fa-book"></i>
                <span class="book-title fw-searchable">
                    ${shortFileTitle(book.title, book.path)}
                </span>
            </span>`,
            `<span class="date">${dateCell({date: book.added})}</span>`,
            `<span class="date">${dateCell({date: book.updated})}</span>`,
            `<span>${book.owner.avatar.html}</span>
            <span class="fw-inline fw-searchable">${escapeText(book.owner.name)}</span>`,
            `<span class="${this.user.id === book.owner.id ? 'owned-by-user ' : ''}rights fw-inline" data-id="${book.id}">
                <i data-id="${book.id}" class="icon-access-right icon-access-${book.rights}"></i>
            </span>`,
            `<span class="delete-book fw-inline fw-link-text" data-id="${book.id}" data-title="${escapeText(book.title)}">
                ${this.user.id === book.owner.id ? '<i class="fas fa-trash-alt"></i>' : ''}
           </span>`
        ]
    }

    getBookListData() {
        const cachedPromise = this.showCached()
        if (this.app.isOffline()) {
            return cachedPromise
        }
        return postJson(
            '/api/book/list/'
        ).catch(
            error => {
                if (this.app.isOffline()) {
                    return cachedPromise
                } else {
                    addAlert('error', gettext('Cannot load data of books.'))
                    throw (error)
                }
            }
        ).then(
            ({json}) => {
                return cachedPromise.then(oldJson => {
                    if (!deepEqual(json, oldJson)) {
                        this.updateIndexedDB(json)
                        this.initializeView(json)
                    }
                })
            }
        ).then(
            () => deactivateWait()
        )
    }

    initializeView(json) {
        this.bookList = this.unpackBooks(json.books)
        this.documentList = json.documents
        this.contacts = json.contacts
        this.styles = json.styles

        this.initTable()
        return json
    }

    loaddatafromIndexedDB() {
        return this.app.indexedDB.readAllData("books_data").then(
            response => {
                if (!response.length) {
                    return false
                }
                const data = response[0]
                delete data.id
                return data
            }
        )
    }

    updateIndexedDB(json) {
        json.id = 1
        // Clear data if any present
        return this.app.indexedDB.clearData("books_data").then(
            () => this.app.indexedDB.insertData("books_data", [json])
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
                if (this.app.isOffline()) {
                    addAlert('info', gettext("You cannot delete books while you are offline."))
                } else {
                    const bookId = parseInt(el.target.dataset.id)
                    this.mod.actions.deleteBookDialog([bookId])
                }
                break
            }
            case findTarget(event, '.delete-folder', el):
                if (this.app.isOffline()) {
                    addAlert('info', gettext("You cannot delete books while you are offline."))
                } else {
                    const ids = el.target.dataset.ids.split(',').map(id => parseInt(id))
                    this.mod.actions.deleteBookDialog(ids)
                }
                break
            case findTarget(event, '.owned-by-user.rights', el): {
                const bookId = parseInt(el.target.dataset.id)
                const accessDialog = new BookAccessRightsDialog(
                    [bookId],
                    this.contacts,
                    memberDetails => this.contacts.push(memberDetails)
                )
                accessDialog.init()
                break
            }
            case findTarget(event, 'a.fw-data-table-title.subdir, a.fw-data-table-title.parentdir', el):
                event.preventDefault()
                this.path = el.target.dataset.path
                window.history.pushState({}, "", encodeURI(el.target.getAttribute('href')))
                this.initTable()
                break
            case findTarget(event, '.fw-data-table-title', el): {
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
