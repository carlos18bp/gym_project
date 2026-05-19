# Vulnerability Audit & Dependency Update Report


**Branch:** release-june-2026-c  
**Date:** 2026-05-17  
**Base:** master @ 6e6e345a  
**Scope:** patch + minor updates only (no major version bumps)

## Summary

| Surface  | Vulns (initial) | Vulns (final) | Outdated (initial) |
|----------|-----------------|---------------|--------------------|
| Frontend | 13 (0c/6h/7m/0l) | 0 | 36 |
| Backend  | 78 across 16 pkgs | 35 across 6 pkgs | 74 |

---

## Frontend — `npm audit` (initial)
Source: `/tmp/gym_project_staging-npm-audit.json`

| Package | Severity | Notes |
|---------|----------|-------|
| @babel/plugin-transform-modules-systemjs | high | @babel/plugin-transform-modules-systemjs generates arbitrary code when compiling malicious |
| @rollup/plugin-terser | moderate | transitive via serialize-javascript |
| axios | high | Axios has a NO_PROXY Hostname Normalization Bypass that Leads to SSRF; Axios has Unrestric |
| brace-expansion | moderate | brace-expansion: Zero-step sequence causes process hang and memory exhaustion; brace-expan |
| fast-uri | high | fast-uri vulnerable to path traversal via percent-encoded dot segments; fast-uri vulnerabl |
| follow-redirects | moderate | follow-redirects leaks Custom Authentication Headers to Cross-Domain Redirect Targets |
| lodash | high | lodash vulnerable to Code Injection via `_.template` imports key names; lodash vulnerable  |
| picomatch | high | Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching; Pic |
| postcss | moderate | PostCSS has XSS via Unescaped </style> in its CSS Stringify Output |
| serialize-javascript | moderate | Serialize JavaScript has CPU Exhaustion Denial of Service via crafted array-like objects |
| vite | high | Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling; Vite Vulnerable to Ar |
| workbox-build | moderate | transitive via @rollup/plugin-terser |
| yaml | moderate | yaml is vulnerable to Stack Overflow via deeply nested YAML collections |

**Totals:** 0 critical / 6 high / 7 moderate / 0 low.

## Frontend — `npm outdated` (initial)
Source: `/tmp/gym_project_staging-npm-outdated.json`

- @babel/core: 7.28.4 → 7.29.0 → 7.29.0
- @babel/parser: 7.29.0 → 7.29.3 → 7.29.3
- @babel/preset-env: 7.28.3 → 7.29.5 → 7.29.5
- @heroicons/vue: 2.1.5 → 2.2.0 → 2.2.0
- @playwright/test: 1.58.1 → 1.60.0 → 1.60.0
- @tailwindcss/forms: 0.5.9 → 0.5.11 → 0.5.11
- @testing-library/jest-dom: 6.5.0 → 6.9.1 → 6.9.1
- @vitejs/plugin-vue: 6.0.4 → 6.0.7 → 6.0.7
- @vue/test-utils: 2.4.6 → 2.4.10 → 2.4.10
- autoprefixer: 10.4.19 → 10.5.0 → 10.5.0
- axios: 1.13.5 → 1.16.1 → 1.16.1
- axios-mock-adapter: 2.0.0 → 2.1.0 → 2.1.0
- babel-jest: 29.7.0 → 29.7.0 → 30.4.1 [SKIP-MAJOR]
- babel-plugin-istanbul: 6.1.1 → 6.1.1 → 8.0.0 [SKIP-MAJOR]
- bootstrap-icons: 1.11.3 → 1.13.1 → 1.13.1
- docx: 9.1.1 → 9.6.1 → 9.6.1
- dompurify: ? → 3.4.4 → 3.4.4
- eslint: 9.39.2 → 9.39.4 → 10.4.0 [SKIP-MAJOR]
- eslint-plugin-jest: 29.15.0 → 29.15.2 → 29.15.2
- eslint-plugin-playwright: 2.7.0 → 2.10.2 → 2.10.2
- flowbite: 2.3.0 → 2.5.2 → 4.0.2 [SKIP-MAJOR]
- gsap: 3.12.7 → 3.15.0 → 3.15.0
- heroicons: 2.1.5 → 2.2.0 → 2.2.0
- jest: 29.7.0 → 29.7.0 → 30.4.2 [SKIP-MAJOR]
- jest-environment-jsdom: 29.7.0 → 29.7.0 → 30.4.1 [SKIP-MAJOR]
- pinia: 2.1.7 → 2.3.1 → 3.0.4 [SKIP-MAJOR]
- postcss: 8.5.6 → 8.5.14 → 8.5.14
- sweetalert2: 11.26.18 → 11.26.24 → 11.26.24
- swiper: 12.1.2 → 12.1.4 → 12.1.4
- tailwindcss: 3.4.3 → 3.4.19 → 4.3.0 [SKIP-MAJOR]
- tinymce: 7.7.0 → 7.9.2 → 8.5.0 [SKIP-MAJOR]
- vite: 6.4.1 → 6.4.2 → 8.0.13 [SKIP-MAJOR]
- vite-plugin-pwa: 1.2.0 → 1.3.0 → 1.3.0
- vue: 3.5.21 → 3.5.34 → 3.5.34
- vue-router: 4.5.1 → 4.6.4 → 5.0.7 [SKIP-MAJOR]
- vue3-google-login: 2.0.33 → 2.1.4 → 2.1.4

