import {escapeText} from "../common"

/** A template for the list of books */
export let bookListTemplate = ({bookList, user}) =>
    Object.values(bookList).map(book =>
        `<tr id="Book_${book.id}" ${
            user.id === book.owner ?
            'class="owned-by-user"' :
            ''
        }>
            <td width="20">
                <span class="fw-inline">
                    <input type="checkbox" class="entry-select"
                            data-id="${book.id}"
                            data-owner="${book.owner}"/>
               </span>
            </td>
            <td width="280">
                <span class="fw-document-table-title fw-inline">
                    <i class="fa fa-book"></i>
                    <span class="book-title fw-link-text fw-searchable"
                            data-id="${book.id}">
                        ${
                            book.title.length ?
                            escapeText(book.title) :
                            gettext('Untitled')
                        }
                    </span>
                </span>
            </td>
            <td width="150">
                <span class="fw-inline">${book.added}</span>
            </td>
            <td width="140">
                <span class="fw-inline">${book.updated}</span>
            </td>
            <td width="210">
                <span>
                    <img class="fw-avatar" src="${book.owner_avatar}" />
                </span>
                <span class="fw-inline fw-searchable">${escapeText(book.owner_name)}</span>
            </td>
            <td width="80" align="center">
                <span class="rights fw-inline" data-id="<%- aBook.id %>">
                    <i data-id="${book.id}"
                            class="icon-access-right icon-access-${book.rights}"></i>
                </span>
            </td>
            <td width="40" align="center">
                <span class="delete-book fw-inline fw-link-text"
                        data-id="${book.id}" data-title="${escapeText(book.title)}">
                    ${
                        user.id === book.owner ?
                        '<i class="fa fa-trash-o"></i>' :
                        ''
                    }
               </span>
           </td>
       </tr>`
    ).join('')


/** A template for the basic info book template pane */
let bookBasicInfoTemplate = ({book}) =>
    `<tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Title")}</h4>
        </th>
        <td>
            <input class="entryForm" type="text" id="book-title"
                    value="${escapeText(book.title)}"
                    ${
                        book.rights === 'read' ?
                        'disabled="disabled"' :
                        ''
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
                        book.rights === 'read' ?
                        'disabled="disabled"' :
                        ''
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
                        book.rights === 'read' ?
                        'disabled="disabled"' :
                        ''
                    }
            >
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
                        book.rights === 'read' ?
                        'disabled="disabled"' :
                        ''
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
                        book.rights === 'read' ?
                        'disabled="disabled"' :
                        ''
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
                        book.rights === 'read' ?
                        'disabled="disabled"' :
                        ''
                    }
            >
        </td>
    </tr>`

/** A template for the citation style pane of the book dialog */
let bookBibliographyDataTemplate = ({book, citationDefinitions}) =>
    `<tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Citation style")}</h4>
        </th>
        <td>
        <select class="entryForm dk" name="book-settings-citationstyle"
                id="book-settings-citationstyle"
                ${
                    book.rights === 'read' ?
                    'disabled="disabled"' :
                    ''
                }
        >
            ${
                Object.entries(citationDefinitions.styles).map(([key, citationstyle]) =>
                    `<option value="${key}" ${
                        key === book.settings.citationstyle ?
                        'selected' :
                        ''
                    }>
                        ${escapeText(citationstyle.name)}
                    </option>`
                ).join('')
            }
        </select>
        </td>
    </tr>`

let paperSizes =
    [
        ["folio", gettext("Folio (15 x 12 inch)")],
        ["quarto", gettext("Quarto (12 × 9 inch)")],
        ["octavo", gettext("Octavo (9 x 6 inch)")],
        ["a5", gettext("A5")],
        ["a4",gettext("A4")]
    ]

/** A template for the print related data pane of the book dialog */
let bookPrintDataTemplate = ({book, documentStyleList}) =>
    `<tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Document style")}</h4>
        </th>
        <td>
            <select class="entryForm dk" name="book-settings-documentstyle"
                    id="book-settings-documentstyle"
                    ${
                        book.rights === 'read' ?
                        'disabled="disabled"' :
                        ''
                    }
            >
                ${
                    documentStyleList.map(docStyle =>
                        `<option value="${docStyle.filename}"
                                ${
                                    docStyle.filename === book.settings.documentstyle ?
                                    'selected' :
                                    ''
                                }
                        >
                            ${escapeText(docStyle.title)}
                        </option>`
                    ).join('')
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
                id="book-settings-papersize"
                ${
                    book.rights === 'read' ?
                    'disabled="disabled"' :
                    ''
                }
        >
            ${
                paperSizes.map(size =>
                    `<option value="${size[0]}" ${
                        size[0] === book.settings.papersize ?
                        'selected' :
                        ''
                    }>
                        ${size[1]}
                    </option>`
                ).join('')
            }
        </select>
        </td>
    </tr>`

