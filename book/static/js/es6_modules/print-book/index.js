import {bookPrintStartTemplate, bookPrintTemplate} from "./templates"
import {docSchema} from "../schema/document"
import {RenderCitations} from "../citations/render"
import {BibliographyDB} from "../bibliography/database"
import {deactivateWait, addAlert, csrfToken} from "../common"
import {PaginateForPrint} from "paginate-for-print/dist/paginate-for-print"
/**
* Helper functions for the book print page.
*/

export class PrintBook {
    // A class that contains everything that happens on the book print page.
    // It is currently not possible to initialize more thna one editor class, as it
    // contains bindings to menu items, etc. that are uniquely defined.
    constructor() {
        this.pageSizes = {
            folio: {
                width:12,
                height:15
            },
            quarto: {
                width:9.5,
                height:12
            },
            octavo: {
                width:6,
                height:9
            },
            a5: {
                width:5.83,
                height:8.27
            },
            a4: {
                width:8.27,
                height:11.69
            }
        }
        this.documentOwners = []
        this.printConfig = {
            enableFrontmatter: true,
            sectionStartSelector: 'div.part',
            sectionTitleSelector: 'h1',
            chapterStartSelector: 'div.chapter',
            chapterTitleSelector: 'h1',
            alwaysEven: true,
            autoStart: false,
            topfloatSelector: 'figure',
            contentsBottomMargin: 1
        }

        this.bindEvents()
    }

    setDocumentStyle() {
        let docStyle = this.documentStyles.find(
            docStyle => docStyle.filename === this.book.settings.documentstyle
        )
        if (docStyle) {
            let styleEl = document.createElement('style')
            styleEl.innerHTML = docStyle.contents
            document.head.appendChild(styleEl)
        }
    }

    setTheBook(book) {
        book.settings = JSON.parse(book.settings)
        book.metadata = JSON.parse(book.metadata)
        for (let i = 0; i < book.chapters.length; i++) {
            book.chapters[i].contents = JSON.parse(book.chapters[
                i].contents)
            if (this.documentOwners.indexOf(book.chapters[i].owner)===-1) {
                this.documentOwners.push(book.chapters[i].owner)
            }
        }
        this.book = book
        this.setDocumentStyle()

        this.printConfig['pageHeight'] = this.pageSizes[this.book.settings.papersize].height
        this.printConfig['pageWidth'] = this.pageSizes[this.book.settings.papersize].width

        this.bibDB = new BibliographyDB(this.documentOwners.join(','))

        this.bibDB.getDB().then(() => this.fillPrintPage())

    }

    getBookData(id) {
        jQuery.ajax({
            url: '/book/book/',
            data: {id},
            type: 'POST',
            dataType: 'json',
            crossDomain: false, // obviates need for sameOrigin test
            beforeSend: (xhr, settings) =>
                xhr.setRequestHeader("X-CSRFToken", csrfToken),
            success: (response, textStatus, jqXHR) => {
                this.citationStyles = response.citation_styles
                this.citationLocales = response.citation_locales
                this.documentStyles = response.document_styles
                this.setTheBook(response.book)
            },
            error: (jqXHR, textStatus, errorThrown) =>
                addAlert('error', jqXHR.responseText),
            complete: () => deactivateWait()
        })
    }

    fillPrintPage() {
        document.getElementById('book').outerHTML = bookPrintTemplate({
            book: this.book,
            docSchema
        })

        this.citRenderer = new RenderCitations(
            document.body,
            this.book.settings.citationstyle,
            this.bibDB,
            this.citationStyles,
            this.citationLocales,
            true
        )
        this.citRenderer.init().then(
            () => this.fillPrintPageTwo()
        )
    }

    fillPrintPageTwo() {
        let bibliography = jQuery('#bibliography')
        jQuery(bibliography).html(this.citRenderer.fm.bibHTML)

        if (jQuery(bibliography).text().trim().length===0) {
            jQuery(bibliography).parent().remove()
        }

        // Move the bibliography header text into the HTML, to prevent it getting mangled by the pagination process.
        let bibliographyHeader = document.querySelector('.article-bibliography-header')
        if (bibliographyHeader) {
            let bibliographyHeaderText = window.getComputedStyle(bibliographyHeader, ':before').getPropertyValue('content').replace(/"/g, '')
            bibliographyHeader.innerHTML = bibliographyHeaderText
            bibliographyHeader.classList.remove('article-bibliography-header')
        }


        this.printConfig['frontmatterContents'] = bookPrintStartTemplate(
            {book: this.book}
        )
        this.printConfig['flowFromElement'] = document.getElementById('flow')
        this.printConfig['flowToElement'] = document.getElementById('flow')

        let paginator = new PaginateForPrint(this.printConfig)
        paginator.initiate()
        jQuery("#pagination-contents").addClass('user-contents')
        jQuery('head title').html(jQuery('.article-title').text())

    }

    bindEvents() {
        jQuery(document).ready(() => {
            let pathnameParts = window.location.pathname.split('/'),
                bookId = parseInt(pathnameParts[pathnameParts.length -
                    2], 10)

            this.getBookData(bookId)
        })
    }
}
