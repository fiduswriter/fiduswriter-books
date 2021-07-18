import {BookAccessRightsDialog} from "./accessrights"
import {HTMLBookExporter} from "./exporter/html"
import {LatexBookExporter} from "./exporter/latex"
import {EpubBookExporter} from "./exporter/epub"
import {PrintBookExporter} from "./exporter/print"
import {addAlert, FileDialog, NewFolderDialog} from "../common"

let currentlySearching = false

export const menuModel = () => ({
    content: [
        {
            type: 'text',
            title: gettext('Create new book'),
            action: overview => {
                overview.getImageDB().then(() => {
                    overview.mod.actions.createBookDialog(0, overview.imageDB)
                })
            },
            order: 1
        },
        {
            type: 'text',
            title: gettext('Create new folder'),
            action: overview => {
                const dialog = new NewFolderDialog(folderName => {
                    overview.path = overview.path + folderName + '/'
                    window.history.pushState({}, "", '/books' + overview.path)
                    overview.initTable()
                })
                dialog.open()
            },
            order: 2
        },
        {
            type: 'search',
            icon: 'search',
            title: gettext('Search books'),
            input: (overview, text) => {
                if (text.length && !currentlySearching) {
                    overview.initTable(true)
                    currentlySearching = true
                    overview.table.on(
                        'datatable.init',
                        () => overview.table.search(text)
                    )
                } else if (!text.length && currentlySearching) {
                    overview.initTable(false)
                    currentlySearching = false
                } else if (text.length) {
                    overview.table.search(text)
                }

            },
            order: 3
        }
    ]
})

const exportEpub = (book, overview) => {
    addAlert('info', book.title + ': ' + gettext(
        'Epub export has been initiated.'))
    const exporter = new EpubBookExporter(
        overview.schema,
        overview.app.csl,
        overview.styles,
        book,
        overview.user,
        overview.documentList,
        new Date(book.updated * 1000)
    )
    return exporter.init()
}

const exportHTML = (book, overview) => {
    addAlert('info', book.title + ': ' + gettext(
        'HTML export has been initiated.'))
    const exporter = new HTMLBookExporter(
        overview.schema,
        overview.app.csl,
        overview.styles,
        book,
        overview.user,
        overview.documentList,
        new Date(book.updated * 1000)
    )
    return exporter.init()
}

const exportLatex = (book, overview) => {
    addAlert('info', book.title + ': ' + gettext(
        'LaTeX export has been initiated.'))
    const exporter = new LatexBookExporter(
        overview.schema,
        book,
        overview.user,
        overview.documentList,
        new Date(book.updated * 1000)
    )
    return exporter.init()
}

const exportPrint = (book, overview) => {
    addAlert('info', book.title + ': ' + gettext(
        'Print has been initiated.'))
    const exporter = new PrintBookExporter(
        overview.schema,
        overview.app.csl,
        overview.styles,
        book,
        overview.user,
        overview.documentList
    )
    exporter.init()
}

export const bulkMenuModel = () => ({
    content: [
        {
            title: gettext('Move selected'),
            tooltip: gettext('Move the books that have been selected.'),
            action: overview => {
                const ids = overview.getSelected()
                const books = ids.map(id => overview.bookList.find(book => book.id === id))
                if (books.length) {
                    const dialog = new FileDialog({
                        title: books.length > 1 ? gettext('Move books') : gettext('Move book'),
                        movingFiles: books,
                        allFiles: overview.bookList,
                        moveUrl: '/api/book/move/',
                        successMessage: gettext('Book has been moved'),
                        errorMessage: gettext('Could not move book'),
                        succcessCallback: (file, path) => {
                            file.path = path
                            overview.initTable()
                        }
                    })
                    dialog.init()
                }
            }
        },
        {
            title: gettext('Delete selected'),
            tooltip: gettext('Delete selected books.'),
            action: overview => {
                const ids = overview.getSelected()
                const ownIds = ids.filter(id => {
                    const book = overview.bookList.find(book => book.id = id)
                    return book.is_owner
                })
                if (ownIds.length !== ids.length) {
                    addAlert('error', gettext('You cannot delete books of other users.'))
                }
                if (ownIds.length) {
                    overview.mod.actions.deleteBookDialog(ownIds)
                }
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext('Share selected'),
            tooltip: gettext('Share selected books.'),
            action: overview => {
                const ids = overview.getSelected()
                const ownIds = ids.filter(id => {
                    const book = overview.bookList.find(book => book.id = id)
                    return book.is_owner
                })
                if (ownIds.length !== ids.length) {
                    addAlert('error', gettext('You cannot share books of other users.'))
                }
                if (ownIds.length) {
                    const accessDialog = new BookAccessRightsDialog(
                        ownIds,
                        overview.contacts,
                        memberDetails => overview.contacts.push(memberDetails)
                    )
                    accessDialog.init()
                }
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext('Copy selected'),
            tooltip: gettext('Copy selected books.'),
            action: overview => {
                const ids = overview.getSelected()
                ids.forEach(id =>
                    overview.mod.actions.copyBook(
                        overview.bookList.find(book => book.id === id)
                    )
                )
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext('Export selected as Epub'),
            tooltip: gettext('Export selected books as Epub.'),
            action: overview => {
                const ids = overview.getSelected()
                ids.forEach(id => {
                    const book = overview.bookList.find(book => book.id === id)
                    exportEpub(book, overview)
                })
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext('Export selected as HTML'),
            tooltip: gettext('Export selected books as HTML.'),
            action: overview => {
                const ids = overview.getSelected()
                ids.forEach(id => {
                    const book = overview.bookList.find(book => book.id === id)
                    exportHTML(book, overview)
                })
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext('Export selected as LaTeX'),
            tooltip: gettext('Export selected books as LaTeX.'),
            action: overview => {
                const ids = overview.getSelected()
                ids.forEach(id => {
                    const book = overview.bookList.find(book => book.id === id)
                    exportLatex(book, overview)
                })
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext('Export selected to Print/PDF'),
            tooltip: gettext('Export selected books to the print dialog.'),
            action: overview => {
                const ids = overview.getSelected()
                ids.forEach(id => {
                    const book = overview.bookList.find(book => book.id === id)
                    exportPrint(book, overview)
                })
            },
            disabled: overview => !overview.getSelected().length
        }
    ]
})

export const exportMenuModel = () => ({
    content: [
        {
            type: 'action',
            title: gettext('Export as Epub'),
            tooltip: gettext('Export book as Epub.'),
            action: ({saveBook, book, overview}) => {
                saveBook().then(
                    () => exportEpub(book, overview)
                )
            }
        },
        {
            type: 'action',
            title: gettext('Export as HTML'),
            tooltip: gettext('Export book as HTML.'),
            action: ({saveBook, book, overview}) => {
                saveBook().then(
                    () => exportHTML(book, overview)
                )
            }
        },
        {
            type: 'action',
            title: gettext('Export as LaTeX'),
            tooltip: gettext('Export book as LaTeX.'),
            action: ({saveBook, book, overview}) => {
                saveBook().then(
                    () => exportLatex(book, overview)
                )
            }
        },
        {
            type: 'action',
            title: gettext('Export to Print/PDF'),
            tooltip: gettext('Export book to the print dialog.'),
            action: ({saveBook, book, overview}) => {
                saveBook().then(
                    () => exportPrint(book, overview)
                )
            }
        }
    ]
})
