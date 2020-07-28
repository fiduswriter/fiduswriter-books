/** A template to create the latex book.tex file. */
export const bookTexTemplate = ({preamble, book, epilogue}) =>
    `\\documentclass[11pt]{book}
${preamble}
\\usepackage{docmute}
\\title{${book.title}}
\\author{${book.metadata.author}}
\\begin{document}
\\maketitle
\\def\\title#1{\\chapter{#1}}
\\tableofcontents
${
    book.chapters.map(chapter =>
        `${
            chapter.part && chapter.part.length ?
                `\n\\part{${chapter.part}}` :
                ''
        }
        \\input{chapter-${chapter.number}}
        `
    ).join('')
}
${epilogue}
\\end{document}`
