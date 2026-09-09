<template>
<q-dialog
	class="artisan-about-dialog"
	ref="dialogRef"
	transition-duration="0"
	@hide="onDialogHide()"
>
	<div class="bordered-dialog column no-wrap bg-background">
		<div class="sticky-header">
			<q-toolbar class="non-selectable">
				<q-icon name="mdi-information-outline" size="24px"/>
				<q-toolbar-title>About</q-toolbar-title>
				<q-btn
					icon="mdi-close" flat round :ripple="ripple$"
					@click.passive="onDialogOK()"
				/>
			</q-toolbar>
			<q-separator/>
		</div>
		<div class="doc-section">
			<b>qURL Artisan</b> is a browser-based HTTP client that uses native fetch by default and integrates with <a href="/" target="_blank" translate="no">qURL Proxy</a> when you need more control over requests and responses.<br>
			Version: {{VERSION}}
		</div>
		<q-separator/>
		<div class="doc-section">
			Keyboard shortcuts:
			<ul>
				<li>
					Alt + Ctrl + ArrowUp/ArrowDown – maximize panel: request, response
				</li>
				<li>
					Alt + M/U/P/H/B/O – request fields/tabs: method, URL, params, headers, body, options
				</li>
				<li>
					Home, PageUp, PageDown, End – table pages: first, previous, next, last
				</li>
				<li><span>
					Code editor keymaps: <a href="https://codemirror.net/docs/ref/#commands.defaultKeymap" target="_blank">basic</a> (partial support), <a href="https://codemirror.net/docs/ref/#commands.historyKeymap" target="_blank">history</a>, <a href="https://codemirror.net/docs/ref/#language.foldKeymap" target="_blank">folding</a>
				</span></li>
			</ul>
		</div>
		<q-separator/>
		<div class="doc-section">
			External links:
			<ul>
				<li><span>
					Help: <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers" target="_blank">HTTP headers</a>, <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status" target="_blank">status codes</a>, <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types" target="_blank">MIME types</a> (<a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types/Common_types" target="_blank">common</a>), <a href="https://deepwiki.com/NE0N0US/qurl-proxy/1.3-qurl-artisan" target="_blank">DeepWiki</a>
				</span></li>
				<li><span>
					Tools: QR <a href="https://monocalc.com/tool/encode_decode/qr_code_generator" target="_blank">encode</a> and <a href="https://monocalc.com/tool/encode_decode/qr_code_decoder" target="_blank">decode</a>, <a href="https://www.punycoder.com/" target="_blank">Punycode</a>, <a href="https://www.64baser.com/" target="_blank">Base64</a>, <a href="https://webhook.site/" target="_blank" translate="no">Webhook.site</a>
				</span></li>
			</ul>
		</div>
	</div>
</q-dialog>
</template>

<script setup lang="ts">
import {useDialogPluginComponent} from 'quasar'
import {useUiStore, VERSION} from '@'

const
	{ripple$} = useUiStore(),

	{dialogRef, onDialogHide, onDialogOK} = useDialogPluginComponent(),

	$emit = defineEmits([
		...useDialogPluginComponent.emits,
	])
</script>
