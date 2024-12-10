export function getTimestamp(date) {
    return date.toISOString().replace(/\.\d{3}/, "")
}

export function getFontMimeType(filename) {
    const fontMimeTypes = {
        ttf: "font/ttf",
        otf: "font/otf",
        woff: "font/woff",
        woff2: "font/woff2"
    }
    const ext = filename.split(".").pop().toLowerCase()
    return fontMimeTypes[ext] || null
}

export function getImageMimeType(filename) {
    const imageMimeTypes = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        svg: "image/svg+xml"
    }
    const ext = filename.split(".").pop().toLowerCase()
    return imageMimeTypes[ext] || null
}

export function buildHierarchy(flatItems) {
    const root = []
    const idMap = {}

    // First pass - create all nodes
    flatItems.forEach(item => {
        idMap[item.id] = {
            ...item,
            children: []
        }
    })

    // Second pass - create hierarchy
    flatItems.forEach(item => {
        const node = idMap[item.id]
        if (item.level === -1 || item.level === 0) {
            root.push(node)
        } else {
            // Find the closest parent
            let parentLevel = item.level - 1
            let parent
            while (parentLevel >= 0 && !parent) {
                parent = flatItems.find(
                    p =>
                        p.level === parentLevel &&
                        p.docNum === item.docNum &&
                        p.id < item.id
                )
                parentLevel--
            }
            if (parent) {
                idMap[parent.id].children.push(node)
            } else {
                root.push(node)
            }
        }
    })

    return root
}
