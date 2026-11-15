// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	site: import.meta.env?.PUBLIC_SITE_URL || 'https://towingspecs.com',
	output: 'server',
	adapter: cloudflare(),
	vite: {
		plugins: [tailwindcss()],
	},
});
