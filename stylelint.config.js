const path = require("path")
const fs = require("fs")
const {execSync} = require("child_process")

function getFidusWriterPath() {
    try {
        // Get all paths from fiduswriter.__path__ (handles namespace packages and editable installs)
        const pathsOutput = execSync(
            'python -c "import fiduswriter; import json; print(json.dumps([str(p) for p in fiduswriter.__path__]))"'
        )
            .toString()
            .trim()

        const paths = JSON.parse(pathsOutput)

        // Get the current plugin directory to exclude it
        const pluginDir = path.resolve(__dirname)

        // Find the first path that looks like fiduswriter core
        // (not the plugin, and has typical fiduswriter apps like 'document')
        for (const testPath of paths) {
            const resolvedPath = fs.realpathSync(testPath)

            // Skip if this is the plugin directory
            if (
                resolvedPath === pluginDir ||
                resolvedPath.startsWith(pluginDir)
            ) {
                continue
            }

            // Check if this looks like fiduswriter core (has document app)
            if (
                fs.existsSync(path.join(resolvedPath, "document")) ||
                fs.existsSync(path.join(resolvedPath, "bibliography"))
            ) {
                return resolvedPath
            }
        }

        // Fallback: try to find fiduswriter core by looking in parent directories
        // Assumes fiduswriter and fiduswriter-books are sibling directories
        const pluginParent = path.resolve(pluginDir, "..")
        const fiduswriterCore = path.join(
            pluginParent,
            "fiduswriter",
            "fiduswriter"
        )
        if (
            fs.existsSync(fiduswriterCore) &&
            fs.statSync(fiduswriterCore).isDirectory()
        ) {
            return fiduswriterCore
        }

        throw new Error("Fidus Writer core not found")
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
                    path.join(fidusWriterPath, "base/static/css/colors.css")
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
