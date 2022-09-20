// Adds the books overview page to the app routing table
export class BookAppItem {
    constructor(app) {
        this.app = app
    }

    init() {
        this.app.routes["books"] = {
            requireLogin: true,
            open: pathnameParts => {
                const path = ("/" + pathnameParts.slice(2).join("/")).replace(/\/?$/, "/")
                return import("../../modules/books").then(({BookOverview}) => new BookOverview(this.app.config, path))
            },
            dbTables: {
                "data": {
                    keyPath: "id"
                }
            }
        }
    }

}
