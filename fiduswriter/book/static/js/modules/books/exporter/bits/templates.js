import {escapeText} from "../../../common"

const bookPartTemplate = ({front, body, back}) =>
    `<book-part book-part-type="chapter" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:ali="http://www.niso.org/schemas/ali/1.0/" xmlns:mml="http://www.w3.org/1998/Math/MathML">${front}${body}${back}</book-part>`

export const bitsTemplate = (book, chapters) => {
    const updated = new Date(book.updated * 1000)
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE book PUBLIC "-//NLM//DTD BITS Book Interchange DTD v2.1 20220202//EN" "https://jats.nlm.nih.gov/extensions/bits/2.1/BITS-book2-1.dtd">
<book dtd-version="2.1" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:ali="http://www.niso.org/schemas/ali/1.0/">
    <processing-meta tagset-family="bits" table-model="xhtml" math-representation="tex mathml"></processing-meta>
    <book-meta>
        <book-title-group>
            <book-title>${escapeText(book.title)}</book-title>
            ${book.metadata.subtitle.length ? `<subtitle>${escapeText(book.metadata.subtitle)}</subtitle>` : ""}
        </book-title-group>
        ${
            book.metadata.version.length
                ? `<content-version>${escapeText(book.metadata.version)}</content-version>`
                : ""
        }
        <content-language>${book.settings.language.split("-")[0]}</content-language>
        ${
            book.metadata.description.length
                ? `<abstract>
    <p>${escapeText(book.metadata.description)}</p>
</abstract>`
                : ""
        }
        ${
            book.metadata.author.length
                ? `<contrib-group>
            <contrib contrib-type="author">
                <name>
                    <surname>${escapeText(book.metadata.author.split(" ").slice(1).join(" "))}</surname>
                    <given-names>${escapeText(book.metadata.author.split(" ").pop())}</given-names>
                </name>
            </contrib>
            </contrib-group>`
                : ""
        }
        <pub-date>
            <year>${updated.getFullYear()}</year>
            <month>${updated.getMonth() + 1}</month>
            <day>${updated.getDate()}</day>
        </pub-date>
        ${
            book.metadata.publication_date.length
                ? `<pub-date date-type="pub" publication-format="electronic">
    <string-date>${escapeText(book.metadata.publication_date)}</string-date>
</pub-date>`
                : ""
        }
        ${
            book.metadata.isbn.length
                ? `<isbn>${escapeText(book.metadata.isbn)}</isbn>`
                : ""
        }
        ${
            book.metadata.publisher.length
                ? `<publisher>
                <publisher-name>${escapeText(book.metadata.publisher)}</publisher-name>
            </publisher>`
                : ""
        }
        ${
            book.metadata.series_title.length
                ? `<series>
    <series-title>${escapeText(book.metadata.series_title)}</series-title>
    ${
        book.metadata.series_position.length
            ? `<series-text>${escapeText(book.metadata.series_position)}</series-text>`
            : ""
    }
</series>`
                : ""
        }
        ${
            book.metadata.copyright.length
                ? `<permissions>
                <copyright-holder>
                <name>${escapeText(book.metadata.copyright)}</name>
                </copyright-holder>
            </permissions>`
                : ""
        }
        ${
            book.metadata.keywords.length
                ? `<kwd-group>${book.metadata.keywords
                      .split(",")
                      .map(
                          keyword => `<kwd>${escapeText(keyword.trim())}</kwd>`
                      )
                      .join("")}</kwd-group>`
                : ""
        }
    </book-meta>
    <book-body>
        ${chapters.map(chapter => bookPartTemplate(chapter)).join("\n")}
    </book-body>
</book>`
}