---

## Backend — `pip-audit` (initial)
Source: `/tmp/gym_project_staging-pip-audit.json`

| Package | Current | Vulns | Min in-major fix |
|---------|---------|-------|------------------|
| brotli | 1.1.0 | 1 | 1.2.0 |
| certifi | 2024.6.2 | 2 | 2024.7.4 |
| cryptography | 44.0.1 | 2 | (only major bumps: 46.0.5) |
| django | 5.0.6 | 27 | 5.0.10 |
| djangorestframework-simplejwt | 5.3.1 | 1 | 5.5.1 |
| fonttools | 4.56.0 | 1 | 4.60.2 |
| lxml | 5.3.1 | 1 | (only major bumps: 6.1.0) |
| pillow | 10.4.0 | 5 | (only major bumps: 12.1.1) |
| pip | 24.0 | 4 | (only major bumps: 25.3) |
| pyasn1 | 0.6.0 | 1 | 0.6.3 |
| pyjwt | 2.8.0 | 1 | 2.12.0 |
| pypdf | 5.3.0 | 22 | (only major bumps: 6.0.0) |
| pytest | 8.3.5 | 1 | (only major bumps: 9.0.3) |
| requests | 2.32.3 | 2 | 2.32.4 |
| sqlparse | 0.5.0 | 1 | 0.5.4 |
| urllib3 | 2.2.2 | 6 | 2.5.0 |

## Backend — `pip list --outdated` (initial)
Source: `/tmp/gym_project_staging-pip-outdated.json`

