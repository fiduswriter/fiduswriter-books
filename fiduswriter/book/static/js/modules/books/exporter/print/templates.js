import {escapeText} from "fwtoolkit"

export const chapterTemplate = ({part, contents}) => `
    ${part && part.length ? `<h1 class="part">${escapeText(part)}</h1>` : ""}
    ${contents}`
