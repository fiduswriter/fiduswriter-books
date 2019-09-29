import {escapeText} from "../../common"

/** A template for the book collaboration pane */
export const bookCollaboratorsTemplate = ({collaborators}) =>
    collaborators.map(collaborator =>
        `<tr id="collaborator-${collaborator.user_id}" data-id="${collaborator.user_id}"
        class="collaborator-tr" data-right="${collaborator.rights}">
            <td width="212">
                <span><img class="fw-avatar" src="${collaborator.avatar}" /></span>
                <span class="fw-inline">${escapeText(collaborator.user_name)}</span>
            </td>
            <td width="50" align="center">
                <div class="fw-inline edit-right-wrapper">
                    <i class="icon-access-right icon-access-${collaborator.rights}"></i>
                    <i class="fas fa-caret-down edit-right"></i>
                    <div class="fw-pulldown fw-left">
                        <ul>
                            <li>
                                <span class="fw-pulldown-item" data-right="write">
                                    <i class="icon-access-write" ></i>${gettext("Write")}
                                </span>
                            </li>
                            <li>
                                <span class="fw-pulldown-item" data-right="read">
                                    <i class="icon-access-read"></i>${gettext("Read")}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
            </td>
            <td width="50" align="center">
                <span class="delete-collaborator fw-inline" data-right="delete">
                    <i class="fas fa-trash-alt fw-link-text"></i>
                </span>
            </td>
        </tr>`
    ).join('')

    /** A template for the book access rights overview */
    export const bookAccessRightOverviewTemplate = ({contacts, collaborators}) =>
        `<div id="my-contacts" class="fw-ar-container">
            <h3 class="fw-green-title">${gettext("My contacts")}</h3>
            <table class="fw-data-table">
                <thead class="fw-data-table-header">
                    <tr>
                        <th width="332">${gettext("Contacts")}</th>
                    </tr>
                </thead>
                <tbody class="fw-data-table-body fw-small">
                    ${
                        contacts.map(contact =>
                            `<tr>
                                <td width="332" data-id="${contact.id}"
                                        data-avatar="${contact.avatar}"
                                        data-name="${escapeText(contact.name)}"
                                        class="fw-checkable fw-checkable-td">
                                    <span>
                                        <img class="fw-avatar" src="${contact.avatar}" />
                                    </span>
                                    <span class="fw-inline">${escapeText(contact.name)}</span>
                                </td>
                            </tr>`
                        ).join('')
                    }
                </tbody>
            </table>
        </div>
        <span id="add-share-member" class="fw-button fw-large fw-square fw-light fw-ar-button">
            <i class="fas fa-caret-right"></i>
        </span>
        <div id="share-member" class="fw-ar-container">
            <h3 class="fw-green-title">${gettext("My collaborators")}</h3>
            <table class="fw-data-table tablesorter">
                <thead class="fw-data-table-header"><tr>
                        <th width="212">${gettext("Collaborators")}</th>
                        <th width="50" align="center">${gettext("Rights")}</th>
                        <th width="50" align="center">${gettext("Delete")}</th>
                </tr></thead>
                <tbody class="fw-data-table-body fw-small">${bookCollaboratorsTemplate({
                    collaborators
                })}</tbody>
            </table>
        </div>`
