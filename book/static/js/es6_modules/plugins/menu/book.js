// Adds a link to the book creator to the main menu on the overview pages.

export class BookMenuItem {
    constructor(menu) {
        this.menu = menu
    }

    init() {
        jQuery('div.fw-nav-container').append(`
            <p class="fw-nav-item">
                <a class="fw-header-navigation-text" href="/book/" title="compose books" data-item="books">
                    ${gettext("Books")}
                </a>
            </p>`)
    }

}
