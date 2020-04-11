import {BookAccessRightsDialog} from "./accessrights"
import {HTMLBookExporter} from "./exporter/html"
import {LatexBookExporter} from "./exporter/latex"
import {EpubBookExporter} from "./exporter/epub"
import {PrintBookExporter} from "./exporter/print"
import {addAlert} from "../common"

export const menuModel = () => ({
    content: [
        {
            type: 'text',
            title: gettext('Create new book'),
            action: overview => {
                overview.getImageDB().then(() => {
                    overview.mod.actions.createBookDialog(0, overview.imageDB)
                })
            }
        }
    ]
})

export const bulkMenuModel = () => ({
    content: [
        {
            title: gettext('Delete selected'),
            tooltip: gettext('Delete selected books.'),
            action: overview => {
                const ids = overview.getSelected()
                const ownIds = ids.filter(id => {
                    const book = overview.bookList.find(book => book.id=id)
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
                    const book = overview.bookList.find(book => book.id=id)
                    return book.is_owner
                })
                if (ownIds.length !== ids.length) {
                    addAlert('error', gettext('You cannot share books of other users.'))
                }
                if (ownIds.length) {
                    const accessDialog = new BookAccessRightsDialog(
                        ownIds,
                        overview.teamMembers,
                        overview.accessRights
                    )
                    accessDialog.init().then(accessRights => {
                        overview.accessRights = accessRights
                    })
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
                        overview.bookList.find(book => book.id===id)
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
                    const book = overview.bookList.find(book => book.id===id)
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
                    exporter.init()
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
                    const book = overview.bookList.find(book => book.id===id)
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
                    exporter.init()
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
                    const book = overview.bookList.find(book => book.id===id)
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
                    const book = overview.bookList.find(book => book.id===id)
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
                })
            },
            disabled: overview => !overview.getSelected().length
        }
    ]
})
