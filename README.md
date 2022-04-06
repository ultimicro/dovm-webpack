# DOVM Loader
[![npm](https://img.shields.io/npm/v/dovm-loader)](https://www.npmjs.com/package/dovm-loader)

This is a loader for webpack 5 to load *.dovm files.

## Install

```sh
npm i --save-dev dovm-loader
```

## Usage

This loader required to chain with `ts-loader` due to it produce TypeScript from *.dovm. Example `webpack.config.js`:

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.dovm$/i,
        use: [
          {
            loader: 'ts-loader',
            options: {
              onlyCompileBundledFiles: true,
              appendTsSuffixTo: [/\.dovm$/i]
            }
          },
          {
            loader: 'dovm-loader'
          }
        ]
      }
    ]
  }
};
```

## License

MIT
