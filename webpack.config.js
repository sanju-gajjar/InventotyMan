const path = require('path');

module.exports = {
    mode: 'development',
    entry: './public/js/main.js', // Entry point of your application
    output: {
        filename: 'bundle.js', // Output bundle file
        path: path.resolve(__dirname, 'dist') // Output directory
    },
    module: {
        rules: [
            {
                test: /\.js$/, // Apply this rule to files ending in .js
                exclude: /node_modules/, // Don't apply to files residing in node_modules
                use: {
                    loader: 'babel-loader', // Use the Babel loader for transpiling JS files
                    options: {
                        presets: ['@babel/preset-env'] // Use the env preset for modern JS
                    }
                }
            }
        ]
    }
};