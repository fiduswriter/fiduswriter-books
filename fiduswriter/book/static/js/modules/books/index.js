import deepEqual from "fast-deep-equal"

import {docSchema} from "@fiduswriter/document/schema/document/index"
import {
    Dialog,
    OverviewDataTable,
    OverviewMenuView,
    activateWait,
    addAlert,
    avatarTemplate,
    deactivateWait,
    ensureCSS,
    escapeText,
    findTarget,
    postJson,
    setDocTitle,
    shortFileTitle,
    whenReady
} from "fwtoolkit"
import {plugins} from "../../plugins/books_overview"
import {baseBodyTemplate} from "../common/index.js"
import {FeedbackTab} from "../feedback"
import {ImageDB} from "../images/database"
import {SiteMenu} from "../menu"
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
        this.styles = []
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
        if (this.plugins) {
            // Plugins have been activated already
            return
        }
        // Add plugins.
        this.plugins = {}

        plugins.forEach(([app, plugin]) => {
            if (!this.app.settings.APPS.includes(app)) {
                return
            }
            Object.values(plugin).forEach(pluginExport => {
                if (typeof pluginExport === "function") {
                    this.plugins[pluginExport.name] = new pluginExport(this)
                    this.plugins[pluginExport.name].init()
                }
            })
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
        if (this.overviewTable) {
            this.overviewTable.destroy()
            this.overviewTable = null
        }
        this.table = null
        this.dtBulk = null

        const subdirs = {}
        const contentsEl = document.querySelector(".fw-contents")
        contentsEl.innerHTML = ""

        if (this.path !== "/") {
            const headerEl = document.createElement("h1")
            headerEl.innerHTML = escapeText(this.path)
            contentsEl.appendChild(headerEl)
        }

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

        this.overviewTable = new OverviewDataTable({
            dom: contentsEl,
            classes: ["fw-data-table", "fw-large"],
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
            data: fileList,
            idColumn: 0,
            checkboxColumn: 2,
            bulkMenu: this.dtBulkModel,
            bulkMenuPage: this,
            searchable: searching,
            scrollY: `${Math.max(window.innerHeight - 360, 100)}px`,
            tabIndex: 1,
            labels: {
                noRows: gettext("No books available"),
                noResults: gettext("No books found") // Message shown when there are no search results
            },
            headings: [
                "",
                "",
                "",
                gettext("Title"),
                gettext("Created"),
                gettext("Last changed"),
                gettext("Owner"),
                gettext("Rights"),
                ""
            ],
            template: (options, _dom) =>
                `<div class='${options.classes.container}'${options.scrollY.length ? ` style='height: ${options.scrollY}; overflow-Y: auto;'` : ""}></div>`,
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
            },
            onEnter: (row, _event) => {
                if (this.getSelected().length > 0) {
                    return
                }
                const rowIndex = this.table.data.data.indexOf(row)
                const link = this.table.dom.querySelector(
                    `tr[data-index="${rowIndex}"] a.fw-data-table-title`
                )
                if (link) {
                    link.click()
                }
            },
            onDelete: row => {
                const bookId = row.cells[0].data
                this.mod.actions.deleteBookDialog([bookId], this.app)
            }
        })
        this.overviewTable.init()
        this.table = this.overviewTable.table
        this.dtBulk = this.overviewTable.dtBulk

        this.table.on("datatable.sort", (column, dir) => {
            this.lastSort = {column, dir}
        })

        this.table.dom.focus()
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
                `<span class="fw-date">${dateCell({date: book.added})}</span>`,
                `<span class="fw-date">${dateCell({date: book.updated})}</span>`,
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
            `<span class="fw-date">${dateCell({date: book.added})}</span>`,
            `<span class="fw-date">${dateCell({date: book.updated})}</span>`,
            `<span>${avatarTemplate({user: book.owner})}</span>
            <span class="fw-inline fw-searchable">${escapeText(
                book.owner.name
            )}</span>`,
            `<span class="${
                this.user.id === book.owner.id ? "fw-owned-by-user " : ""
            }rights fw-inline" data-id="${book.id}">
                <i data-id="${book.id}" class="fw-icon-access-right icon-access-${
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
        this.decryptE2EETitles()
        return json
    }

    /**
     * Update doc.title in-place for every E2EE document in documentList so
     * that all downstream consumers (templates, FileSelector, exporters) can
     * treat the title as a plain string without any special handling.
     *
     * Two passes:
     *   1. Synchronous — titles already cached in sessionStorage (written
     *      when the editor closed the document this session) are applied
     *      immediately, before any other code runs.
     *   2. Async — for docs whose title is not yet cached, derive the key
     *      from sessionStorage and decrypt with AES-GCM.
     */
    decryptE2EETitles() {
        const e2eeDocs = this.documentList.filter(doc => doc.e2ee && doc.title)
        if (!e2eeDocs.length) {
            return
        }

        // Pass 1: synchronous sessionStorage read — covers the common case
        // where the document was opened in the current browser session.
        const needsAsyncDecrypt = []
        e2eeDocs.forEach(doc => {
            const cached = sessionStorage.getItem(`e2ee_title_${doc.id}`)
            if (cached !== null) {
                doc.title = cached
            } else {
                needsAsyncDecrypt.push(doc)
            }
        })

        if (!needsAsyncDecrypt.length) {
            return // Pass 2: async decryption for docs whose title was not yet cached.
        }
        ;(async () => {
            const [{E2EEKeyManager}, {E2EEEncryptor}] = await Promise.all([
                import("../editor/e2ee/key-manager"),
                import("../editor/e2ee/encryptor")
            ])
            await Promise.all(
                needsAsyncDecrypt.map(async doc => {
                    try {
                        const keyOrNull = E2EEKeyManager.getKeyFromSession(
                            doc.id
                        )
                        if (!keyOrNull) {
                            return
                        }
                        const key = await keyOrNull
                        const title = await E2EEEncryptor.decrypt(
                            doc.title,
                            key
                        )
                        doc.title = title
                        sessionStorage.setItem(`e2ee_title_${doc.id}`, title)
                    } catch (_e) {
                        // Key unavailable or stale — leave the encrypted
                        // title in place; the UI will show it as-is.
                    }
                })
            )
        })()
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
                case findTarget(event, ".fw-owned-by-user.rights", el): {
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
            this.table = null
        }
        if (this.dtBulk) {
            this.dtBulk.destroy()
            this.dtBulk = null
        }
        if (this.menu) {
            this.menu.destroy()
            this.menu = null
        }
    }
}
