/**
 * Terms of Service content. Single source of truth: docs/TERMS_OF_SERVICE.html
 * (provisioned at build time via Vite alias $docs).
 */
import termsHtml from '$docs/TERMS_OF_SERVICE.html?raw';

export const termsOfServiceContent = termsHtml;
