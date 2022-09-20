import {
    ContentMenu,
    setCheckableLabel,
    addAlert,
    Dialog,
    postJson,
    findTarget
} from "../../common"
import {AddContactDialog} from "../../contacts/add_dialog"
import {
    bookCollaboratorsTemplate,
    bookContactsTemplate,
    bookAccessRightOverviewTemplate
} from "./templates"
/**
 * Helper functions to deal with the book access rights dialog.
 */

export class BookAccessRightsDialog {
    constructor(bookIds, contacts, newContactCall) {
        this.bookIds = bookIds
        this.contacts = contacts
        this.newContactCall = newContactCall // a function to be called when a new contact has been added with contact details
    }

    init() {
        postJson(
            "/api/book/access_rights/get/",
            {book_ids: this.bookIds}
        ).catch(
            error => {
                addAlert("error", gettext("Cannot load book access data."))
                throw error
            }
        ).then(
            ({json}) => {
                this.accessRights = json.access_rights
                this.createAccessRightsDialog()
            }
        )
    }

    createAccessRightsDialog() {
        const bookCollabs = {}
        this.accessRights.forEach(ar => {
            if (!this.bookIds.includes(ar.book_id)) {
                return
            }
            const holderIdent = ar.holder.type + ar.holder.id
            if (bookCollabs[holderIdent]) {
                if (bookCollabs[holderIdent].rights != ar.rights) {
                    // We use read rights if the user has different rights on different docs.
                    bookCollabs[holderIdent].rights = "read"
                }
                bookCollabs[holderIdent].count += 1
            } else {
                bookCollabs[holderIdent] = Object.assign({}, ar)
                bookCollabs[holderIdent].count = 1
            }
        })

        const collaborators = Object.values(bookCollabs).filter(
            col => col.count === this.bookIds.length
        )

        const buttons = [
            {
                text: (settings_REGISTRATION_OPEN || settings_SOCIALACCOUNT_OPEN) ? gettext("Add contact or invite new user") : gettext("Add contact"),
                classes: "fw-light fw-add-button",
                click: () => {
                    const dialog = new AddContactDialog()
                    dialog.init().then(
                        contactsData => {
                            contactsData.forEach(
                                contactData => {
                                    if (contactData.id) {
                                        document.querySelector("#my-contacts .fw-data-table-body").insertAdjacentHTML(
                                            "beforeend",
                                            bookContactsTemplate({contacts: [contactData]})
                                        )
                                        document.querySelector("#share-contact table tbody").insertAdjacentHTML(
                                            "beforeend",
                                            bookCollaboratorsTemplate({"collaborators": [{
                                                holder: contactData,
                                                rights: "read"
                                            }]})
                                        )
                                        this.newContactCall(contactData)
                                    } else {
                                        document.querySelector("#share-contact table tbody").insertAdjacentHTML(
                                            "beforeend",
                                            bookCollaboratorsTemplate({"collaborators": [{
                                                holder: contactData,
                                                rights: "read"
                                            }]})
                                        )
                                    }
                                }
                            )
                        }
                    )
                }
            },
            {
                text: gettext("Submit"),
                classes: "fw-dark",
                click: () => {
                    const accessRights = []
                    document.querySelectorAll("#share-contact .collaborator-tr").forEach(el => {
                        accessRights.push({
                            holder: {
                                id: parseInt(el.dataset.id),
                                type: el.dataset.type,
                            },
                            rights: el.dataset.rights
                        })
                    })
                    this.submitAccessRight(accessRights)
                    this.dialog.close()
                }
            },
            {
                type: "close",
                click: () => {
                    this.dialog.close()
                }
            }
        ]

        this.dialog = new Dialog({
            width: 820,
            height: 400,
            id: "access-rights-dialog",
            title: gettext("Share your book with others"),
            body: bookAccessRightOverviewTemplate({
                contacts: this.contacts,
                collaborators
            }),
            buttons
        })
        this.dialog.open()

        this.dialog.dialogEl.querySelector("#add-share-contact").addEventListener("click", () => {
            const selectedData = []
            document.querySelectorAll("#my-contacts .fw-checkable.checked").forEach(el => {
                const collaboratorEl = document.getElementById(`collaborator-${el.dataset.type}-${el.dataset.id}`)
                if (collaboratorEl) {
                    if (collaboratorEl.dataset.rights === "delete") {
                        collaboratorEl.dataset.rights = "read"
                        const accessRightIcon = collaboratorEl.querySelector(".icon-access-right")
                        accessRightIcon.classList.remove("icon-access-delete")
                        accessRightIcon.classList.add("icon-access-read")
                    }
                } else {
                    const collaborator = this.contacts.find(
                        contact => contact.type === el.dataset.type && contact.id === parseInt(el.dataset.id)
                    )
                    if (!collaborator) {
                        console.warn(`No contact found of type: ${el.dataset.type} id: ${el.dataset.id}.`)
                        return
                    }
                    selectedData.push({
                        holder: {
                            id: collaborator.id,
                            type: collaborator.type,
                            name: collaborator.name,
                            avatar: collaborator.avatar,
                        },
                        rights: "read"
                    })
                }
            })

            document.querySelectorAll("#my-contacts .checkable-label.checked").forEach(el => el.classList.remove("checked"))
            document.querySelector("#share-contact table tbody").insertAdjacentHTML(
                "beforeend",
                bookCollaboratorsTemplate({
                    "collaborators": selectedData
                })
            )

        })

        this.dialog.dialogEl.addEventListener("click", event => {
            const el = {}
            switch (true) {
            case findTarget(event, ".fw-checkable", el):
                setCheckableLabel(el.target)
                break
            case findTarget(event, ".edit-right", el): {
                const colRow = el.target.closest(".collaborator-tr,.invite-tr")
                const currentRight = colRow.dataset.rights
                const menu = this.getDropdownMenu(currentRight, newRight => {
                    colRow.dataset.rights = newRight
                    colRow.querySelector(".icon-access-right").setAttribute(
                        "class",
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
            case findTarget(event, ".delete-collaborator", el): {
                const colRow = el.target.closest(".collaborator-tr")
                colRow.dataset.right = "delete"
                colRow.querySelector(".icon-access-right").setAttribute("class", "icon-access-right icon-access-delete")
                break
            }
            default:
                break
            }

        })

    }

    getDropdownMenu(currentRight, onChange) {
        return {
            content: [
                {type: "action", title: gettext("Write"), icon: "pencil-alt", tooltip: gettext("Write"), action: () => {
                    onChange("write")
                }, selected: currentRight === "write"},
                {type: "action", title: gettext("Read"), icon: "eye", tooltip: gettext("Read"), action: () => {
                    onChange("read")
                }, selected: currentRight === "read"}
            ]
        }
    }

    submitAccessRight(newAccessRights) {
        return postJson(
            "/api/book/access_rights/save/", {
                book_ids: JSON.stringify(this.bookIds),
                access_rights: JSON.stringify(newAccessRights),
            }
        ).catch(
            error => {
                addAlert("error", gettext("Cannot save access rights."))
                throw (error)
            }
        ).then(() => {
            addAlert("success", gettext("Access rights have been saved"))
        })
    }

}
