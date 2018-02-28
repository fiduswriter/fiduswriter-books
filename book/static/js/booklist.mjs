import {BookList} from "./modules/books"

/* Create theBooks and make it available to the general namespace for debugging
purposes.*/

let theBookList = new BookList()
window.theBookList = theBookList
