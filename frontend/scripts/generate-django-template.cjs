/**
 * Post-build script: reads the Vite-generated index.html and produces
 * a Django template that uses {% static %} tags with the hashed filenames.
 *
 * Vite outputs paths like /static/frontend/js/index-abc123.js.
 * This script converts them to {% static "frontend/js/index-abc123.js" %}.
 */

const fs = require('node:fs');
const path = require('node:path');

const VITE_INDEX = path.resolve(__dirname, '../../backend/static/frontend/index.html');
const DJANGO_TEMPLATE = path.resolve(__dirname, '../../backend/gym_app/templates/index.html');

if (!fs.existsSync(VITE_INDEX)) {
  console.error('ERROR: Vite index.html not found at', VITE_INDEX);
  process.exit(1);
}

let html = fs.readFileSync(VITE_INDEX, 'utf-8');

// Replace all occurrences of /static/frontend/... with {% static "frontend/..." %}
// Handles src="...", href="...", and content="..." attributes
html = html.replace(
  /(src|href|content)="\/static\/frontend\/([^"]+)"/g,
  '$1="{% static "frontend/$2" %}"'
);

// Add {% load static %} at the very top
html = '{% load static %}\n\n' + html;

// Add google-site-verification meta tag after the viewport meta
html = html.replace(
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '<meta name="google-site-verification" content="iFe8F-luXYf4UulUg1XvFphiRGwrKstkVUjT7yiBolU" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />'
);

// Update the title
html = html.replace('<title>G&M Abogados</title>', '<title>G&M Consultores Juridicos</title>');

fs.writeFileSync(DJANGO_TEMPLATE, html, 'utf-8');
console.log('Django template generated at', DJANGO_TEMPLATE);
