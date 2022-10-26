import {escapeText, longFilePath, localizeDate} from "../common"
import {LANGUAGES} from "../schema/const"

/** A template for the basic info book template pane */
export const bookBasicInfoTemplate = ({book}) =>
    `<table class="fw-dialog-table">
        <tbody>
            <tr>
                <th>
                    <h4 class="fw-tablerow-title">${gettext("Title")}</h4>
                </th>
                <td>
                    <input class="entryForm" type="text" id="book-title"
                            value="${escapeText(book.title)}"
                            ${
    book.rights === "read" ?
        "disabled=\"disabled\"" :
        ""
}
                    >
                </td>
            </tr>
            <tr>
                <th>
                    <h4 class="fw-tablerow-title">${gettext("Author")}</h4>
                </th>
                <td>
                    <input class="entryForm" type="text" id="book-metadata-author"
                            value="${escapeText(book.metadata.author)}"
                            ${
    book.rights === "read" ?
        "disabled=\"disabled\"" :
        ""
}
                    >
                </td>
            </tr>
            <tr>
                <th>
                    <h4 class="fw-tablerow-title">${gettext("Subtitle")}</h4>
                </th>
                <td>
                    <input class="entryForm" type="text" id="book-metadata-subtitle"
                            value="${escapeText(book.metadata.subtitle)}"
                            ${
    book.rights === "read" ?
        "disabled=\"disabled\"" :
        ""
}
                    >
                </td>
            </tr>
            <tr>
                <th>
                    <h4 class="fw-tablerow-title">${gettext("Version")}</h4>
                </th>
                <td>
                    <input class="entryForm" type="text" id="book-metadata-version"
                            value="${escapeText(book.metadata.version)}"
                            ${
    book.rights === "read" ?
        "disabled=\"disabled\"" :
        ""
}
                    >
                </td>
            </tr>
            <tr>
                <th>
                    <h4 class="fw-tablerow-title">${gettext("Language")}</h4>
                </th>
                <td>
                    <select class="entryForm dk" name="book-settings-language"
                            title="${gettext("Select language")}"
                            id="book-settings-language"
                            ${
    book.rights === "read" ?
        "disabled=\"disabled\"" :
        ""
}
                    >
                        ${
    LANGUAGES.map(language =>
        `<option value="${language[0]}"
                                        ${
    language[0] === book.settings.language ?
        "selected" :
        ""
}
                                >
                                    ${escapeText(language[1])}
                                </option>`
    ).join("")
}
                    </select>
                </td>
            </tr>
            <tr>
                <th>
                    <h4 class="fw-tablerow-title">${gettext("Publisher")}</h4>
                </th>
                <td>
                    <input class="entryForm" type="text" id="book-metadata-publisher"
                            value="${escapeText(book.metadata.publisher)}"
                            ${
    book.rights === "read" ?
        "disabled=\"disabled\"" :
        ""
}
                    >
                </td>
            </tr>
            <tr>
                <th>
                    <h4 class="fw-tablerow-title">${gettext("Copyright notice")}</h4>
                </th>
                <td>
                    <input class="entryForm" type="text" id="book-metadata-copyright"
                            value="${escapeText(book.metadata.copyright)}"
                            ${
    book.rights === "read" ?
        "disabled=\"disabled\"" :
        ""
}
                    >
                </td>
            </tr>
            <tr>
                <th>
                    <h4 class="fw-tablerow-title" title="${gettext("Comma separated keywords")}">
                        ${gettext("Keywords")}
                    </h4>
                </th>
                <td>
                    <input class="entryForm" type="text" id="book-metadata-keywords"
                            value="${book.metadata.keywords}"
                            ${
    book.rights === "read" ?
        "disabled=\"disabled\"" :
        ""
}
                    >
                </td>
            </tr>
        </tbody>
    </table>`


/** A template for the citation style pane of the book dialog */
export const bookBibliographyDataTemplate = ({book, citationStyles}) =>
    `<table class="fw-dialog-table">
        <tbody>
            <tr>
                <th>
                    <h4 class="fw-tablerow-title">${gettext("Citation style")}</h4>
                </th>
                <td>
                    <select class="entryForm" name="book-settings-citationstyle"
                        title="${gettext("Select citation style for the book")}"
                        id="book-settings-citationstyle"
                        ${
    book.rights === "read" ?
        "disabled=\"disabled\"" :
        ""
}
                    >
                    ${
    Object.entries(citationStyles).map(([key, value]) =>
        `<option value="${key}" ${
            key === book.settings.citationstyle ?
                "selected" :
                ""
        }>
                                ${value}
                            </option>`
    ).join("")
}
                    </select>
                </td>
            </tr>
        </tbody>
    </table>`

