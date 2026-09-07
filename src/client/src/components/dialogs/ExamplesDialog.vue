<template>
<q-dialog
	class="artisan-examples-dialog"
	ref="dialogRef"
	transition-duration="0"
	@hide="onDialogHide()"
>
	<div class="bordered-dialog column no-wrap bg-background">
		<div class="sticky-header">
			<q-toolbar class="non-selectable">
				<q-icon name="mdi-file-multiple-outline" size="24px"/>
				<q-toolbar-title>Examples</q-toolbar-title>
				<q-btn
					icon="mdi-close" flat round :ripple="ripple$"
					@click.passive="onDialogOK()"
				/>
			</q-toolbar>
			<q-separator/>
		</div>
		<q-list class="app-color-settings-presets non-selectable">
			<menu-item
				v-for="{icon, label, caption, req} of EXAMPLES" :key="label"
				:icon="icon" :label="label" :caption="caption"
				@click.passive="openExample(req)"
			/>
		</q-list>
	</div>
</q-dialog>
</template>

<script setup lang="ts">
import {useDialogPluginComponent} from 'quasar'
import {AppService, MenuItem, ReqBodyType, ReqService, useReqStore, useUiStore} from '@'

const
	{req$} = useReqStore(),
	{ripple$} = useUiStore(),

	{dialogRef, onDialogHide, onDialogOK} = useDialogPluginComponent(),

	$emit = defineEmits([
		...useDialogPluginComponent.emits,
	]),

	EXAMPLES = AppService.freeze([
		{
			icon: 'mdi-code-json',
			label: 'JSONPlaceholder – Todos',
			caption: 'Get todos using query params',
			req: 'https://jsonplaceholder.typicode.com/todos?userId=1&userId=2',
		},
		{
			icon: 'mdi-code-json',
			label: 'JSONPlaceholder – Create Post',
			caption: 'Create a post using a JSON body',
			req: {
				method: 'POST',
				url: 'https://jsonplaceholder.typicode.com/posts',
				headers: [
					{disable: false, key: 'Content-Type', value: 'application/json'},
				],
				bodyType: ReqBodyType.TEXT,
				body: '{"title":"Hello World","body":"This is a test post."}',
			},
		},
		{
			icon: 'mdi-file-document-check-outline',
			label: 'httpbin – HTML',
			caption: 'Get a simple HTML document with an SRI check',
			req: {
				url: 'httpbin.org/html',
				integrityHashes: 'sha512-VkjZaWWgcqf7UEkgobHl1eg8poEkebMMEhRkFu2XtM9jtLGsamBYvjqh/xUi+lgpUs+eT0WqWx3EY1B7gamXbQ==',
			},
		},
		{
			icon: 'mdi-hexadecimal',
			label: 'httpbin – Random bytes',
			caption: 'Get 64 KiB of random data',
			req: 'httpbin.org/stream-bytes/65536',
		},
		{
			icon: 'mdi-ip-outline',
			label: 'httpbin – IP',
			caption: 'Get your IP address',
			req: 'httpbin.org/ip',
		},
		{
			icon: 'mdi-server-network-outline',
			label: 'cURL Proxy – Random Image',
			caption: 'Get a random image from LoremFlickr',
			req: {
				url: '/?url=https%3A%2F%2Frandom.imagecdn.app%2Fv1%2Fimage%3Fformat%3Dimage',
				extractCurlProxy: true,
			},
		},
		{
			icon: 'mdi-server-network-outline',
			label: 'cURL Proxy – Load JSONCrush',
			caption: 'Load JSONCrush from jsDelivr or UNPKG',
			req: {
				url: '/?url=https%3A%2F%2Fcdn.jsdelivr.net%2Fnpm%2Fjsoncrush%2FJSONCrush.min.js&url=https%3A%2F%2Funpkg.com%2Fjsoncrush%2FJSONCrush.min.js&fastest',
				extractCurlProxy: true,
			},
		},
		{
			icon: 'mdi-server-network-outline',
			label: 'cURL Proxy – Throttled Download',
			caption: 'Download FFmpeg sources over HSPA',
			req: {
				url: '/?url=https%3A%2F%2Fffmpeg.org%2Freleases%2Fffmpeg-8.1.2.tar.xz&throttle=7000',
				extractCurlProxy: true,
			},
		},
		{
			icon: 'mdi-server-network-outline',
			label: 'cURL Proxy – Render Markdown',
			caption: 'Render a Markdown document using the GitHub API',
			req: {
				url: '/?url=https%3A%2F%2Fraw.githubusercontent.com%2FNE0N0US%2Fcurl-proxy%2Frefs%2Fheads%2Fmaster%2FREADME.md&resbody=javascript%3Anew%20Request(new%20URL(\'%3Furl%3Dhttps%3A%2F%2Fapi.github.com%2Fmarkdown%26delresheaders%3D%5B%22content-security-policy%22%5D%26resbody%3Djavascript%3A%2560%253C!DOCTYPE%2520html%253E%253Chtml%2520lang%253D%2522en%2522%253E%253Chead%253E%253Cmeta%2520charset%253D%2522utf-8%2522%2520name%253D%2522viewport%2522%2520content%253D%2522width%253Ddevice-width%252Cinitial-scale%253D1%2522%253E%253Ctitle%253EMarkdown%253C%252Ftitle%253E%253Clink%2520rel%253D%2522icon%2522%2520href%253D%2522data%253Aimage%252Fvnd.microsoft.icon%253Bbase64%252C%2522%253E%253Clink%2520rel%253D%2522stylesheet%2522%2520href%253D%2522https%253A%252F%252Fcdn.jsdelivr.net%252Fnpm%252Fgithub-markdown-css%2522%253E%253Cstyle%253Ebody%252Chtml%257Bcolor-scheme%253Alight%2520dark%253Boverscroll-behavior%253Anone%253Bmargin%253A0%253Bpadding%253A0%257D.markdown-body%257Bbox-sizing%253Aborder-box%253Bmin-height%253A100vh%253Bmin-height%253A100dvh%253Bpadding%253A2rem%257D%253C%252Fstyle%253E%253C%252Fhead%253E%253Cbody%253E%253Cdiv%2520class%253D%2522markdown-body%2522%253E%2524%257Bres.text.replaceAll(%2522href%253D%255C%2522%2523%2522%252C%2522href%253D%255C%2522%2523user-content-%2522)%257D%253C%252Fdiv%253E%253C%252Fbody%253E%253C%252Fhtml%253E%2560\'%2Creq.url)%2C%7Bmethod%3A\'POST\'%2Cbody%3AJSON.stringify(%7Btext%3Ares.text%7D)%7D)',
				extractCurlProxy: true,
			},
		},
	])

function openExample(example: any) {
	const req = req$.value
	Object.assign(
		req,
		{fetching: false},
		ReqService
			.deserialize(example instanceof Object ? example : {url: example})
			.patchView(req)
			.strip('id')
	)
	onDialogOK()
}
</script>