/** A template for the cover image input on the epub pane of the book dialog. */
export let bookEpubDataCoverTemplate = ({book, imageDB}) =>
        `<th class="figure-preview-row">
            <h4 class="fw-tablerow-title">${gettext("Cover image")}</h4>
        </th>
        <td>
            <div class="figure-preview">
                <div id="inner-figure-preview">
                    ${
                        book.cover_image ?
                        `<img src="${imageDB.db[book.cover_image].image}">` :
                        ''
                    }
                </div>
            </div>
        </td>
        ${
            book.rights === "write" ?
            `<td class="figure-preview-row">
                <button type="button" class="ui-button ui-widget ui-state-default
                        ui-corner-all ui-button-text-only fw-button fw-dark"
                        id="select-cover-image-button" role="button" aria-disabled="false">
                    <span class="ui-button-text">${gettext('Select Image')}</span>
                </button>
                ${
                    book.cover_image ?
                    `<button type="button" class="ui-button ui-widget ui-state-default
                            ui-corner-all ui-button-text-only fw-button fw-orange"
                            id="remove-cover-image-button" role="button" aria-disabled="false">
                        <span class="ui-button-text">${gettext('Remove Image')}</span>
                    </button>` :
                    ''
                }
            </td>` :
            ''
        }`

/** A template for the epub related data pane of the book dialog */
let bookEpubDataTemplate = ({book, imageDB}) =>
    `<tr id="figure-preview-row">
        ${bookEpubDataCoverTemplate({
            book,
            imageDB
        })}
    </tr>`

/** A template for the book dialog. */
export let bookDialogTemplate = ({
    dialogHeader,
    citationDefinitions,
    documentStyleList,
    imageDB,
    book,
    documentList
}) =>
    `<div id="book-dialog" title="${dialogHeader}">
        <div id="bookoptionsTab">
            <ul>
                <li>
                    <a href="#optionTab1" class="fw-button fw-large">
                        ${gettext('Basic info')}
                    </a>
                </li>
                <li>
                    <a href="#optionTab2" class="fw-button fw-large">
                        ${gettext('Chapters')}
                    </a>
                </li>
                <li>
                    <a href="#optionTab3" class="fw-button fw-large">
                        ${gettext('Bibliography')}
                    </a>
                </li>
                <li>
                    <a href="#optionTab4" class="fw-button fw-large">
                        ${gettext('Epub')}
                    </a>
                </li>
                <li>
                    <a href="#optionTab5" class="fw-button fw-large">
                        ${gettext('Print/PDF')}
                    </a>
                </li>
            </ul>
            <div id="optionTab1">
                <table class="fw-dialog-table">
                    <tbody>
                        ${bookBasicInfoTemplate({book})}
                    </tbody>
                </table>
            </div>
            <div id="optionTab2">
                ${bookDialogChaptersTemplate({
                    book,
                    documentList,
                })}
            </div>
            <div id="optionTab3">
                <table class="fw-dialog-table">
                    <tbody>
                        ${bookBibliographyDataTemplate({
                            book,
                            citationDefinitions
                        })}
                    </tbody>
                </table>
            </div>
            <div id="optionTab4">
                <table class="fw-dialog-table fw-media-uploader">
                    <tbody>
                        ${bookEpubDataTemplate({
                            book,
                            imageDB
                        })}
                    </tbody>
                </table>
            </div>
            <div id="optionTab5">
                <table class="fw-dialog-table">
                    <tbody>
                        ${bookPrintDataTemplate({
                            book,
                            documentStyleList
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`

