module.exports = [
    {
        ignores: ["node_modules/**", "!packages/node_modules/**"]
    },
    {
        files: ["lib/**/*.js","examples/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script"
        },
        rules: {
            "curly": ["error", "all"],
            "guard-for-in": "error",
            "no-extend-native": "error",
            "no-irregular-whitespace": "error",
            "wrap-iife": ["error", "inside"],
            "indent": ["error", 4, {"SwitchCase": 1}],
            "max-len": "off",
            "comma-dangle": "off",
            "eol-last": "off",
            "object-curly-spacing": "off",
            "no-useless-escape": "off",
            "space-before-function-paren": ["error", {
                anonymous: "always",
                named: "never",
                asyncArrow: "always",
            }],
        }
    }
];
