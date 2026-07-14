import {BITSBookExporter} from "@fiduswriter/books-document/exporter/bits"
import {DOCXBookExporter} from "@fiduswriter/books-document/exporter/docx"
import {EpubBookExporter} from "@fiduswriter/books-document/exporter/epub"
import {HTMLBookExporter} from "@fiduswriter/books-document/exporter/html"
import {LatexBookExporter} from "@fiduswriter/books-document/exporter/latex"
import {NativeBookExporter} from "@fiduswriter/books-document/exporter/native"
import {ODTBookExporter} from "@fiduswriter/books-document/exporter/odt"
import {PrintBookExporter} from "@fiduswriter/books-document/exporter/print"
import {getMissingChapterData} from "@fiduswriter/books-document/exporter/tools"
import download from "downloadjs"
import {FileDialog, NewFolderDialog, addAlert, addProgress} from "fwtoolkit"
import {BookAccessRightsDialog} from "./accessrights"
import {chapterLoader} from "./adapters/chapter-loader"
import {e2eeStrategy} from "./adapters/e2ee-strategy"

let currentlySearching = false

/**
 * Load any missing chapter data (fetching content lazily and decrypting E2EE
 * chapters), run the given exporter, then trigger a browser download of the
 * resulting Blob.
 *
 * The @fiduswriter/books-document exporters are environment-agnostic: they
 * load chapter data through injected strategies (defaulting to no-ops) and
 * their base `download()` simply returns the produced Blob. In the browser we
 * therefore pre-load the chapter data with the core-backed adapters — after
 * which the exporter's own internal `getMissingChapterData` call is a no-op —
 * and deliver the finished Blob to the user via downloadjs.
 *
 * @param {Object} exporter - A constructed book exporter instance.
 * @param {Object} overview - The BookOverview page.
 * @param {string} mimeType - MIME type for the downloaded file.
 * @param {boolean} rawContent - Whether the exporter needs doc.rawContent.
 * @returns {Promise}
 */
const runBookExport = (exporter, overview, mimeType, rawContent = false) => {
    const formatName =
        exporter.defaultFilename.split(".").pop()?.toUpperCase() ||
        gettext("Book")
    const task = addProgress(
        "info",
        `${exporter.book.title}: ${gettext("Exporting")} ${formatName}...`,
        {autoClose: 6000}
    )
    const progressCallback = (message, percentage) =>
        task.update(percentage, message)

    return getMissingChapterData(
        exporter.book,
        overview.documentList,
        overview.schema,
        {
            rawContent,
            loader: chapterLoader,
            e2ee: e2eeStrategy,
            progressCallback
        }
    )
        .then(() => exporter.init(progressCallback))
        .then(blob => {
            task.update(100, gettext("Export complete."))
            if (blob) {
                download(blob, exporter.defaultFilename, mimeType)
            }
            return blob
        })
        .catch(error => {
            task.close()
            addAlert("error", error.message || gettext("Book export failed."))
        })
}

export const menuModel = () => ({
    content: [
        {
            type: "text",
            title: gettext("Create new book"),
            keys: "Alt-n",
            action: overview => {
                overview.getImageDB().then(() => {
                    overview.mod.actions.createBookDialog(0, overview.imageDB)
                })
            },
            order: 1
        },
        {
            type: "text",
            title: gettext("Create new folder"),
            keys: "Alt-f",
            action: overview => {
                const dialog = new NewFolderDialog(folderName => {
                    overview.path = overview.path + folderName + "/"
                    window.history.pushState({}, "", "/books" + overview.path)
                    overview.initTable()
                })
                dialog.open()
            },
            order: 2
        },
        {
            type: "text",
            title: gettext("Import book from Fidusbook file"),
            keys: "Alt-i",
            action: overview => {
                overview.mod.actions.importBook()
            },
            order: 3
        },
        {
            type: "search",
            icon: "search",
            title: gettext("Search books"),
            keys: "s",
            input: (overview, text) => {
                if (text.length && !currentlySearching) {
                    overview.initTable(true)
                    currentlySearching = true
                    overview.table.on("datatable.init", () =>
                        overview.table.search(text)
                    )
                } else if (!text.length && currentlySearching) {
                    overview.initTable(false)
                    currentlySearching = false
                } else if (text.length) {
                    overview.table.search(text)
                }
            },
            order: 4
        }
    ]
})

const exportEpub = (book, overview) => {
    const exporter = new EpubBookExporter(
        overview.schema,
        overview.app.csl,
        overview.styles,
        book,
        overview.user,
        overview.documentList,
        new Date(book.updated * 1000)
    )
    return runBookExport(exporter, overview, "application/epub+zip")
}

