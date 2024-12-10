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