- arabic-reshaper 3.0.0 → 3.0.1
- asgiref 3.8.1 → 3.11.1
- beautifulsoup4 4.13.3 → 4.14.3
- Brotli 1.1.0 → 1.2.0
- cachetools 5.3.3 → 7.1.2 [SKIP-MAJOR]
- celery 5.3.6 → 5.6.3
- certifi 2024.6.2 → 2026.4.22 [SKIP-MAJOR]
- cffi 1.17.1 → 2.0.0 [SKIP-MAJOR]
- chardet 5.2.0 → 7.4.3 [SKIP-MAJOR]
- charset-normalizer 3.3.2 → 3.4.7
- click 8.1.8 → 8.4.0
- coverage 7.8.0 → 7.14.0
- cryptography 44.0.1 → 48.0.0 [SKIP-MAJOR]
- cssselect2 0.7.0 → 0.9.0
- Django 5.0.6 → 6.0.5 [SKIP-MAJOR]
- django-cleanup 8.1.0 → 9.0.0 [SKIP-MAJOR]
- django-cors-headers 4.4.0 → 4.9.0
- djangorestframework 3.15.2 → 3.17.1
- djangorestframework-simplejwt 5.3.1 → 5.5.1
- Faker 25.9.1 → 40.18.0 [SKIP-MAJOR]
- filelock 3.24.2 → 3.29.0
- fire 0.7.0 → 0.7.1
- fonttools 4.56.0 → 4.63.0
- google-auth 2.48.0 → 2.53.0
- identify 2.6.16 → 2.6.19
- idna 3.7 → 3.15
- iniconfig 2.1.0 → 2.3.0
- lxml 5.3.1 → 6.1.0 [SKIP-MAJOR]
- numpy 2.2.3 → 2.4.5
- opencv-python-headless 4.11.0.86 → 4.13.0.92
- packaging 24.2 → 26.2 [SKIP-MAJOR]
- pandas 2.2.2 → 3.0.3 [SKIP-MAJOR]
- pillow 10.4.0 → 12.2.0 [SKIP-MAJOR]
- pip 24.0 → 26.1.1 [SKIP-MAJOR]
- platformdirs 4.9.2 → 4.9.6
- pluggy 1.5.0 → 1.6.0
- pre-commit 3.7.1 → 4.6.0 [SKIP-MAJOR]
- pyasn1 0.6.0 → 0.6.3
- pyasn1_modules 0.4.0 → 0.4.2
- pycparser 2.22 → 3.0 [SKIP-MAJOR]
- pydyf 0.11.0 → 0.12.1
- pyHanko 0.25.3 → 0.35.1
- pyhanko-certvalidator 0.26.5 → 0.31.1
- PyJWT 2.8.0 → 2.12.1
- PyMuPDF 1.25.3 → 1.27.2.3
- pypdf 5.3.0 → 6.11.0 [SKIP-MAJOR]
- pytest 8.3.5 → 9.0.3 [SKIP-MAJOR]
- pytest-cov 6.1.0 → 7.1.0 [SKIP-MAJOR]
- pytest-django 4.11.1 → 4.12.0
- python-bidi 0.6.6 → 0.6.10
- python-docx 1.1.2 → 1.2.0
- pytz 2025.2 → 2026.2 [SKIP-MAJOR]
- PyYAML 6.0.2 → 6.0.3
- qrcode 8.0 → 8.2
- reportlab 4.2.5 → 4.5.1
- requests 2.32.3 → 2.34.2
- rsa 4.9 → 4.9.1
- six 1.16.0 → 1.17.0
- soupsieve 2.6 → 2.8.3
- sqlparse 0.5.0 → 0.5.5
- svglib 1.5.1 → 1.6.0
- termcolor 2.5.0 → 3.3.0 [SKIP-MAJOR]
- tinycss2 1.4.0 → 1.5.1
- tinyhtml5 2.0.0 → 2.1.0
- tqdm 4.67.1 → 4.67.3
- typing_extensions 4.12.2 → 4.15.0
- tzdata 2025.2 → 2026.2 [SKIP-MAJOR]
- tzlocal 5.3 → 5.3.1
- uritools 4.0.3 → 6.1.0 [SKIP-MAJOR]
- urllib3 2.2.2 → 2.7.0
- virtualenv 20.36.1 → 21.3.3 [SKIP-MAJOR]
- wcwidth 0.5.2 → 0.7.0
- XlsxWriter 3.2.0 → 3.2.9
- zopfli 0.2.3.post1 → 0.4.1

---

## Plan

### Frontend
- Apply `npm audit fix` to resolve the 13 vulns.
- Run `npx npm-check-updates -u --target minor` to bump devDeps and deps within current major.
- Skip all `[SKIP-MAJOR]` entries above.

### Backend
- Bump 42 packages within current major in `requirements.txt` (operator `==` preserved).
- Stay on Django 5.x (5.2.14) — Django 6.x skipped.
- Skip packages whose only available fix crosses a major: cryptography, lxml, pillow, pypdf, pytest (remaining vulns).
- Skip `svglib 1.6.0` because it requires `lxml>=6.0.0` (incompatible with the pinned `lxml==5.3.1`).

