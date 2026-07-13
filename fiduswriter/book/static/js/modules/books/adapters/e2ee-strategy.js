import {E2EEEncryptor} from "@fiduswriter/editor/e2ee/encryptor"
import {E2EEKeyManager} from "@fiduswriter/editor/e2ee/key-manager"
import {enterPassphraseDialog} from "@fiduswriter/editor/e2ee/passphrase-dialog"
import {PassphraseManager} from "@fiduswriter/editor/e2ee/passphrase-manager"

/**
 * Browser `E2EEStrategy` adapter.
 *
 * Implements the `E2EEStrategy` interface from `@fiduswriter/books-document`
 * using the Fidus Writer core end-to-end-encryption helpers. It is injected
 * into `getMissingChapterData` so that encrypted book chapters can be
 * decrypted before an export or sanity check runs.
 */
export const e2eeStrategy = {
    /**
     * Ensure the user's personal passphrase keys are available in the session.
     * If keys are already unlocked, resolves immediately with true.
     * If the user has no passphrase set up, resolves with false.
     * Otherwise opens the passphrase dialog and resolves true on success or
     * false if the user cancels.
     *
     * @returns {Promise<boolean>}
     */
    ensurePassphraseUnlocked() {
        if (PassphraseManager.hasKeysInSession()) {
            return Promise.resolve(true)
        }
        return PassphraseManager.hasEncryptionKeys().then(hasKeys => {
            if (!hasKeys) {
                return false
            }
            return new Promise(resolve => {
                const tryUnlock = (errorMessage = "") => {
                    let unlockAttempted = false
                    enterPassphraseDialog(
                        passphrase => {
                            unlockAttempted = true
                            PassphraseManager.unlockWithPassphrase(passphrase)
                                .then(() => resolve(true))
                                .catch(() => {
                                    tryUnlock(
                                        gettext(
                                            "Wrong passphrase. Please try again."
                                        )
                                    )
                                })
                        },
                        null,
                        errorMessage ? {errorMessage} : {}
                    ).then(() => {
                        // Dialog resolved — if unlock was never attempted the
                        // user clicked Cancel.
                        if (!unlockAttempted) {
                            resolve(false)
                        }
                    })
                }
                tryUnlock()
            })
        })
    },

    getDocumentPassword(docId) {
        return PassphraseManager.getDocumentPassword(docId)
    },

    resolvePasswordToKey(password, salt, iterations) {
        return PassphraseManager.resolvePasswordToKey(
            password,
            salt,
            iterations
        )
    },

    decryptObject(encrypted, key) {
        return E2EEEncryptor.decryptObject(encrypted, key)
    },

    decryptImageToUrl(encrypted, key) {
        return E2EEEncryptor.decryptImageToUrl(encrypted, key)
    },

    storePasswordInSession(docId, password) {
        E2EEKeyManager.storePasswordInSession(docId, password)
    }
}
