import {printHTML} from "@vivliostyle/print"

import {HTMLBookExporter} from "../html"
import {chapterTemplate} from "./templates"

export class PrintBookExporter extends HTMLBookExporter {
    constructor(schema, csl, documentStyles, book, user, docList) {
        super(schema, csl, documentStyles, book, user, docList, false, false, {
            relativeUrls: false
        })
        this.chapterTemplate = chapterTemplate
    }

    addBookStyle() {
        const bookStyle = this.bookStyles.find(
            bookStyle => bookStyle.slug === this.book.settings.book_style
        )
        if (!bookStyle) {
            return false
        }
        let contents = bookStyle.contents
        bookStyle.bookstylefile_set.forEach(
            ([url, filename]) =>
                (contents = contents.replace(
                    new RegExp(filename, "g"),
                    url // Use original URL
                ))
        )

        this.styleSheets.push({contents})
    }

    async createZip() {
        const htmlDoc = this.textFiles.find(
            file => file.filename === "index.html"
        ).contents
        const config = {title: this.book.title}

        if (navigator.userAgent.includes("Gecko/")) {
            // Firefox has issues printing images when in iframe. This workaround can be
            // removed once that has been fixed. TODO: Add gecko bug number if there is one.
            config.printCallback = iframeWin => {
                const oldBody = document.body
                document.body.parentElement.dataset.vivliostylePaginated = true
                document.body = iframeWin.document.body
                iframeWin.document
                    .querySelectorAll("style")
                    .forEach(el => document.body.appendChild(el))
                const backgroundStyle = document.createElement("style")
                backgroundStyle.innerHTML = "body {background-color: white;}"
                document.body.appendChild(backgroundStyle)
                window.print()
                document.body = oldBody
                delete document.body.parentElement.dataset.vivliostylePaginated
            }
        }

        printHTML(htmlDoc, config)
    }

    async loadStyle(sheet) {
        if (sheet.url) {
            sheet.filename = sheet.url
            delete sheet.url
        }
        return await Promise.resolve(sheet)
    }
}