const paperSizes =
    [
        ["folio", gettext("Folio (15 x 12 inch)")],
        ["quarto", gettext("Quarto (12 × 9 inch)")],
        ["octavo", gettext("Octavo (9 x 6 inch)")],
        ["a5", gettext("A5")],
        ["a4", gettext("A4")]
    ]

/** A template for the print related data pane of the book dialog */
export const bookPrintDataTemplate = ({book, bookStyleList}) =>
    `<table class="fw-dialog-table">
        <tbody>
            <tr>
                <th>
                    <h4 class="fw-tablerow-title">${gettext("Book style")}</h4>
                </th>
                <td>
                    <select class="entryForm dk" name="book-settings-bookstyle"
                            title="${gettext("Select stylesheet for the book")}"
                            id="book-settings-bookstyle"
                            ${
    book.rights === "read" || !bookStyleList.length ?
        "disabled=\"disabled\"" :
        ""
}
                    >
                        ${
    bookStyleList.map(bookStyle =>
        `<option value="${bookStyle.slug}"
                                        ${
    bookStyle.slug === book.settings.book_style ?
        "selected" :
        ""
}
                                >
                                    ${escapeText(bookStyle.title)}
                                </option>`
    ).join("")
}
                    </select>
                </td>
            </tr>
            <tr>
                <th>
                    <h4 class="fw-tablerow-title">${gettext("Paper size")}</h4>
                </th>
                <td>
                <select class="entryForm dk" name="book-settings-papersize"
                        title="${gettext("Select paper size for the book")}"
                        id="book-settings-papersize"
                        ${
    book.rights === "read" ?
        "disabled=\"disabled\"" :
        ""
}
                >
                    ${
    paperSizes.map(size =>
        `<option value="${size[0]}" ${
            size[0] === book.settings.papersize ?
                "selected" :
                ""
        }>
                                ${size[1]}
                            </option>`
    ).join("")
}
                </select>
                </td>
            </tr>
        </tbody>
    </table>`

/** A template for the cover image input on the epub pane of the book dialog. */
export const bookEpubDataCoverTemplate = ({book, imageDB}) =>
    `<th class="figure-preview-row">
            <h4 class="fw-tablerow-title">${gettext("Cover image")}</h4>
        </th>
        <td>
        ${
    book.cover_image ?
        `<div class="img" style="background-image: url(${imageDB.db[book.cover_image].image});" title="${gettext("Cover image")}"></div>` :
        ""
}
        </td>
        ${
    book.rights === "write" ?
        `<td class="figure-preview-row">
                <button type="button" class="ui-button ui-widget ui-state-default
                        ui-corner-all ui-button-text-only fw-button fw-dark"
                        id="select-cover-image-button" role="button" aria-disabled="false" title="${gettext("Select a cover image")}">
                    <span class="ui-button-text">${gettext("Select Image")}</span>
                </button>
                ${
    book.cover_image ?
        `<button type="button" class="ui-button ui-widget ui-state-default
                            ui-corner-all ui-button-text-only fw-button fw-orange"
                            id="remove-cover-image-button" role="button" aria-disabled="false"  title="${gettext("Remove cover image")}">
                        <span class="ui-button-text">${gettext("Remove Image")}</span>
                    </button>` :
        ""
}
            </td>` :
        ""
}`

/** A template for the epub related data pane of the book dialog */
export const bookEpubDataTemplate = ({book, imageDB}) =>
    `<table class="fw-dialog-table fw-media-uploader">
        <tbody>
            <tr id="figure-preview-row">
                ${bookEpubDataCoverTemplate({
        book,
        imageDB
    })}
            </tr>
        </tbody>
    </table>`


export const bookSanityCheckTemplate = () =>
    `<table class="fw-dialog-table">
        <tbody>
            <tr>
                <th>
                    <button type="button" id="perform-sanity-check-button" class="ui-button fw-button fw-dark">${gettext("Perform sanity check")}</button>
                </th>
                <td id="sanity-check-output"></td>
            </tr>
        </tbody>
    </table>`

