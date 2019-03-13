import {
    bookCollaboratorsTemplate,
    bookAccessRightOverviewTemplate
} from "./templates"
import {
    openDropdownBox,
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
    constructor(bookIds, teamMembers, accessRights) {
        this.bookIds = bookIds
        this.teamMembers = teamMembers
        this.accessRights = accessRights
    }

    init() {

        const collabObject = {}

        this.accessRights.forEach(right => {
            if (this.bookIds.includes(right.book_id)) {
                if (right.user_id in collabObject) {
                    if (collabObject[right.user_id].rights !== right.rights) {
                        // different rights to different books, so we fall back to read
                        // rights
                        collabObject[right.user_id].rights = 'read'
                    }
                    collabObject[right.user_id].count += 1
                } else {
                    collabObject[right.user_id] = right
                    collabObject[right.user_id].count = 1
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
                contacts: this.teamMembers,
                collaborators
            }),
            buttons
        })
        this.dialog.open()

        this.dialog.dialogEl.querySelector('#add-share-member').addEventListener('click', () => {
            const collaborators = []
            document.querySelectorAll('#my-contacts .fw-checkable.checked').forEach(el => {
                const memberId = el.dataset.id
                const collaboratorEl = document.getElementById(`collaborator-${memberId}`)
                if (!collaboratorEl) {
                    collaborators.push({
                        user_id: memberId,
                        user_name: el.dataset.name,
                        avatar: el.dataset.avatar,
                        rights: 'read'
                    })
                } else if ('delete' === collaboratorEl.dataset.right) {
                    collaboratorEl.classList.remove('delete')
                    collaboratorEl.classList.add('read')
                    collaboratorEl.dataset.right = 'read'
                }
            })

            document.querySelectorAll('#my-contacts .checkable-label.checked').forEach(el => el.classList.remove('checked'))
            document.querySelector('#share-member table tbody').insertAdjacentHTML(
                'beforeend',
                bookCollaboratorsTemplate({
                    collaborators
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
                    const box = el.target.parentElement.querySelector('.fw-pulldown')
                    if (!box.clientWidth) {
                        openDropdownBox(box)
                    }
                    break
                }
                case findTarget(event, '.edit-right-wrapper .fw-pulldown-item, .delete-collaborator', el): {
                    const newRight = el.target.dataset.right
                    const colRow = el.target.closest('.collaborator-tr')
                    colRow.dataset.right = newRight
                    colRow.querySelector('.icon-access-right').setAttribute('class', `icon-access-right icon-access-${newRight}`)
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

    submitAccessRight({
        bookIds,
        collaborators,
        rights
    }) {
        return postJson(
            '/book/accessright/save/', {
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
