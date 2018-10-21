import {BookOverview} from "../../modules/books"
// Adds the books overview page to the app routing table
export class BookAppItem {
    constructor(app) {
        this.app = app
    }

    init() {
        this.app.routes['book'] = () => new BookOverview(this.app.config)
    }

}
