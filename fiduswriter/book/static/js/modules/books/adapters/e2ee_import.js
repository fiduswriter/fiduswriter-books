import {E2EEKeyManager} from "../../editor/e2ee/key-manager.js"
import {PassphraseManager} from "../../editor/e2ee/passphrase-manager.js"

/**
 * Generate fresh E2EE options for a newly imported chapter.
 *
 * When the user's passphrase keys are unlocked in the session a random
 * document password (raw DEK) is generated so it can later be saved to the
 * server.  Otherwise a random 32-byte DEK is generated directly.
 *
 * @returns {Promise<{options: Object, password: string}>}
 */
export async function generateE2EEOptions() {
    const hasPassphraseKeys = await PassphraseManager.hasEncryptionKeys()
    const passphraseInSession =
        hasPassphraseKeys && PassphraseManager.hasKeysInSession()

    let password
    if (passphraseInSession) {
        password = await PassphraseManager.generateDocumentPassword()
    } else {
        const rawKey = crypto.getRandomValues(new Uint8Array(32))
        password = btoa(String.fromCharCode(...rawKey))
    }

    const salt = E2EEKeyManager.generateSalt()
    const saltBase64 = btoa(String.fromCharCode(...salt))
    const iterations = 600000

    const key = await PassphraseManager.resolvePasswordToKey(
        password,
        salt,
        iterations
    )

    return {
        options: {enabled: true, key, salt: saltBase64, iterations},
        password
    }
}

/**
 * Persist an imported chapter's E2EE password so it survives the current
 * session and, when passphrase keys are available, future sessions.
 *
 * @param {Object} doc - Imported chapter document.
 * @param {string} password - Raw document password.
 * @returns {Promise<void>}
 */
export async function storeImportedE2EEPassword(doc, password) {
    E2EEKeyManager.storePasswordInSession(doc.id, password)

    const hasPassphraseKeys = await PassphraseManager.hasEncryptionKeys()
    const passphraseInSession =
        hasPassphraseKeys && PassphraseManager.hasKeysInSession()

    if (passphraseInSession) {
        try {
            await PassphraseManager.saveDocumentPassword(
                doc.id,
                password,
                null,
                "user",
                true
            )
        } catch (_e) {
            // Non-fatal: the key is still cached for this session.
        }
    }
}
