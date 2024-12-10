import {escapeText} from "../../../common"

export const chapterTemplate = ({part, contents}) => `
    ${part && part.length ? `<h1 class="part">${escapeText(part)}</h1>` : ""}
    ${contents}`
