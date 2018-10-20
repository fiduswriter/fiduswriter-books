import {BookAccessRightsDialog} from "./accessrights"
import {HTMLBookExporter} from "./exporter/html"
import {LatexBookExporter} from "./exporter/latex"
import {EpubBookExporter} from "./exporter/epub"
import {addAlert} from "../common"

export const menuModel = {
    content: [
        {
            type: 'select-action-dropdown',
            id: 'contact_selector',
            open: false,
            checked: false,
            checkAction: overview => {
                const checkboxes = document.querySelectorAll('input.entry-select[type=checkbox]')
                checkboxes.forEach(checkbox => checkbox.checked = true)
            },
            uncheckAction: overview => {
                const checkboxes = document.querySelectorAll('input.entry-select[type=checkbox]')
                checkboxes.forEach(checkbox => checkbox.checked = false)
            },
            content: [
                {
                    title: gettext('Delete selected'),
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
                    }
                },
                {
                    title: gettext('Share selected'),
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
                    }
                },
                {
                    title: gettext('Copy selected'),
                    action: overview => {
                        const ids = overview.getSelected()
                        ids.forEach(id =>
                            overview.mod.actions.copyBook(
                                overview.bookList.find(book => book.id===id)
                            )
                        )
                    }
                },
                {
                    title: gettext('Export selected as Epub'),
                    action: overview => {
                        const ids = overview.getSelected()
                        ids.forEach(id => {
                            const book = overview.bookList.find(book => book.id===id)
                            addAlert('info', book.title + ': ' + gettext(
                                'Epub export has been initiated.'))
                            new EpubBookExporter(
                                book,
                                overview.user,
                                overview.documentList,
                                overview.styles
                            )
                        })
                    }
                },
                {
                    title: gettext('Export selected as HTML'),
                    action: overview => {
                        const ids = overview.getSelected()
                        ids.forEach(id => {
                            const book = overview.bookList.find(book => book.id===id)
                            addAlert('info', book.title + ': ' + gettext(
                                'HTML export has been initiated.'))
                            new HTMLBookExporter(
                                book,
                                overview.user,
                                overview.documentList,
                                overview.styles
                            )
                        })
                    }
                },
                {
                    title: gettext('Export selected as LaTeX'),
                    action: overview => {
                        const ids = overview.getSelected()
                        ids.forEach(id => {
                            const book = overview.bookList.find(book => book.id===id)
                            addAlert('info', book.title + ': ' + gettext(
                                'LaTeX export has been initiated.'))
                            new LatexBookExporter(
                                book,
                                overview.user,
                                overview.documentList,
                                overview.styles
                            )
                        })
                    }
                },
                {
                    title: gettext('Export selected for print/PDF'),
                    action: overview => {
                        const ids = overview.getSelected()
                        ids.forEach(id => {
                            window.open(
                                `/book/print/${id}/`
                            )
                        })
                    }
                }
            ]
        },
        {
            type: 'button',
            icon: 'plus-circle',
            title: gettext('Create new book'),
            action: overview => {
                overview.getImageDB().then(() => {
                    overview.mod.actions.createBookDialog(0, overview.imageDB)
                })
            }
        }
    ]
}
