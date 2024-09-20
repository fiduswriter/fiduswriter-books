import {ODTExporterRender} from "../../../exporter/odt/render"

export class ODTBookExporterRender extends ODTExporterRender {

    constructor(xml, styles) {
        super(xml)

        this.styles = styles

        this.preamble = null
        this.bodyTemplate = null
        this.postamble = null

        this.bodyParts = []
        this.fileXml = null
    }

    init() {
        return this.xml.getXml(this.filePath).then(
            xml => {
                this.fileXml = xml
                const text = xml.query("office:text")
                this.preamble = text.cloneNode(false)
                this.bodyTemplate = text.cloneNode(false)
                this.postamble = text.cloneNode(false)
                let currentSection
                const textChildren = Array.from(text.children)
                textChildren.forEach(node => {
                    if (["text:p", "text:h"].includes(node.tagName)) {
                        const bookmark = node.query("text:bookmark")
                        if (bookmark) {
                            const sectionName = String(bookmark.getAttribute("text:name")).toLowerCase()
                            if (sectionName === "preamble") {
                                currentSection = this.preamble
                            } else if (sectionName === "postamble") {
                                currentSection = this.postamble
                            } else if (sectionName === "body") {
                                currentSection = this.bodyTemplate
                            } else {
                                currentSection = currentSection || this.bodyTemplate
                            }
                        } else {
                            currentSection = currentSection || this.bodyTemplate
                        }

                    }
                    if (currentSection) {
                        currentSection.appendChild(node)
                    }
                })
                return Promise.resolve()
            }
        )
    }

    render(docContent, pmBib, settings, richtext, citations, chapterIndex) {
        this.text = this.bodyTemplate.cloneNode(true)
        const bodyBookmark = this.text.query("text:bookmark", {"text:name": "body"})
        if (bodyBookmark) {
            bodyBookmark.setAttribute("text:name", `chapter ${chapterIndex + 1}`)
        }
        super.render(docContent, pmBib, settings, richtext, citations)
        this.bodyParts.push(this.text)
    }

    renderAmbles({title, subtitle, version, publisher, copyright, author, keywords, language}) {
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
        const usedTags = [], ambles = [this.preamble, this.postamble]
        ambles.forEach(
            amble => {
                const blocks = amble.queryAll(["text:p", "text:h"])
                blocks.forEach(
                    block => {
                        if (block.parentElement.nodeName === "text:deletion") {
                            // Inside of tracked changes deletion, don't do anything
                            return
                        }
                        // Assuming there is nothing outside of <w:t>...</w:t>
                        const text = block.textContent
                        tags.forEach(
                            tag => {
                                const tagString = tag.title
                                if (text.includes(`{${tagString}}`)) {
                                    usedTags.push(Object.assign({block}, tag))
                                }
                            }
                        )
                    }
                )
            }
        )
        usedTags.forEach(tag => this.inlineRender(tag))
    }

    assemble() {
        this.styles.addPageBreakStyle() // Style for page break
        const text = this.fileXml.query("office:text")
        Array.from(this.preamble.children).forEach(node => text.appendChild(node))
        this.bodyParts.forEach((bodyPart, index) => {
            const children = bodyPart.children.slice()
            children.forEach(node => {
                text.appendChild(node)
            })
            if (index < this.bodyParts.length - 1) {
                text.appendXML("<text:p text:style-name=\"PageBreak\"/>")
            }
        })
        Array.from(this.postamble.children).forEach(node => text.appendChild(node))
    }
}
