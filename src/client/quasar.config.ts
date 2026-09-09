import {defineConfig} from '#q-app'

/** https://v2.quasar.dev/quasar-cli-vite/quasar-config-file */
export default defineConfig(ctx => {
	return {
		css: [
			'app.scss',
			'fonts.scss',
			'quasar.overrides.scss',
		],
		extras: [
			'mdi-v7',
		],
		boot: [
			'codemirror',
			'sw',
		],
		framework: {
			iconSet: 'mdi-v7',
			plugins: ['Dialog', 'Notify'],
			config: {
				notify: {
					color: 'background',
					textColor: 'text',
					icon: 'mdi-message-alert-outline',
					position: 'top',
					progress: true,
					badgeColor: 'text',
					badgeTextColor: 'background',
					badgePosition: 'top-right',
					actions: [{
						icon: 'mdi-close',
						color: 'text',
						round: true,
					}],
				},
			},
		},
		devServer: {
			host: '0.0.0.0',
			port: (ctx.mode as any).pwa ? 2035 : 2034,
			open: false
		},
		build: {
			allowOutsideProjectDistDir: true,
			distDir: '../../dist/url-artisan',
			publicPath: '/url-artisan',
			vueRouterMode: 'history',
			useFilenameHashes: false,
			typescript: {
				strict: true,
				vueShim: false,
			},
			extendViteConf(viteConf) {
				viteConf.build ??= {}
				viteConf.build.chunkSizeWarningLimit = Infinity
				viteConf.build.rolldownOptions ??= {}
				if (Array.isArray(viteConf.build.rolldownOptions.output)) {
					if (!viteConf.build.rolldownOptions.output.length)
						viteConf.build.rolldownOptions.output.push({})
					viteConf.build.rolldownOptions.output[0]!.codeSplitting = false
				}
				else {
					viteConf.build.rolldownOptions.output ??= {}
					viteConf.build.rolldownOptions.output.codeSplitting = false
				}
			},
			target: {
				// NOOTE: https://caniuse.com/css-relative-colors
				browser: ['chrome119', 'edge119', 'firefox128', 'safari16.4', 'ios16.4'],
			},
		},
	}
})