const exportBITS = (book, overview) => {
    const exporter = new BITSBookExporter(
        overview.schema,
        overview.app.csl,
        book,
        overview.user,
        overview.documentList,
        new Date(book.updated * 1000)
    )
    return runBookExport(exporter, overview, "application/zip")
}

const exportHTML = (book, overview) => {
    const exporter = new HTMLBookExporter(
        overview.schema,
        overview.app.csl,
        overview.styles,
        book,
        overview.user,
        overview.documentList,
        new Date(book.updated * 1000)
    )
    return runBookExport(exporter, overview, "application/zip")
}

const exportSingleHTML = (book, overview) => {
    const exporter = new HTMLBookExporter(
        overview.schema,
        overview.app.csl,
        overview.styles,
        book,
        overview.user,
        overview.documentList,
        new Date(book.updated * 1000),
        false
    )
    return runBookExport(exporter, overview, "application/zip")
}

const exportLatex = (book, overview) => {
    const exporter = new LatexBookExporter(
        overview.schema,
        book,
        overview.user,
        overview.documentList,
        new Date(book.updated * 1000)
    )
    return runBookExport(exporter, overview, "application/zip")
}

const exportDOCX = (book, overview) => {
    const exporter = new DOCXBookExporter(
        overview.schema,
        overview.app.csl,
        book,
        overview.user,
        overview.documentList,
        new Date(book.updated * 1000)
    )
    return runBookExport(exporter, overview, exporter.mimeType, true)
}

const exportODT = (book, overview) => {
    const exporter = new ODTBookExporter(
        overview.schema,
        overview.app.csl,
        book,
        overview.user,
        overview.documentList,
        new Date(book.updated * 1000)
    )
    return runBookExport(exporter, overview, exporter.mimeType, true)
}

const exportPrint = (book, overview) => {
    const exporter = new PrintBookExporter(
        overview.schema,
        overview.app.csl,
        overview.styles,
        book,
        overview.user,
        overview.documentList
    )
    return runBookExport(exporter, overview, "text/html")
}

const exportFidusbook = (book, overview) => {
    const exporter = new NativeBookExporter(
        overview.schema,
        book,
        overview.user,
        overview.documentList,
        new Date(book.updated * 1000)
    )
    return runBookExport(exporter, overview, "application/fidusbook+zip")
}

