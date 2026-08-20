const path = require("path")
const fs = require("fs")
const {execSync} = require("child_process")

function getFidusWriterPath() {
    try {
        let fwPath = ""
        try {
            fwPath = execSync(
                "python -c \"import fiduswriter; print(next(filter(lambda path: '/site-packages/' in path, fiduswriter.__path__), ''))\""
            )
                .toString()
                .trim()
        } catch {
            fwPath = ""
        }
        if (fwPath) {
            return fwPath
        }
        // Fallback: the backend is checked out as a sibling
        // (fiduswriter-server-backend/fiduswriter).
        const sibling = path.resolve(
            __dirname,
            "..",
            "fiduswriter-server-backend",
            "fiduswriter"
        )
        if (fs.existsSync(sibling) && fs.statSync(sibling).isDirectory()) {
            return sibling
        }
        throw new Error("Fidus Writer not found")
    } catch (error) {
        console.error(
            "Failed to find Fidus Writer installation:",
            error.message
        )
        process.exit(1)
    }
}

const fidusWriterPath = getFidusWriterPath()

module.exports = {
    extends: "stylelint-config-standard",
    plugins: ["stylelint-value-no-unknown-custom-properties"],
    rules: {
        "color-hex-length": "long",
        "max-nesting-depth": 2,
        "csstools/value-no-unknown-custom-properties": [
            true,
            {
                importFrom: [
                    path.join(
                        fidusWriterPath,
                        "static-libs/css/fwtoolkit/colors.css"
                    ),
                    path.join(fidusWriterPath, "static-libs/css/colors.css")
                ]
            }
        ],
        "selector-class-pattern": [
            "^(([a-z][a-z0-9]*)(-[a-z0-9]+)*)|(ProseMirror(-[a-z0-9]+)*)$",
            {
                message:
                    "Selector should use lowercase and separate words with hyphens (selector-class-pattern)"
            }
        ]
    }
}