/** A template for the chapter pane of the book dialog. */
let bookDialogChaptersTemplate = ({book, documentList}) =>
    `${
        book.rights === "write" ?
        `<div class="fw-ar-container">
            <h3 class="fw-green-title">${gettext("My documents")}</h3>
            <table class="fw-document-table">
                <thead class="fw-document-table-header">
                    <tr>
                        <th width="332">${gettext("Documents")}</th>
                    </tr>
                </thead>
                <tbody class="fw-document-table-body fw-small" id="book-document-list">
                    ${bookDocumentListTemplate({
                        book,
                        documentList
                    })}
                </tbody>
            </table>
        </div>
        <span id="add-chapter" class="fw-button fw-large fw-square fw-light fw-ar-button">
            <i class="fa fa-caret-right"></i>
        </span>` :
        ''
    }
    <div class="fw-ar-container">
        <h3 class="fw-green-title">${gettext("Book chapters")}</h3>
        <table class="fw-document-table">
            <thead class="fw-document-table-header">
                <tr>
                    <th width="242">${gettext("Title")}</th>
                    <th width="30">${gettext("Sort")}</th>
                    ${
                        book.rights === "write" ?
                        `<th width="50">${gettext("Delete")}</th>` :
                        ''
                    }
                </tr>
            </thead>
            <tbody class="fw-document-table-body fw-small" id="book-chapter-list">
                ${bookChapterListTemplate({
                    book,
                    documentList
                })}
            </tbody>
        </table>
    </div>`

/** A template for the chapter list on the chapter pane the book dialog. */
export let bookChapterListTemplate = ({book, documentList}) => {
    let partCounter = 1
    return book.chapters.slice().sort(
        (a, b) => a.number > b.number
    ).map((chapter, index, array) => {
        let doc = documentList.find(doc => doc.id === chapter.text)
        return `<tr
                ${
                    typeof(doc) === "undefined" ?
                    'class="noaccess"' :
                    ''
                }
            >
                <td width="222" data-id="${chapter.text}" class="fw-checkable-td">
                <span class="fw-inline">
                    ${
                        typeof(doc) === "undefined" ?
                        '<i class="fa fa-minus-circle"></i>' :
                        ''
                    }
                    ${
                        chapter.part.length ?
                        `<b class="part">
                            ${partCounter++}. ${gettext('Book part')}:
                            ${escapeText(chapter.part)}
                        </b>
                        <br>` :
                        ''
                    }
                    ${chapter.number}
                    ${
                        doc.title.length ?
                        escapeText(doc.title) :
                        gettext('Untitled')
                    }
                </span>
            </td>
            ${
                book.rights === "write" ?
                `<td width="30" data-id="${chapter.text}" class="edit-chapter">
                    <i class="fa fa-pencil fw-link-text"></i>
                </td>
                ${
                    index === 0 ?
                    '<td width="10"></td>' :
                    `<td width="10" class="book-sort-up" data-id="${chapter.text}">
                        <i class="fa fa-sort-asc"></i>
                    </td>`
                }
                ${
                    index + 1 === array.length ?
                    `<td width="10" class="book-sort-down" data-id="${chapter.text}">
                        <i class="fa fa-sort-dsc fw-link-text"></i>
                    </td>` :
                    '<td width="10"></td>'
                }
                <td width="50" align="center">
                    <span class="delete-chapter fw-inline" data-id="${chapter.text}">
                        <i class="fa fa-trash-o fw-link-text"></i>
                    </span>
                </td>` :
                `<td width="30"></td>
                <td width="10"></td>
                <td width="10"></td>
                <td width="50"></td>`
            }
        </tr>`
    }).join('')
}

/** A template for the document list on the chapter pane of the book dialog */
export let bookDocumentListTemplate = ({documentList, book}) =>
    documentList.filter(
        // filter to only take documents that are NOT a chapter in the book
        doc => !(book.chapters.map(chapter => chapter.text).includes(doc.id))
    ).map(doc =>
        `<tr>
            <td width="332" data-id="${doc.id}" class="fw-checkable fw-checkable-td">
                <span class="fw-inline">
                    ${
                        doc.title.length ?
                        escapeText(doc.title) :
                        gettext('Untitled')
                    }
                </span>
            </td>
        </tr>`
    ).join('')

/** A template for the chapter dialog for books */
export let bookChapterDialogTemplate = ({dialogHeader, chapter}) =>
    `<div id="book-chapter-dialog" title="${dialogHeader}">
        <table class="fw-dialog-table">
            <tr>
                <th>
                    <h4 title="${
                        gettext('If this chapter starts a part of the book, specify the title of that part here')
                    }">
                        ${gettext('Book part title')}
                    </h4>
                </th>
                <td>
                    <input type="text" id="book-chapter-part"
                            value="${escapeText(chapter.part)}">
                </td>
           </tr>
       </table>
    </div>`
