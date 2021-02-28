// Adds a link to the book creator to the main menu on the overview pages.

export class BookMenuItem {
    constructor(menu) {
        this.menu = menu
    }

    init() {
        this.menu.navItems.push({
            id: "books",
            title: gettext('compose books'),
            url: "/books/",
            text: gettext('Books'),
            order: 5
        })
    }

}