## Updates Applied

### Frontend (commit `deps(frontend): apply patch+minor updates`)
- @babel/core 7.25.2 → 7.29.0
- @babel/parser 7.29.0 → 7.29.3
- @babel/preset-env 7.25.4 → 7.29.5
- @heroicons/vue 2.1.5 → 2.2.0
- @playwright/test 1.41.2 → 1.60.0
- @tailwindcss/forms 0.5.9 → 0.5.11
- @testing-library/jest-dom 6.5.0 → 6.9.1
- @vitejs/plugin-vue 6.0.4 → 6.0.7
- @vue/test-utils 2.4.6 → 2.4.10
- autoprefixer 10.4.19 → 10.5.0
- axios 1.7.2 → 1.16.1
- axios-mock-adapter 2.0.0 → 2.1.0
- bootstrap-icons 1.11.3 → 1.13.1
- docx 9.1.1 → 9.6.1
- dompurify 3.4.1 → 3.4.4
- eslint 9.39.2 → 9.39.4
- eslint-plugin-jest 29.15.0 → 29.15.2
- eslint-plugin-playwright 2.5.1 → 2.10.2
- flowbite 2.3.0 → 2.5.2
- gsap 3.12.7 → 3.15.0
- heroicons 2.1.5 → 2.2.0
- pinia 2.1.7 → 2.3.1
- postcss 8.4.38 → 8.5.14
- sweetalert2 11.14.0 → 11.26.24
- swiper 12.1.2 → 12.1.4
- tailwindcss 3.4.3 → 3.4.19
- tinymce 7.7.0 → 7.9.2
- vite 6.4.1 → 6.4.2
- vite-plugin-pwa 1.2.0 → 1.3.0
- vue 3.4.21 → 3.5.34
- vue-router 4.3.2 → 4.6.4
- vue3-google-login 2.0.33 → 2.1.4
- Final `npm audit`: **0 vulnerabilities** (was 13).
- Remaining outdated (majors skipped intentionally):
  - babel-jest 29.7.0 → 30.4.1
  - babel-plugin-istanbul 6.1.1 → 8.0.0
  - eslint 9.39.4 → 10.4.0
  - flowbite 2.5.2 → 4.0.2
  - jest 29.7.0 → 30.4.2
  - jest-environment-jsdom 29.7.0 → 30.4.1
  - pinia 2.3.1 → 3.0.4
  - tailwindcss 3.4.19 → 4.3.0
  - tinymce 7.9.2 → 8.5.0
  - vite 6.4.2 → 8.0.13
  - vue-router 4.6.4 → 5.0.7

