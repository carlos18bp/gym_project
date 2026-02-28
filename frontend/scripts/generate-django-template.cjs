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

// Also handle manifest link (href may already be matched, but ensure webmanifest is covered)
html = html.replace(
  /href="\/static\/frontend\/([^"]+\.webmanifest)"/g,
  'href="{% static "frontend/$1" %}"'
);

// Add {% load static %} at the very top
html = '{% load static %}\n\n' + html;

// Ensure templates directory exists
const templateDir = path.dirname(DJANGO_TEMPLATE);
fs.mkdirSync(templateDir, { recursive: true });

fs.writeFileSync(DJANGO_TEMPLATE, html, 'utf-8');
console.log('Django template generated at', DJANGO_TEMPLATE);
