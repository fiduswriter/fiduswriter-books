import {ODTExporterRender} from "../../../exporter/odt/render"

export class ODTBookExporterRender extends ODTExporterRender {

    constructor(xml, styles) {
        super(xml)

        this.styles = styles

        this.bodyTemplate = null //document.createDocumentFragment()
        this.postamble = null // document.createDocumentFragment()

        this.bodyParts = []
        this.fileXml = null
    }

    init() {
        return this.xml.getXml(this.filePath).then(
            xml => {
                this.fileXml = xml
                const text = xml.query("office:text")
                this.bodyTemplate = text.cloneNode(false)
                this.postamble = text.cloneNode(false)
                let currentSection = null
                const textChildren = Array.from(text.children)
                textChildren.forEach(node => {
                    if (
                        node.tagName === "text:section"
                    ) {
                        const sectionName = String(node.getAttribute("text:name")).toLowerCase()
                        if (sectionName === "body") {
                            currentSection = this.bodyTemplate
                        } else if (sectionName === "postamble") {
                            currentSection = this.postamble
                        }
                    } else if (["text:p", "text:h"].includes(node.tagName)) {
                        currentSection = this.bodyTemplate
                    }
                    if (currentSection) {
                        currentSection.appendChild(node)
                    }
                })
                return Promise.resolve()
            }
        )
    }

    render(docContent, pmBib, settings, richtext, citations) {
        this.text = this.bodyTemplate.cloneNode(true)
        super.render(docContent, pmBib, settings, richtext, citations)
        this.bodyParts.push(this.text)
    }

    assemble() {
        this.styles.addPageBreakStyle() // Style for page break
        const text = this.fileXml.query("office:text")
        this.bodyParts.forEach((bodyPart, index) => {
            const children = bodyPart.children.slice()
            children.forEach(node => {
                text.appendChild(node)
            })
            if (index < this.bodyParts.length - 1) {
                text.appendXML("<text:p text:style-name=\"PageBreak\"/>")
            }
        })
        this.postamble.children.forEach(node => text.appendChild(node))
    }
}
