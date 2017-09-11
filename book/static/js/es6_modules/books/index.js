import {BookActions} from "./actions"
import {BookAccessRightsDialog} from "./accessrights"
import {bookListTemplate} from "./templates"
import {ImageDB} from "../images/database"
import {OverviewMenuView} from "../common"
import {SiteMenu} from "../menu"
import {menuModel} from "./menu"

export class BookList {
    // A class that contains everything that happens on the books page.
    // It is currently not possible to initialize more thna one editor class, as it
    // contains bindings to menu items, etc. that are uniquely defined.
    constructor() {
        this.mod = {}
        this.bookList = []
        this.styles = false
        this.documentList = []
        this.teamMembers = []
        this.accessRights = []
        this.user = {}
        new BookActions(this)
        let smenu = new SiteMenu("books")
        smenu.init()
        this.menu = new OverviewMenuView(this, menuModel)
        this.menu.init()
        this.bindEvents()
    }

    getImageDB() {
        if (!this.imageDB) {
            let imageGetter = new ImageDB()
            return new Promise((resolve, reject) => {
                imageGetter.getDB().then(
                    () => {
                        this.imageDB = imageGetter
                        resolve()
                    }
                )
            })
        } else {
            return Promise.resolve()
        }
    }

    bindEvents() {
        jQuery(document).ready(() => {
            this.mod.actions.getBookListData()
        })

        jQuery(document).bind('bookDataLoaded', () => {
            jQuery('#book-table tbody').html(
                bookListTemplate({bookList: this.bookList, user: this.user})
            )
            this.mod.actions.startBookTable()
        })

        let that = this
        jQuery(document).ready(function () {
            jQuery(document).on('click', '.delete-book', function () {
                let BookId = jQuery(this).attr('data-id')
                that.mod.actions.deleteBookDialog([BookId])
            })

            jQuery(document).on('click', '.owned-by-user .rights', function () {
                let BookId = parseInt(jQuery(this).attr('data-id'))
                let accessDialog = new BookAccessRightsDialog(
                    [BookId],
                    that.teamMembers,
                    that.accessRights
                )
                accessDialog.init().then(
                    accessRights => {
                        that.accessRights = accessRights
                    }
                )
            })

            jQuery(document).on('click', '.book-title', function () {
                let bookId = parseInt(jQuery(this).attr('data-id'))
                that.getImageDB().then(() => {
                    that.mod.actions.createBookDialog(bookId, that.imageDB)
                })
            })
        })
    }

    getSelected() {
        return [].slice.call(
            document.querySelectorAll('.entry-select:checked:not(:disabled)')
        ).map(el => parseInt(el.getAttribute('data-id')))
    }
}
