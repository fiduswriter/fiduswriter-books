import {
    bookCollaboratorsTemplate,
    bookAccessRightOverviewTemplate
} from "./templates"
import {
    ContentMenu,
    setCheckableLabel,
    addAlert,
    cancelPromise,
    Dialog,
    postJson,
    findTarget
} from "../../common"

/**
 * Helper functions to deal with the book access rights dialog.
 */

export class BookAccessRightsDialog {
    constructor(bookIds, contacts, accessRights) {
        this.bookIds = bookIds
        this.contacts = contacts
        this.accessRights = accessRights
        console.log({bookIds, contacts, accessRights})//: JSON.parse(JSON.stringify(accessRights))})
    }

    init() {

        const collabObject = {}

        this.accessRights.forEach(right => {
            if (this.bookIds.includes(right.book_id)) {
                if (right.user.id in collabObject) {
                    if (collabObject[right.user.id].rights !== right.rights) {
                        // different rights to different books, so we fall back to read
                        // rights
                        collabObject[right.user.id].rights = 'read'
                    }
                    collabObject[right.user.id].count += 1
                } else {
                    collabObject[right.user.id] = JSON.parse(JSON.stringify(right))
                    collabObject[right.user.id].count = 1
                }
            }
        })



        const collaborators = Object.values(collabObject).filter(
            collab => collab.count === this.bookIds.length
        )

        const buttons = []
        const p = new Promise(resolve => {
            buttons.push({
                text: gettext('Submit'),
                classes: "fw-dark",
                click: () => {
                    const collaborators = [],
                        rights = []
                    document.querySelectorAll('#share-member .collaborator-tr').forEach(el => {
                        collaborators.push(el.dataset.id)
                        rights.push(el.dataset.right)
                    })
                    this.dialog.close()
                    resolve({
                        bookIds: this.bookIds,
                        collaborators,
                        rights
                    })
                }
            })

            buttons.push({
                type: 'close',
                click: () => {
                    this.dialog.close()
                    resolve(cancelPromise())
                }
            })
        })

        this.dialog = new Dialog({
            width: 820,
            height: 400,
            id: 'access-rights-dialog',
            title: gettext('Share your book with others'),
            body: bookAccessRightOverviewTemplate({
                contacts: this.contacts,
                collaborators
            }),
            buttons
        })
        this.dialog.open()

        this.dialog.dialogEl.querySelector('#add-share-member').addEventListener('click', () => {
            const selectData = []
            document.querySelectorAll('#my-contacts .fw-checkable.checked').forEach(el => {
                const memberId = parseInt(el.dataset.id)

                const collaboratorEl = document.getElementById(`collaborator-${memberId}`)
                if (collaboratorEl) {
                    if (collaboratorEl.dataset.right === 'delete') {
                        collaboratorEl.classList.remove('delete')
                        collaboratorEl.classList.add('read')
                        collaboratorEl.dataset.right = 'read'
                    }
                } else {
                    const collaborator = this.contacts.find(contact => contact.id === memberId)
                    selectData.push({
                        user: collaborator,
                        rights: 'read'
                    })
                }
            })

            document.querySelectorAll('#my-contacts .checkable-label.checked').forEach(el => el.classList.remove('checked'))
            document.querySelector('#share-member table tbody').insertAdjacentHTML(
                'beforeend',
                bookCollaboratorsTemplate({
                    'collaborators': selectData
                })
            )

        })

        this.dialog.dialogEl.addEventListener('click', event => {
            const el = {}
            switch (true) {
            case findTarget(event, '.fw-checkable', el):
                setCheckableLabel(el.target)
                break
            case findTarget(event, '.edit-right', el): {
                const colRow = el.target.closest('.collaborator-tr,.invite-tr')
                const currentRight = colRow.dataset.right
                const menu = this.getDropdownMenu(currentRight, newRight => {
                    colRow.dataset.right = newRight
                    colRow.querySelector('.icon-access-right').setAttribute(
                        'class',
                        `icon-access-right icon-access-${newRight}`
                    )
                })
                const contentMenu = new ContentMenu({
                    menu,
                    menuPos: {X: event.pageX, Y: event.pageY},
                    width: 200
                })
                contentMenu.open()
                break
            }
            case findTarget(event, '.delete-collaborator', el): {
                const colRow = el.target.closest('.collaborator-tr')
                colRow.dataset.right = 'delete'
                colRow.querySelector('.icon-access-right').setAttribute('class', 'icon-access-right icon-access-delete')
                break
            }
            default:
                break
            }

        })

        return p.then(
            ({
                bookIds,
                collaborators,
                rights
            }) => this.submitAccessRight({
                bookIds,
                collaborators,
                rights
            })
        )
    }

    getDropdownMenu(currentRight, onChange) {
        return {
            content: [
                {type: 'action', title: gettext('Write'), icon: 'pencil-alt', tooltip: gettext("Write"), action: () => {
                    onChange('write')
                }, selected: currentRight === 'write'},
                {type: 'action', title: gettext('Read'), icon: 'eye', tooltip: gettext("Read"), action: () => {
                    onChange('read')
                }, selected: currentRight === 'read'}
            ]
        }
    }

    submitAccessRight({
        bookIds,
        collaborators,
        rights
    }) {
        return postJson(
            '/api/book/accessright/save/', {
                books: bookIds,
                collaborators,
                rights
            }
        ).catch(
            error => {
                addAlert('error', gettext('Cannot save access rights.'))
                throw (error)
            }
        ).then(({
            json
        }) => {
            addAlert('success', gettext('Access rights have been saved'))
            return json.access_rights
        })

    }

}