/** A template for the book dialog. */
export const bookDialogTemplate = ({
    title,
    bookInfo,
    dialogParts
}) =>
    `<div id="book-dialog" title="${title}">
        <div id="bookoptions-tab">
            <ul class="ui-tabs-nav">
                ${
    dialogParts.map(
        (part, index) =>
            `<li class="tab-link current-tab">
                                <a href="#optionTab${index}" class="tab-link-inner" title="${escapeText(part.description)}">
                                    ${escapeText(part.title)}
                                    </a>
                            </li>`
    ).join("")
}
            </ul>
            ${
    dialogParts.map(
        (part, index) =>
            `<div class="tab-content ui-tabs-panel" id="optionTab${index}" title="${escapeText(part.description)}">
                            ${part.template(bookInfo)}
                        </div>`
    ).join("")
}
        </div>
    </div>`

/** A template for the chapter pane of the book dialog. */
export const bookDialogChaptersTemplate = ({book, documentList}) =>
    `${
        book.rights === "write" ?
            `<div class="fw-ar-container">
            <h3 class="fw-green-title">${gettext("My documents")}</h3>
            <div id="book-document-list"></div>
        </div>
        <span id="add-chapter" class="fw-button fw-large fw-square fw-light fw-ar-button">
            <i class="fas fa-caret-right"></i>
        </span>` :
            ""
    }
    <div class="fw-ar-container">
        <h3 class="fw-green-title">${gettext("Book chapters")}</h3>
        <table class="fw-data-table">
            <thead class="fw-data-table-header">
                <tr>
                    <th colspan="2">${gettext("Title")}</th>
                    <th colspan="2">${gettext("Sort")}</th>
                    ${
    book.rights === "write" ?
        "<th>&emsp;</th>" :
        ""
}
                </tr>
            </thead>
            <tbody class="fw-data-table-body fw-small" id="book-chapter-list">
                ${bookChapterListTemplate({
        book,
        documentList
    })}
            </tbody>
        </table>
    </div>`

/** A template for the chapter list on the chapter pane the book dialog. */
export const bookChapterListTemplate = ({book, documentList}) => {
    let partCounter = 1
    return book.chapters.slice().sort(
        (a, b) => a.number - b.number
    ).map((chapter, index, array) => {
        const doc = documentList.find(doc => doc.id === chapter.text)
        return `<tr
                ${doc ? "" : "class=\"noaccess\""}
            >
                <td width="222" data-id="${chapter.text}" class="fw-checkable-td" ${
    doc ? `title="${longFilePath(doc.title, doc.path)}"` : ""
}>
                <span class="fw-inline">
                    ${doc ? "" : "<i class=\"fas fa-minus-circle\"></i>"}
                    ${
    chapter.part.length ?
        `<b class="part">
                            ${partCounter++}. ${gettext("Book part")}:
                            ${escapeText(chapter.part)}
                        </b>
                        <br>` :
        ""
}
                    ${chapter.number}
                    ${
    doc ? doc.title ? doc.title : gettext("Untitled") : gettext("No access")
}
                </span>
            </td>
            ${
    book.rights === "write" ?
        `<td width="30" data-id="${chapter.text}" class="edit-chapter">
                    <i class="fas fa-pencil-alt fw-link-text"></i>
                </td>
                ${
    index === 0 ?
        "<td width=\"10\"></td>" :
        `<td width="10" class="book-sort-up" data-id="${chapter.text}">
                        <i class="fas fa-sort-up"></i>
                    </td>`
}
                ${
    index + 1 === array.length ?
        "<td width=\"10\"></td>" :
        `<td width="10" class="book-sort-down" data-id="${chapter.text}">
                        <i class="fas fa-sort-down"></i>
                    </td>`
}
                <td width="50" align="center">
                    <span class="delete-chapter fw-inline" data-id="${chapter.text}">
                        <i class="fas fa-trash-alt fw-link-text"></i>
                    </span>
                </td>` :
        `<td width="30"></td>
                <td width="10"></td>
                <td width="10"></td>
                <td width="50"></td>`
}
        </tr>`
    }).join("")
}

/** A template for the chapter dialog for books */
export const bookChapterDialogTemplate = ({chapter}) =>
    `<table class="fw-dialog-table">
        <tr>
            <th>
                <h4 title="${
    gettext("If this chapter starts a part of the book, specify the title of that part here")
}">
                    ${gettext("Book part title")}
                </h4>
            </th>
            <td>
                <input type="text" id="book-chapter-part"
                        value="${escapeText(chapter.part)}">
            </td>
       </tr>
       </table>`

export const deleteFolderCell = ({subdir, ids}) =>
    `<span class="delete-folder fw-link-text" data-ids="${ids.join(",")}"
         data-title="${escapeText(subdir)}">
         '<i class="fa fa-trash-alt"></i>
 </span>`

export const dateCell = ({date}) =>
    `<span class="date">${localizeDate(date * 1000, "sortable-date")}</span>`
