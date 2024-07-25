const bookPartTemplate = ({front, body, back}) =>
    `<book-part book-part-type="chapter" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:ali="http://www.niso.org/schemas/ali/1.0/">${front}${body}${back}</book-part>`


export const bitsTemplate = (chapters) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE book PUBLIC "-//NLM//DTD BITS Book Interchange DTD v2.1 20220202//EN" "https://jats.nlm.nih.gov/extensions/bits/2.1/BITS-book2-1.dtd">
<book dtd-version="2.1" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:ali="http://www.niso.org/schemas/ali/1.0/">
    ${chapters.map((chapter) => bookPartTemplate(chapter)).join("\n")}
</book>`