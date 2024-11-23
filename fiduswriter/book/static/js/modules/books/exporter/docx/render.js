import {DOCXExporterRender} from "../../../exporter/docx/render"

export class DOCXBookExporterRender extends DOCXExporterRender {
    constructor(xml) {
        super(xml)

        this.preamble = null
        this.bodyTemplate = null
        this.postamble = null
        this.fileXML = null
        this.bodyParts = []
    }

    init() {
        return super.init().then(() => {
            this.fileXML = this.text
            const text = this.fileXML.query("w:body")
            this.preamble = text.cloneNode(false)
            this.bodyTemplate = text.cloneNode(false)
            this.postamble = text.cloneNode(false)
            let currentSection = this.bodyTemplate
            const textChildren = Array.from(text.children)
            textChildren.forEach(node => {
                const bookmarkStart = node.query("w:bookmarkStart")
                if (bookmarkStart) {
                    const bookmarkName = String(
                        bookmarkStart.getAttribute("w:name")
                    ).toLowerCase()
                    if (bookmarkName === "preamble") {
                        currentSection = this.preamble
                    } else if (bookmarkName === "body") {
                        currentSection = this.bodyTemplate
                    } else if (bookmarkName === "postamble") {
                        currentSection = this.postamble
                    }
                }
                currentSection.appendChild(node)
            })
            return Promise.resolve()
        })
    }

    render(docContent, pmBib, settings, richtext, citations, chapterIndex) {
        this.text = this.bodyTemplate.cloneNode(true)
        const bodyBookmark = this.text.query("w:bookmarkStart", {
            "w:name": "body"
        })
        if (bodyBookmark) {
            bodyBookmark.setAttribute("w:name", `chapter ${chapterIndex + 1}`)
        }
        super.render(docContent, pmBib, settings, richtext, citations)
        this.bodyParts.push(this.text)
    }

    renderAmbles({
        title,
        subtitle,
        version,
        publisher,
        copyright,
        author,
        keywords,
        language
    }) {
        const tags = [
            {title: "book.title", content: title},
            {title: "book.subtitle", content: subtitle},
            {title: "book.version", content: version},
            {title: "book.publisher", content: publisher},
            {title: "book.copyright", content: copyright},
            {title: "book.author", content: author},
            {title: "book.keywords", content: keywords},
            {title: "book.language", content: language}
        ]
        const usedTags = [],
            ambles = [this.preamble, this.postamble]
        ambles.forEach(amble => {
            const blocks = amble.queryAll(["w:p", "w:sectPr"])
            blocks.forEach(block => {
                // Assuming there is nothing outside of <w:t>...</w:t>
                const text = block.textContent
                tags.forEach(tag => {
                    const tagString = tag.title
                    if (text.includes(`{${tagString}}`)) {
                        usedTags.push(Object.assign({block}, tag))
                    }
                })
            })
        })
        usedTags.forEach(tag => this.inlineRender(tag))
    }

    assemble() {
        const text = this.fileXML.query("w:body")
        Array.from(this.preamble.children).forEach(node =>
            text.appendChild(node)
        )
        this.bodyParts.forEach((bodyPart, index) => {
            const children = bodyPart.children.slice()
            children.forEach(node => {
                text.appendChild(node)
            })
            if (index < this.bodyParts.length - 1) {
                text.appendXML(
                    `<w:p>
                  <w:pPr>
                    <w:pStyle w:val="Normal"/>
                    <w:bidi w:val="0"/>
                    <w:jc w:val="start"/>
                    <w:rPr/>
                  </w:pPr>
                  <w:r>
                    <w:rPr/>
                  </w:r>
                  <w:r>
                    <w:br w:type="page"/>
                  </w:r>
                </w:p>`
                )
            }
        })
        Array.from(this.postamble.children).forEach(node =>
            text.appendChild(node)
        )
    }
}
