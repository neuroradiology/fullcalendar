const path = require('path')
const glob = require('glob')
const nodeResolve = require('rollup-plugin-node-resolve')
const alias = require('rollup-plugin-alias')
const commonjs = require('rollup-plugin-commonjs')
const sourcemaps = require('rollup-plugin-sourcemaps')
const postCss = require('rollup-plugin-postcss')
const { WATCH_OPTIONS, onwarn, isStylePath, isRelPath } = require('./rollup-util')


module.exports = function() {
  let nonMainEntryPoints = glob.sync('tmp/tsc-output/packages?(-premium)/__tests__/src/*.js').filter((entryPoint) => (
    !path.basename(entryPoint).match(/^main\./)
  ))

  let configs = [
    buildConfig({
      input: 'tmp/tests-index.js',
      outputFile: 'tmp/tests-compiled/main.js'
    })
  ]

  for (let nonMainEntryPoint of nonMainEntryPoints) {
    configs.push(
      buildConfig({
        input: nonMainEntryPoint,
        outputFile: path.join('tmp/tests-compiled', path.basename(nonMainEntryPoint))
      })
    )
  }

  return configs
}


function buildConfig(options) {
  let nodeModulesDirs = [
    'packages/__tests__/node_modules',
    'packages-premium/__tests__/node_modules'
  ]

  return {
    input: options.input,
    output: {
      file: options.outputFile,
      format: 'iife',
      sourcemap: true
    },
    plugins: [
      {
        resolveId(id, importer) { // TODO: not really DRY
          if (isStylePath(id) && isRelPath(id) && importer.match('/tmp/tsc-output/')) {
            let resourcePath = importer.replace('/tmp/tsc-output/', '/')
            resourcePath = path.dirname(resourcePath)
            resourcePath = path.join(resourcePath, id)
            return { id: resourcePath, external: false }
          }
          return null
        }
      },
      alias({ // needs to go before node-resolve/commonjs so that alias resolution takes precedence

        // the alias to the non-premium tests. must be absolute
        'standard-tests': path.join(process.cwd(), 'tmp/tsc-output/packages/__tests__'),
        'premium-tests': path.join(process.cwd(), 'tmp/tsc-output/packages-premium/__tests__'),

        // despite using rollup/node for compilation, we want to bundle builds that runs in a real browser
        // also for HACK below
        'xhr-mock': path.join(process.cwd(), './node_modules/xhr-mock/dist/xhr-mock.js'),
        'luxon': path.join(process.cwd(), 'node_modules/luxon/build/cjs-browser/luxon.js'),

        // HACK
        // because the monorepo-tool doesn't support hoisting, it's likely we'll get multiple version of 3rd party packages.
        // explicitly map some references to top-level packages.
        'moment/locale/es': path.join(process.cwd(), 'node_modules/moment/locale/es.js'), // needs to go before moment
        'moment': path.join(process.cwd(), 'node_modules/moment/moment.js'),
        'moment-timezone/builds/moment-timezone-with-data': path.join(process.cwd(), 'node_modules/moment-timezone/builds/moment-timezone-with-data.js'),
      }),
      nodeResolve({
        customResolveOptions: {
          paths: nodeModulesDirs
        }
      }),
      commonjs(), // for fast-deep-equal import
      postCss({
        extract: true // to separate .css file
      }),
      sourcemaps()
    ],
    watch: WATCH_OPTIONS,
    onwarn
  }
}