export const bulkMenuModel = () => ({
    content: [
        {
            title: gettext("Move selected"),
            tooltip: gettext("Move the books that have been selected."),
            action: overview => {
                const ids = overview.getSelected()
                const books = ids.map(id =>
                    overview.bookList.find(book => book.id === id)
                )
                if (books.length) {
                    const dialog = new FileDialog({
                        title:
                            books.length > 1
                                ? gettext("Move books")
                                : gettext("Move book"),
                        movingFiles: books,
                        allFiles: overview.bookList,
                        moveUrl: "/api/book/move/",
                        successMessage: gettext("Book has been moved"),
                        errorMessage: gettext("Could not move book"),
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
            title: gettext("Delete selected"),
            tooltip: gettext("Delete selected books."),
            action: overview => {
                const ids = overview.getSelected()
                const ownIds = ids.filter(id => {
                    const book = overview.bookList.find(book => (book.id = id))
                    return book.is_owner
                })
                if (ownIds.length !== ids.length) {
                    addAlert(
                        "error",
                        gettext("You cannot delete books of other users.")
                    )
                }
                if (ownIds.length) {
                    overview.mod.actions.deleteBookDialog(ownIds)
                }
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext("Share selected"),
            tooltip: gettext("Share selected books."),
            action: overview => {
                const ids = overview.getSelected()
                const ownIds = ids.filter(id => {
                    const book = overview.bookList.find(book => (book.id = id))
                    return book.is_owner
                })
                if (ownIds.length !== ids.length) {
                    addAlert(
                        "error",
                        gettext("You cannot share books of other users.")
                    )
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
            title: gettext("Copy selected"),
            tooltip: gettext("Copy selected books."),
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
            title: gettext("Export selected as BITS"),
            tooltip: gettext("Export selected books as BITS."),
            action: overview => {
                const ids = overview.getSelected()
                ids.forEach(id => {
                    const book = overview.bookList.find(book => book.id === id)
                    exportBITS(book, overview)
                })
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext("Export selected as Epub"),
            tooltip: gettext("Export selected books as Epub."),
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
            title: gettext("Export selected as HTML"),
            tooltip: gettext("Export selected books as HTML."),
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
            title: gettext("Export selected as Unified HTML"),
            tooltip: gettext("Export selected books as Single-file HTML."),
            action: overview => {
                const ids = overview.getSelected()
                ids.forEach(id => {
                    const book = overview.bookList.find(book => book.id === id)
                    exportSingleHTML(book, overview)
                })
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext("Export selected as LaTeX"),
            tooltip: gettext("Export selected books as LaTeX."),
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
            title: gettext("Export selected as DOCX"),
            tooltip: gettext("Export selected books as DOCX."),
            action: overview => {
                const ids = overview.getSelected()
                ids.forEach(id => {
                    const book = overview.bookList.find(book => book.id === id)
                    if (book.docx_template) {
                        exportDOCX(book, overview)
                    } else {
                        addAlert(
                            "error",
                            book.title +
                                ": " +
                                gettext(
                                    "This book does not have a DOCX template."
                                )
                        )
                    }
                })
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext("Export selected as ODT"),
            tooltip: gettext("Export selected books as ODT."),
            action: overview => {
                const ids = overview.getSelected()
                ids.forEach(id => {
                    const book = overview.bookList.find(book => book.id === id)
                    if (book.odt_template) {
                        exportODT(book, overview)
                    } else {
                        addAlert(
                            "error",
                            book.title +
                                ": " +
                                gettext(
                                    "This book does not have an ODT template."
                                )
                        )
                    }
                })
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext("Export selected to Print/PDF"),
            tooltip: gettext("Export selected books to the print dialog."),
            action: overview => {
                const ids = overview.getSelected()
                ids.forEach(id => {
                    const book = overview.bookList.find(book => book.id === id)
                    exportPrint(book, overview)
                })
            },
            disabled: overview => !overview.getSelected().length
        },
        {
            title: gettext("Export selected as Fidusbook"),
            tooltip: gettext(
                "Export selected books as .fidusbook files (for moving to another server)."
            ),
            action: overview => {
                const ids = overview.getSelected()
                ids.forEach(id => {
                    const book = overview.bookList.find(book => book.id === id)
                    exportFidusbook(book, overview)
                })
            },
            disabled: overview => !overview.getSelected().length
        }
    ]
})

export const exportMenuModel = () => ({
    content: [
        {
            type: "action",
            title: gettext("Export as BITS"),
            tooltip: gettext("Export book as Book Interchange Tag Set."),
            action: ({saveBook, book, overview}) => {
                saveBook().then(() => exportBITS(book, overview))
            }
        },
        {
            type: "action",
            title: gettext("Export as Epub"),
            tooltip: gettext("Export book as Epub."),
            action: ({saveBook, book, overview}) => {
                saveBook().then(() => exportEpub(book, overview))
            }
        },
        {
            type: "action",
            title: gettext("Export as HTML"),
            tooltip: gettext("Export book as HTML."),
            action: ({saveBook, book, overview}) => {
                saveBook().then(() => exportHTML(book, overview))
            }
        },
        {
            type: "action",
            title: gettext("Export as Unified HTML"),
            tooltip: gettext("Export book as Single-file HTML."),
            action: ({saveBook, book, overview}) => {
                saveBook().then(() => exportSingleHTML(book, overview))
            }
        },
        {
            type: "action",
            title: gettext("Export as LaTeX"),
            tooltip: gettext("Export book as LaTeX."),
            action: ({saveBook, book, overview}) => {
                saveBook().then(() => exportLatex(book, overview))
            }
        },
        {
            type: "action",
            title: gettext("Export as DOCX"),
            tooltip: gettext("Export book as DOCX."),
            action: ({saveBook, book, overview}) => {
                saveBook().then(() => exportDOCX(book, overview))
            },
            disabled: ({book}) => !book.docx_template
        },

        {
            type: "action",
            title: gettext("Export as ODT"),
            tooltip: gettext("Export book as ODT."),
            action: ({saveBook, book, overview}) => {
                saveBook().then(() => exportODT(book, overview))
            },
            disabled: ({book}) => !book.odt_template
        },
        {
            type: "action",
            title: gettext("Export to Print/PDF"),
            tooltip: gettext("Export book to the print dialog."),
            action: ({saveBook, book, overview}) => {
                saveBook().then(() => exportPrint(book, overview))
            }
        },
        {
            type: "action",
            title: gettext("Export as Fidusbook"),
            tooltip: gettext(
                "Export book as a .fidusbook file (for moving to another server)."
            ),
            action: ({saveBook, book, overview}) => {
                saveBook().then(() => exportFidusbook(book, overview))
            }
        }
    ]
})
