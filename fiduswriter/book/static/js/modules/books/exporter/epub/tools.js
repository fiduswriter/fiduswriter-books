import {CATS} from "../../../schema/i18n"

export function styleEpubFootnotes(htmlEl) {
    // Converts RASH style footnotes into epub footnotes
    const fnListEl = htmlEl.querySelector("section.fnlist")
    if (!fnListEl) {
        // There are no footnotes.
        return htmlEl
    }
    fnListEl.setAttribute("role", "doc-endnotes")
    const footnotes = fnListEl.querySelectorAll("section[role=doc-footnote]")
    let footnoteCounter = 1
    footnotes.forEach(footnote => {
        const newFootnote = document.createElement("aside")
        newFootnote.setAttribute("epub:type", "footnote")
        newFootnote.id = footnote.id
        if (footnote.firstChild) {
            while (footnote.firstChild) {
                newFootnote.appendChild(footnote.firstChild)
            }
            newFootnote.firstChild.innerHTML =
                footnoteCounter + " " + newFootnote.firstChild.innerHTML
        } else {
            newFootnote.innerHTML = "<p>" + footnoteCounter + "</p>"
        }

        footnote.parentNode.replaceChild(newFootnote, footnote)
        footnoteCounter++
    })
    const footnoteMarkers = htmlEl.querySelectorAll("a.fn")
    let footnoteMarkerCounter = 1
    footnoteMarkers.forEach(fnMarker => {
        const newFnMarker = document.createElement("sup")
        const newFnMarkerLink = document.createElement("a")
        newFnMarkerLink.setAttribute("epub:type", "noteref")
        newFnMarkerLink.setAttribute("href", fnMarker.getAttribute("href"))
        newFnMarkerLink.innerHTML = footnoteMarkerCounter
        newFnMarker.appendChild(newFnMarkerLink)
        fnMarker.parentNode.replaceChild(newFnMarker, fnMarker)
        footnoteMarkerCounter++
    })

    return htmlEl
}

export function setLinks(htmlEl, docNum = 0) {
    const contentItems = []
    let title
    let idCount = 0

    htmlEl.querySelectorAll("div.doc-title,h1,h2,h3,h4,h5,h6").forEach(el => {
        title = el.textContent.trim()
        if (title !== "" || el.classList.contains("doc-title")) {
            const contentItem = {}
            contentItem.title = title
            contentItem.level = el.classList.contains("doc-title")
                ? 0
                : Number.parseInt(el.tagName.substring(1, 2))
            if (docNum) {
                contentItem.docNum = docNum
            }
            if (!el.id) {
                // The element has no ID, so we add one.
                el.id = `_${docNum}_${idCount++}`
            }
            contentItem.id = el.id
            contentItems.push(contentItem)
        }
    })
    return contentItems
}

export function orderLinks(contentItems) {
    for (let i = 0; i < contentItems.length; i++) {
        contentItems[i].subItems = []
        if (i > 0) {
            for (let j = i - 1; j > -1; j--) {
                if (contentItems[j].level < contentItems[i].level) {
                    contentItems[j].subItems.push(contentItems[i])
                    contentItems[i].delete = true
                    break
                }
            }
        }
    }

    for (let i = contentItems.length; i > -1; i--) {
        if (contentItems[i]?.delete) {
            delete contentItems[i].delete
            contentItems.splice(i, 1)
        }
    }
    return contentItems
}

export function addCategoryLabels(htmlEl, language, footnote = false) {
    // Due to lacking CSS support in ereaders, figure numbers need to be hardcoded.
    htmlEl
        .querySelectorAll(
            "figure[data-category='figure'] figcaption span.label"
        )
        .forEach((el, index) => {
            const suffix = el.parentElement.innerText.trim().length ? ": " : ""
            el.innerHTML = `${CATS["figure"][language]} ${index + 1}${footnote ? "A" : ""}${suffix}`
            el.classList.remove("label")
        })

    htmlEl
        .querySelectorAll(
            "figure[data-category='equation'] figcaption span.label"
        )
        .forEach((el, index) => {
            const suffix = el.parentElement.innerText.trim().length ? ": " : ""
            el.innerHTML = `${CATS["equation"][language]} ${index + 1}${footnote ? "A" : ""}${suffix}`
            el.classList.remove("label")
        })

    htmlEl
        .querySelectorAll("figure[data-category='photo'] figcaption span.label")
        .forEach((el, index) => {
            const suffix = el.parentElement.innerText.trim().length ? ": " : ""
            el.innerHTML = `${CATS["photo"][language]} ${index + 1}${footnote ? "A" : ""}${suffix}`
            el.classList.remove("label")
        })

    htmlEl
        .querySelectorAll(
            "figure[data-category='table'] figcaption span.label,table[data-category='table'] caption span.label"
        )
        .forEach((el, index) => {
            const suffix = el.parentElement.innerText.trim().length ? ": " : ""
            el.innerHTML = `${CATS["table"][language]} ${index + 1}${footnote ? "A" : ""}${suffix}`
            el.classList.remove("label")
        })
    return htmlEl
}

export const modifyImages = htmlEl => {
    const imageLinks = htmlEl.querySelectorAll("img"),
        images = []

    imageLinks.forEach((el, index) => {
        const src = el.getAttribute("src").split("?")[0]
        let filename = `images/${src.split("/").pop()}`
        // JPGs are output as PNG elements as well.
        if (filename === "images/") {
            // name was not retrievable so we give the image a unique numerical
            // name like 1.png, 2.jpg, 3.svg, etc. .
            filename = `images/${index}`
        }

        const newImg = document.createElement("img")
        // We set the src of the image as "data-src" for now so that the browser
        // won't try to load the file immediately
        newImg.setAttribute("data-src", filename)
        el.parentNode.replaceChild(newImg, el)

        if (!images.find(image => image.filename === filename)) {
            images.push({
                filename,
                url: src
            })
        }
    })

    return images
}