### Backend (commit `deps(backend): apply patch+minor updates`)
- arabic-reshaper 3.0.0 → 3.0.1
- asgiref 3.8.1 → 3.11.1
- beautifulsoup4 4.13.3 → 4.14.3
- Brotli 1.1.0 → 1.2.0
- certifi 2024.6.2 → 2024.12.14
- charset-normalizer 3.3.2 → 3.4.7
- click 8.1.8 → 8.4.0
- coverage 7.8.0 → 7.14.0
- Django 5.0.6 → 5.2.14
- django-cors-headers 4.4.0 → 4.9.0
- djangorestframework 3.15.2 → 3.17.1
- djangorestframework-simplejwt 5.3.1 → 5.5.1
- fire 0.7.0 → 0.7.1
- fonttools 4.56.0 → 4.63.0
- google-auth 2.48.0 → 2.53.0
- idna 3.7 → 3.15
- iniconfig 2.1.0 → 2.3.0
- numpy 2.2.3 → 2.4.5
- opencv-python-headless 4.11.0.86 → 4.13.0.92
- pluggy 1.5.0 → 1.6.0
- pyasn1 0.6.0 → 0.6.3
- pyasn1_modules 0.4.0 → 0.4.2
- PyJWT 2.8.0 → 2.12.0
- PyMuPDF 1.25.3 → 1.27.2.3
- pytest-django 4.11.1 → 4.12.0
- python-bidi 0.6.6 → 0.6.10
- python-docx 1.1.2 → 1.2.0
- PyYAML 6.0.2 → 6.0.3
- qrcode 8.0 → 8.2
- reportlab 4.2.5 → 4.5.1
- requests 2.32.3 → 2.34.2
- rsa 4.9 → 4.9.1
- six 1.16.0 → 1.17.0
- soupsieve 2.6 → 2.8.3
- sqlparse 0.5.0 → 0.5.5
- tinycss2 1.4.0 → 1.5.1
- tinyhtml5 2.0.0 → 2.1.0
- tqdm 4.67.1 → 4.67.3
- typing_extensions 4.12.2 → 4.15.0
- tzlocal 5.3 → 5.3.1
- urllib3 2.2.2 → 2.7.0
- XlsxWriter 3.2.0 → 3.2.9
- `pip-audit` final: **35 vulnerabilities across 6 packages** (was 78 across 16).
- Remaining vulnerable packages (all require major jumps skipped per policy):
  - cryptography==44.0.1 (2 vulns; needs 46.0.5+)
  - lxml==5.3.1 (1 vulns; needs 6.1.0+)
  - pillow==10.4.0 (5 vulns; needs 12.1.1+)
  - pip==24.0 (4 vulns; needs 25.3+)
  - pypdf==5.3.0 (22 vulns; needs 6.0.0+)
  - pytest==8.3.5 (1 vulns; needs 9.0.3+)
- Other outdated skipped:
  - cachetools 5.3.3 → 7.1.2 (major)
  - cffi 1.17.1 → 2.0.0 (major)
  - chardet 5.2.0 → 7.4.3 (major)
  - cryptography 44.0.1 → 48.0.0 (major (vuln remaining))
  - cssselect2 0.7.0 → 0.9.0 (0.x minor)
  - Django 5.2.14 → 6.0.5 (major)
  - django-cleanup 8.1.0 → 9.0.0 (major)
  - Faker 25.9.1 → 40.18.0 (major)
  - lxml 5.3.1 → 6.1.0 (major (vuln remaining))
  - packaging 24.2 → 26.2 (major (date))
  - pandas 2.2.2 → 3.0.3 (major)
  - pillow 10.4.0 → 12.2.0 (major (vuln remaining))
  - pycparser 2.22 → 3.0 (major)
  - pydyf 0.11.0 → 0.12.1 (0.x minor)
  - pyHanko 0.25.3 → 0.35.1 (0.x minor)
  - pyhanko-certvalidator 0.26.5 → 0.31.1 (0.x minor)
  - pypdf 5.3.0 → 6.11.0 (major (vuln remaining))
  - pytest 8.3.5 → 9.0.3 (major (vuln remaining))
  - pytest-cov 6.1.0 → 7.1.0 (major)
  - pytz 2025.2 → 2026.2 (major (date))
  - svglib 1.5.1 → 1.6.0 (requires lxml>=6.0 (rollback))
  - termcolor 2.5.0 → 3.3.0 (major)
  - tzdata 2025.2 → 2026.2 (major (date))
  - uritools 4.0.3 → 6.1.0 (major)
  - zopfli 0.2.3.post1 → 0.4.1 (0.x minor)

## Rollbacks

- `svglib`: initially bumped to `1.6.0` by the plan but reverted to `1.5.1` because svglib 1.6.0 requires `lxml>=6.0.0`, and `lxml` cannot be bumped to 6.x within the patch+minor policy. Tracked as remaining outdated.

## Verification Results

### Frontend
- `npm audit`: 0 vulnerabilities (was 13: 6 high, 7 moderate).
- `npm run build`: ✓ built in 6m 56s; PWA + Django template generated successfully.

### Backend
- `python manage.py check`: `System check identified no issues (0 silenced).`
- `pytest --collect-only -q`: 2895 tests collected without errors.
- Slice `pytest gym_app/tests/utils/test_auth_utils.py -v`: **2 passed** in 23.31s.
