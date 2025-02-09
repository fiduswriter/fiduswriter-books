import deepEqual from "fast-deep-equal"
import {DataTable} from "simple-datatables"
import {keyName} from "w3c-keyname"

import * as plugins from "../../plugins/books_overview"
import {
    DatatableBulk,
    Dialog,
    OverviewMenuView,
    activateWait,
    addAlert,
    avatarTemplate,
    baseBodyTemplate,
    deactivateWait,
    ensureCSS,
    escapeText,
    findTarget,
    postJson,
    setDocTitle,
    shortFileTitle,
    whenReady
} from "../common"
import {FeedbackTab} from "../feedback"
import {ImageDB} from "../images/database"
import {SiteMenu} from "../menu"
import {docSchema} from "../schema/document"
import {BookAccessRightsDialog} from "./accessrights"
import {BookActions} from "./actions"
import {bulkMenuModel, menuModel} from "./menu"
import {dateCell, deleteFolderCell} from "./templates"

export class BookOverview {
    // A class that contains everything that happens on the books page.
    // It is currently not possible to initialize more than one such class,
    // as it contains bindings to menu items, etc. that are uniquely defined.
    constructor({app, user}, path = "/") {
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
        this.lastSort = {column: 0, dir: "asc"}
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
            return this.getBookListData().then(() =>
                this.app.csl.getStyles().then(styles => {
                    this.citationStyles = styles
                    return deactivateWait()
                })
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
            if (typeof plugins[plugin] === "function") {
                this.plugins[plugin] = new plugins[plugin](this)
                this.plugins[plugin].init()
            }
        })
    }

    render() {
        ensureCSS([
            staticUrl("css/add_remove_dialog.css"),
            staticUrl("css/access_rights_dialog.css"),
            staticUrl("css/book_dialog.css")
        ])
        this.dom = document.createElement("body")
        this.dom.innerHTML = baseBodyTemplate({
            contents: "",
            user: this.user,
            hasOverview: true,
            app: this.app
        })
        document.body = this.dom

        setDocTitle(gettext("Book Overview"), this.app)
        const feedbackTab = new FeedbackTab()
        feedbackTab.init()
    }

    getImageDB() {
        if (!this.imageDB) {
            const imageGetter = new ImageDB()
            return new Promise(resolve => {
                imageGetter.getDB().then(() => {
                    this.imageDB = imageGetter
                    resolve()
                })
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
        const tableEl = document.createElement("table")
        tableEl.classList.add("fw-data-table")
        tableEl.classList.add("fw-large")
        const contentsEl = document.querySelector(".fw-contents")
        contentsEl.innerHTML = ""
        contentsEl.appendChild(tableEl)

        if (this.path !== "/") {
            const headerEl = document.createElement("h1")
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

        const fileList = this.bookList
            .map(book => this.createTableRow(book, subdirs, searching))
            .filter(row => !!row)

        if (!searching && this.path !== "/") {
            const pathParts = this.path.split("/")
            pathParts.pop()
            pathParts.pop()
            const parentPath = pathParts.join("/") + "/"
            fileList.unshift([
                "-1",
                "top",
                false,
                `<a class="fw-data-table-title fw-link-text parentdir" href="/books${encodeURI(
                    parentPath
                )}" data-path="${parentPath}">
                    <i class="fas fa-folder"></i>
                    <span>..</span>
                </a>`,
                "",
                "",
                "",
                "",
                ""
            ])
        }

        this.table = new DataTable(tableEl, {
            searchable: searching,
            paging: false,
            scrollY: `${Math.max(window.innerHeight - 360, 100)}px`,
            labels: {
                noRows: gettext("No books available"),
                noResults: gettext("No books found") // Message shown when there are no search results
            },
            layout: {
                top: ""
            },
            data: {
                headings: [
                    "",
                    "",
                    this.dtBulk.getHTML(),
                    gettext("Title"),
                    gettext("Created"),
                    gettext("Last changed"),
                    gettext("Owner"),
                    gettext("Rights"),
                    ""
                ],
                data: fileList
            },
            columns: [
                {
                    select: 0,
                    type: "number"
                },
                {
                    select: hiddenCols,
                    hidden: true
                },
                {
                    select: 2,
                    sortable: false,
                    type: "boolean"
                },
                {
                    select: [7, 8],
                    sortable: false
                },
                {
                    select: [this.lastSort.column],
                    sort: this.lastSort.dir
                }
            ],
            rowNavigation: true,
            rowSelectionKeys: ["Enter", "Delete", " "],
            tabIndex: 1,
            rowRender: (row, tr, _index) => {
                if (row.cells[1].data === "folder") {
                    tr.childNodes[0].childNodes = []
                    return
                }
                const id = row.cells[0].data
                const inputNode = {
                    nodeName: "input",
                    attributes: {
                        type: "checkbox",
                        class: "entry-select fw-check",
                        "data-id": id,
                        id: `book-${id}`
                    }
                }
                if (row.cells[2].data) {
                    inputNode.attributes.checked = true
                }
                tr.childNodes[0].childNodes = [
                    inputNode,
                    {
                        nodeName: "label",
                        attributes: {
                            for: `book-${id}`
                        }
                    }
                ]
            }
        })

        this.table.on("datatable.selectrow", (rowIndex, event, focused) => {
            event.preventDefault()
            if (event.type === "keydown") {
                const key = keyName(event)
                if (key === "Enter") {
                    const link = this.table.dom.querySelector(
                        `tr[data-index="${rowIndex}"] a.fw-data-table-title`
                    )
                    if (link) {
                        link.click()
                    }
                } else if (key === " ") {
                    const cell = this.table.data.data[rowIndex].cells[2]
                    cell.data = !cell.data
                    cell.text = String(cell.data)
                    this.table.update()
                } else if (key === "Delete") {
                    const cell = this.table.data.data[rowIndex].cells[0]
                    const bookId = cell.data
                    this.mod.actions.deleteBookDialog([bookId], this.app)
                }
            } else {
                if (
                    event.target.closest(
                        "span.fw-data-table-title, span.rights, span.delete-book"
                    )
                ) {
                    return
                }
                if (!focused) {
                    this.table.dom.focus()
                }
                this.table.rows.setCursor(rowIndex)
            }
        })

        this.table.on("datatable.sort", (column, dir) => {
            this.lastSort = {column, dir}
        })

        this.dtBulk.init(this.table.dom)
    }

    createTableRow(book, subdirs, searching) {
        let path = book.path
        if (!path.startsWith("/")) {
            path = "/" + path
        }
        if (!path.startsWith(this.path)) {
            return false
        }
        if (path.endsWith("/")) {
            path += book.title.replace(/\//g, "")
        }

        const currentPath = path.slice(this.path.length)
        if (!searching && currentPath.includes("/")) {
            // There is a subdir
            const subdir = currentPath.split("/").shift()
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
                    subdirs[subdir].row[8] = deleteFolderCell({
                        subdir,
                        ids: subdirs[subdir].ownedIds
                    })
                }
                return false
            }
            const ownedIds = this.user.id === book.owner.id ? [book.id] : []
            // Display subdir
            const row = [
                "0",
                "folder",
                false,
                `<a class="fw-data-table-title fw-link-text subdir" href="/books${encodeURI(
                    this.path + subdir
                )}/" data-path="${this.path}${subdir}/">
                    <i class="fas fa-folder"></i>
                    <span>${escapeText(subdir)}</span>
                </a>`,
                `<span class="date">${dateCell({date: book.added})}</span>`,
                `<span class="date">${dateCell({date: book.updated})}</span>`,
                "",
                "",
                ownedIds.length ? deleteFolderCell({subdir, ids: ownedIds}) : ""
            ]
            subdirs[subdir] = {
                row,
                added: book.added,
                updated: book.updated,
                ownedIds
            }
            return row
        }

        // This is the folder of the file. Return the file.
        return [
            book.id,
            "file",
            false, // checkbox
            `<span class="fw-data-table-title fw-inline fw-link-text" data-id="${
                book.id
            }">
                <i class="fas fa-book"></i>
                <span class="book-title fw-searchable">
                    ${shortFileTitle(book.title, book.path)}
                </span>
            </span>`,
            `<span class="date">${dateCell({date: book.added})}</span>`,
            `<span class="date">${dateCell({date: book.updated})}</span>`,
            `<span>${avatarTemplate({user: book.owner})}</span>
            <span class="fw-inline fw-searchable">${escapeText(
                book.owner.name
            )}</span>`,
            `<span class="${
                this.user.id === book.owner.id ? "owned-by-user " : ""
            }rights fw-inline" data-id="${book.id}">
                <i data-id="${book.id}" class="icon-access-right icon-access-${
                    book.rights
                }"></i>
            </span>`,
            `<span class="delete-book fw-inline fw-link-text" data-id="${
                book.id
            }" data-title="${escapeText(book.title)}">
                ${
                    this.user.id === book.owner.id
                        ? '<i class="fas fa-trash-alt"></i>'
                        : ""
                }
           </span>`
        ]
    }

    getBookListData() {
        const cachedPromise = this.showCached()
        if (this.app.isOffline()) {
            return cachedPromise
        }
        return postJson("/api/book/list/")
            .catch(error => {
                if (this.app.isOffline()) {
                    return cachedPromise
                } else {
                    addAlert("error", gettext("Cannot load data of books."))
                    throw error
                }
            })
            .then(({json}) => {
                return cachedPromise.then(oldJson => {
                    if (!deepEqual(json, oldJson)) {
                        this.updateIndexedDB(json)
                        this.initializeView(json)
                    }
                })
            })
            .then(() => deactivateWait())
    }

    initializeView(json) {
        this.bookList = json.books
        this.documentList = json.documents
        this.contacts = json.contacts
        this.styles = json.styles
        if (this.app.page === this) {
            this.initTable()
        }
        return json
    }

    loaddatafromIndexedDB() {
        return this.app.indexedDB.readAllData("books_data").then(response => {
            if (!response.length) {
                return false
            }
            const data = response[0]
            delete data.id
            return data
        })
    }

    updateIndexedDB(json) {
        json.id = 1
        // Clear data if any present
        return this.app.indexedDB
            .clearData("books_data")
            .then(() => this.app.indexedDB.insertData("books_data", [json]))
    }

    bind() {
        this.dom.addEventListener("click", event => {
            const el = {}
            switch (true) {
                case findTarget(
                    event,
                    ".entry-select, .entry-select + label",
                    el
                ): {
                    const checkbox = el.target
                    const dataIndex = checkbox
                        .closest("tr")
                        .getAttribute("data-index", null)
                    if (dataIndex) {
                        const index = Number.parseInt(dataIndex)
                        const data = this.table.data.data[index]
                        data.cells[2].data = !checkbox.checked
                        data.cells[2].text = String(!checkbox.checked)
                    }
                    break
                }
                case findTarget(event, ".delete-book", el): {
                    if (this.app.isOffline()) {
                        addAlert(
                            "info",
                            gettext(
                                "You cannot delete books while you are offline."
                            )
                        )
                    } else {
                        const bookId = Number.parseInt(el.target.dataset.id)
                        this.mod.actions.deleteBookDialog([bookId])
                    }
                    break
                }
                case findTarget(event, ".delete-folder", el):
                    if (this.app.isOffline()) {
                        addAlert(
                            "info",
                            gettext(
                                "You cannot delete books while you are offline."
                            )
                        )
                    } else {
                        const ids = el.target.dataset.ids
                            .split(",")
                            .map(id => Number.parseInt(id))
                        this.mod.actions.deleteBookDialog(ids)
                    }
                    break
                case findTarget(event, ".owned-by-user.rights", el): {
                    const bookId = Number.parseInt(el.target.dataset.id)
                    const accessDialog = new BookAccessRightsDialog(
                        [bookId],
                        this.contacts,
                        memberDetails => this.contacts.push(memberDetails)
                    )
                    accessDialog.init()
                    break
                }
                case findTarget(event, "a.fw-data-table-title.parentdir", el):
                    event.preventDefault()
                    if (this.table.data.data.length > 1) {
                        this.path = el.target.dataset.path
                        window.history.pushState(
                            {},
                            "",
                            el.target.getAttribute("href")
                        )
                        this.initTable()
                    } else {
                        const confirmFolderDeletionDialog = new Dialog({
                            title: gettext("Confirm deletion"),
                            body: `<p>
                    ${gettext(
                        "Leaving an empty folder will delete it. Do you really want to delete this folder?"
                    )}
                            </p>`,
                            id: "confirmfolderdeletion",
                            icon: "exclamation-triangle",
                            buttons: [
                                {
                                    text: gettext("Delete"),
                                    classes: "fw-dark delete-folder",
                                    height: 70,
                                    click: () => {
                                        confirmFolderDeletionDialog.close()
                                        this.path = el.target.dataset.path
                                        window.history.pushState(
                                            {},
                                            "",
                                            el.target.getAttribute("href")
                                        )
                                        this.initTable()
                                    }
                                },
                                {
                                    type: "cancel"
                                }
                            ]
                        })

                        confirmFolderDeletionDialog.open()
                    }

                    break
                case findTarget(event, "a.fw-data-table-title.subdir", el):
                    event.preventDefault()
                    this.path = el.target.dataset.path
                    window.history.pushState(
                        {},
                        "",
                        el.target.getAttribute("href")
                    )
                    this.initTable()
                    break
                case findTarget(event, ".fw-data-table-title", el): {
                    const bookId = Number.parseInt(el.target.dataset.id)
                    this.getImageDB().then(() => {
                        this.mod.actions.createBookDialog(bookId, this.imageDB)
                    })
                    break
                }
                case findTarget(event, "a", el):
                    if (
                        el.target.hostname === window.location.hostname &&
                        el.target.getAttribute("href")[0] === "/"
                    ) {
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
            this.dom.querySelectorAll(".entry-select:checked:not(:disabled)")
        ).map(el => Number.parseInt(el.getAttribute("data-id")))
    }

    close() {
        if (this.table) {
            this.table.destroy()
        }
        if (this.menu) {
            this.menu.destroy()
            this.menu = null
        }
    }
}
