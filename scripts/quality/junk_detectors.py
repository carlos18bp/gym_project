"""
Junk-test detectors.

The pre-existing rules in this package check the *form* of a test: does it have
assertions, does it sleep, is the locator fragile. None of them ask the only
question that matters — does this test actually exercise the behavior it claims
to cover? A spec that does `page.goto('/')` and asserts a footer is visible
passes every one of them, and then counts as coverage for a flow named
"Footer Navigation".

That gap is what these detectors close. They read the source slice of each test
rather than the Babel AST, for three reasons:

1. The AST parser (`frontend/scripts/ast-parser.cjs`) is a per-project file and
   has diverged into four independent implementations across the fleet, so a
   rule added there would have to be written four times.
2. `@babel/parser` is absent on hosts that prune frontend dev dependencies, and
   the frontend suites are exactly where junk accumulates — detection must keep
   working there.
3. The rules are about which calls appear inside a test body, which the source
   answers directly.

All detectors are pure functions over `TestBlock`, so they are equally usable
from the gate and from an audit that walks a whole corpus.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

# ---------------------------------------------------------------------------
# Vocabulary
# ---------------------------------------------------------------------------

# Calls that represent a human doing something to the UI.
INTERACTION_CALLS: frozenset[str] = frozenset({
    "click", "dblclick", "fill", "type", "press", "pressSequentially",
    "check", "uncheck", "setChecked", "selectOption", "setInputFiles",
    "hover", "dragTo", "tap", "clear", "focus",
    # Vue Test Utils / Testing Library equivalents, for unit specs.
    "trigger", "setValue", "userEvent",
})

# Assertions that pin down actual content or application state.
DATA_ASSERTIONS: frozenset[str] = frozenset({
    "toHaveText", "toContainText", "toHaveValue", "toHaveURL", "toHaveCount",
    "toHaveAttribute", "toHaveTitle", "toHaveJSProperty", "toEqual",
    "toMatchObject", "toStrictEqual",
    # Concrete, falsifiable UI-state matchers: an element being disabled/enabled/
    # checked is a real assertion about behaviour (e.g. "submit is disabled while
    # the cart is empty"), not mere presentation like toBeVisible.
    "toBeDisabled", "toBeEnabled", "toBeChecked",
})

# Assertions that are satisfied by almost any DOM, so they cannot fail
# meaningfully. `toBeAttached` is the worst offender: it passes for elements the
# user cannot even see.
WEAK_ASSERTIONS: frozenset[str] = frozenset({
    "toBeTruthy", "toBeDefined", "toBeAttached",
})

# Verbs whose action is impossible without a specific, distinctive call. A bare
# `click` is deliberately never the requirement: any decoy click would satisfy
# it, which would make the rule unfalsifiable. Only calls that the action
# genuinely cannot happen without are listed here.
REQUIRED_CALL_VERBS: dict[str, frozenset[str]] = {
    "login": frozenset({"fill", "pressSequentially", "type"}),
    "signin": frozenset({"fill", "pressSequentially", "type"}),
    "register": frozenset({"fill", "pressSequentially", "type"}),
    "signup": frozenset({"fill", "pressSequentially", "type"}),
    "search": frozenset({"fill", "type", "pressSequentially", "selectOption"}),
    "upload": frozenset({"setInputFiles"}),
}

# Verbs that change server or application state. These cannot be pinned to one
# call, but they share a stronger property: if the mutation happened, something
# observable must have changed. A "delete" test that only asserts a table is
# still visible has not tested the delete.
MUTATING_VERBS: frozenset[str] = frozenset({
    "delete", "remove", "create", "add", "update", "edit", "submit", "send",
    "save", "pay", "checkout", "purchase", "accept", "reject", "approve",
    "cancel", "archive", "publish", "invite", "assign",
})

# Evidence that a test checked the resulting state, not just the starting one.
_STATE_CHANGE_RE = re.compile(
    r"\.not\.|toHaveCount\(|toBeHidden\(|toHaveText\(|toContainText\(|"
    r"toHaveValue\(|toHaveURL\(|toHaveAttribute\(|getByRole\(\s*['\"](?:alert|status)['\"]|"
    r"toBeDisabled\(|toBeEnabled\(|toBeChecked\(|"
    r"toEqual\(|toMatchObject\(|toStrictEqual\(|toHaveBeenCalled|"
    # A content-bearing locator asserted after the action is the mutation's
    # observable result: "submit → getByText('Request received') is visible" is
    # the canonical form-submission assertion. Flagging it as a tag mismatch
    # treated correct success/error-message tests as junk.
    r"getByText\(|getByRole\([^)]*name\s*:|\.toBe\("
)

# Opt-out markers, mirroring the existing `quality: allow-*` convention.
ALLOW_MARKERS: dict[str, str] = {
    "allow-no-interaction": "no_user_interaction",
    "allow-deep-link": "deep_link_entry",
    "allow-render-only": "no_data_assertion",
    "allow-duplicate": "duplicate_coverage",
    "allow-mock-only": "mock_only_assertion",
    "allow-reimpl": "reimplements_sut",
    # flow_tag_mismatch was the only suppressible-class rule WITHOUT an escape
    # hatch. A structurally atypical but excellent test — an OAuth login that
    # authenticates through a popup and so never types into the page itself —
    # had no way to opt out, leaving the finding as a permanent CI-breaker.
    # Same contract as every other marker: a written reason is required and
    # the gate surfaces the active exception.
    "allow-flow-tag-mismatch": "flow_tag_mismatch",
    # F41 ships with its escape hatch from day one (the F32 lesson): a test
    # that legitimately accepts two destinations documents why.
    "allow-url-alternation": "tautological_url",
}

# `test`/`it` must be a standalone identifier, never a method. A plain \b here
# also matched `/^regex$/.test(apiPath)` and `str.it(...)`, which invented test
# blocks inside API mock helpers and then reported them as duplicates of each
# other.
_TEST_CALL_RE = re.compile(r"(?<![.\w$])(test|it)((?:\.\w+)*)\s*\(")

# Modifier chains that are not tests: suites, hooks and configuration.
_NON_TEST_MODIFIERS: frozenset[str] = frozenset({
    "describe", "beforeeach", "aftereach", "beforeall", "afterall",
    "use", "step", "slow", "settimeout", "info", "extend",
})

# Suite headers. Playwright applies a describe's `{ tag: [...] }` option to
# every test inside its callback, but extract_test_blocks rightly skips
# describes as non-tests — so suite-level tags simply vanished, and a spec
# that tags only at describe level (kore tags 100% of its suites this way)
# read as fully untagged: covered fell to 0/104. Matches the plain call and
# the `.serial` / `.parallel` / `.only` chains, plus bare jest/vitest
# `describe(`.
_DESCRIBE_CALL_RE = re.compile(r"(?<![.\w$])(?:(?:test|it)\.)?describe((?:\.\w+)*)\s*\(")

# `test('name', TAGS, fn)` — the whole options OBJECT passed as an identifier.
# Matched against the masked argument list (string contents blanked, delimiters
# kept), so the title collapses to `'   '` and cannot fake the shape. Requires
# a comma after the identifier: a function-reference body (`test('n', fn)`) has
# none, so it never reads as options.
_OPTIONS_IDENT_RE = re.compile(r"\s*(['\"`])\s*\1\s*,\s*([A-Za-z_$][\w$]*)\s*,")


@dataclass
class TestBlock:
    """One test invocation, with the source of its whole call expression."""

    name: str
    start_line: int
    end_line: int
    source: str
    file: str
    flow_ids: list[str] = field(default_factory=list)
    outcomes: list[str] = field(default_factory=list)
    allow_markers: set[str] = field(default_factory=set)
    # Options-object source of every enclosing tag-carrying describe, outermost
    # first — plus, when the test passes its options as an identifier
    # (`test('n', TAGS, fn)`), the resolved object's own source. Playwright
    # semantics: suite-level tags apply to every test inside.
    # Literal `@flow:`/`@outcome:` entries are merged into flow_ids/outcomes at
    # extraction; the spread constants in these regions are resolved lazily by
    # resolve_flow_ids (they may need the module an object is imported from).
    inherited_tags: list[str] = field(default_factory=list)
    # Test body plus the helper bodies it reaches; set by the analyze_* entry
    # points. Behavioral rules read this, line-attributed rules read `source`.
    expanded: str = ""

    @property
    def reach(self) -> str:
        """Everything this test actually executes."""
        return self.expanded or self.source

    def calls(self) -> set[str]:
        """Method names invoked anywhere this test reaches."""
        return set(re.findall(r"\.(\w+)\s*\(", self.reach))

    def interactions(self) -> set[str]:
        return self.calls() & INTERACTION_CALLS

    def assertions(self) -> set[str]:
        return {c for c in self.calls() if c.startswith("toBe") or c.startswith("toHave")
                or c.startswith("toContain") or c.startswith("toEqual")
                or c.startswith("toMatch") or c.startswith("toStrict")}

    def fingerprint(self) -> str:
        """
        Hash of the test body: comments and formatting removed, literals kept.

        Literals are deliberately preserved. An earlier version normalised them
        away, which collapsed

            it('renders the digital landscape title', ...toContain('Digital Landscape'))
            it('renders the team support title',      ...toContain('Team Support'))

        into "duplicates" — 408 of them in one suite. Those tests share a shape
        but assert different things; merging them would delete real coverage.
        Only the test title is excluded, so a test copied under a new name is
        still caught.

        Each string/template literal becomes a token derived from its exact
        content, applied BEFORE collapsing whitespace. Keeps distinct values
        distinct (the whole point) and stops the whitespace collapse from
        turning `''` and `'   '` into the same token — isNonEmpty('') and
        isNonEmpty('   ') are different tests, and merging them deletes real
        coverage of the whitespace case.
        """
        body = re.sub(r"\s+", "", _fingerprint_normalize(self.body_source()))
        return hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]

    def body_source(self) -> str:
        """Test source with its title literal removed, so renames still match."""
        if not self.name:
            return self.source
        return self.source.replace(self.name, "", 1)


# ---------------------------------------------------------------------------
# Source scanning
# ---------------------------------------------------------------------------

# Characters after which a `/` opens a regex literal rather than a division:
# JS expects an expression there. `>` also covers `=>` (arrow bodies). After an
# identifier, a digit, `)`, `]` or a closing quote the `/` divides instead.
_REGEX_PRECEDERS = frozenset("(,=:[!&|?{;>~^%")

# Keywords after which a regex literal may start even though the previous
# character is an identifier character (`return /x/.test(s)`).
_REGEX_PRECEDING_KEYWORDS = frozenset({
    "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
    "throw", "case", "do", "else", "yield", "await",
})


def _regex_literal_end(source: str, out: list[str], start: int) -> int:
    """
    Index just past the regex literal opened at `start`, or -1 if `source[start]`
    is not a regex opener (division, or an unterminated candidate).

    The decision is positional: a `/` starts a regex only where JS expects an
    expression. The last significant character already EMITTED (`out`, where
    string/comment contents are blanked but delimiters survive) tells which
    side of that fence we are on — after `(`, `,`, `=`… a regex; after an
    identifier, `)`, `]` or a closing quote, a division.
    """
    j = start - 1
    while j >= 0 and out[j] in " \t\r\n":
        j -= 1
    if j >= 0:
        prev = out[j]
        if prev not in _REGEX_PRECEDERS:
            if not (prev.isalnum() or prev in "_$"):
                return -1  # `)`, `]`, quotes, `.`… — a division position.
            word_end = j + 1
            while j >= 0 and (out[j].isalnum() or out[j] in "_$"):
                j -= 1
            if "".join(out[j + 1:word_end]) not in _REGEX_PRECEDING_KEYWORDS:
                return -1  # A plain identifier or number: division.

    # Consume the literal: `\x` never closes, `/` inside a `[...]` class does
    # not close, and an unescaped newline means this was never a regex.
    i = start + 1
    n = len(source)
    in_class = False
    while i < n:
        ch = source[i]
        if ch == "\\":
            i += 2
            continue
        if ch == "\n":
            return -1
        if in_class:
            if ch == "]":
                in_class = False
        elif ch == "[":
            in_class = True
        elif ch == "/":
            i += 1
            while i < n and source[i].isalpha():  # flags
                i += 1
            return i
        i += 1
    return -1


def _strip_for_scanning(source: str) -> str:
    """
    Blank out string, comment and regex-literal content, preserving length and
    newlines.

    String delimiters are kept so offsets stay aligned with the original
    source; only the contents are replaced, so a brace inside a string cannot
    fool the paren matcher. Regex literals are blanked whole: a `\\//` or a
    quote inside one otherwise reads as a comment or string opener and
    desynchronizes everything after it.
    """
    out = list(source)
    i = 0
    n = len(source)
    while i < n:
        ch = source[i]
        if ch in "\"'`":
            quote = ch
            i += 1
            while i < n:
                if source[i] == "\\":
                    if source[i] != "\n":
                        out[i] = " "
                    i += 1
                    if i < n and source[i] != "\n":
                        out[i] = " "
                    i += 1
                    continue
                if source[i] == quote:
                    break
                if source[i] != "\n":
                    out[i] = " "
                i += 1
            i += 1
            continue
        if ch == "/" and i + 1 < n and source[i + 1] == "/":
            while i < n and source[i] != "\n":
                out[i] = " "
                i += 1
            continue
        if ch == "/" and i + 1 < n and source[i + 1] == "*":
            while i + 1 < n and not (source[i] == "*" and source[i + 1] == "/"):
                if source[i] != "\n":
                    out[i] = " "
                i += 1
            if i + 1 < n:
                out[i] = " "
                out[i + 1] = " "
            i += 2
            continue
        if ch == "/":
            end = _regex_literal_end(source, out, i)
            if end != -1:
                for j in range(i, end):  # literal has no newlines by construction
                    out[j] = " "
                i = end
                continue
        i += 1
    return "".join(out)


def _fingerprint_normalize(body: str) -> str:
    """
    Normalize a test body for fingerprinting in ONE positional pass: comments
    are dropped, each string/template literal becomes a token derived from its
    exact content, regex literals and code are kept verbatim.

    The single pass is the point. An earlier version masked strings globally
    FIRST and stripped comments SECOND, so an apostrophe inside a `// comment`
    opened a phantom string that paired with the next real quote. The phantom's
    token swallowed the newlines after it, gluing the rest of the body onto the
    comment's line — which the subsequent `//` removal then deleted whole.
    Neighbouring tests whose differences lived in that tail collapsed into one
    fingerprint and reported each other as ERROR-level duplicates (measured on
    kore). Same failure class that motivated _strip_for_scanning: strings,
    comments and regex literals must be decided in the same positional pass,
    never strings-first-globally.
    """
    aligned = list(body)  # positional shadow for _regex_literal_end lookbacks
    pieces: list[str] = []
    i = 0
    n = len(body)
    while i < n:
        ch = body[i]
        if ch in "\"'`":
            quote = ch
            j = i + 1
            while j < n:
                if body[j] == "\\":
                    aligned[j] = " "
                    if j + 1 < n:
                        aligned[j + 1] = " "
                    j += 2
                    continue
                if body[j] == quote:
                    break
                aligned[j] = " "
                j += 1
            # Token over the raw content between the delimiters — byte-for-byte
            # what the pre-2026-07 global substitution hashed, so fingerprints
            # of bodies without pathological comments do not move.
            content = body[i + 1:j]
            pieces.append("S" + hashlib.md5(content.encode("utf-8")).hexdigest()[:8])
            i = j + 1
            continue
        if ch == "/" and i + 1 < n and body[i + 1] == "/":
            while i < n and body[i] != "\n":
                aligned[i] = " "
                i += 1
            continue
        if ch == "/" and i + 1 < n and body[i + 1] == "*":
            while i + 1 < n and not (body[i] == "*" and body[i + 1] == "/"):
                if body[i] != "\n":
                    aligned[i] = " "
                i += 1
            if i + 1 < n:
                aligned[i] = " "
                aligned[i + 1] = " "
            i += 2
            continue
        if ch == "/":
            # Kept verbatim, unlike _strip_for_scanning: two tests differing
            # only in a regex literal are different tests, and blanking the
            # pattern would merge them into a false duplicate.
            end = _regex_literal_end(body, aligned, i)
            if end != -1:
                pieces.append(body[i:end])
                i = end
                continue
        pieces.append(ch)
        i += 1
    return "".join(pieces)


def _match_paren(masked: str, open_idx: int) -> int:
    """Index just past the paren that closes the one at `open_idx`, or -1."""
    depth = 0
    for i in range(open_idx, len(masked)):
        if masked[i] == "(":
            depth += 1
        elif masked[i] == ")":
            depth -= 1
            if depth == 0:
                return i + 1
    return -1


def _describe_tag_options(source: str, masked: str) -> list[tuple[int, int, str]]:
    """
    `(span_start, span_end, options_source)` for each tag-carrying describe.

    Only the describe's OPTIONS object is captured, never its callback body:
    a test's own `tag:` (or a data spread like `{ ...DOC }`) inside the suite
    must not leak onto sibling tests. The two are told apart positionally — an
    object ARGUMENT follows `(` or `,`, while a callback body's `{` follows
    `=>` or the `)` of a `function ()` header. Structure is read off `masked`,
    so a brace or paren inside the suite title cannot desynchronize the walk;
    the options text is sliced from the real source because the tags ARE
    string content, which masking blanks.
    """
    regions: list[tuple[int, int, str]] = []
    for match in _DESCRIBE_CALL_RE.finditer(masked):
        open_idx = match.end() - 1
        close_idx = _match_paren(masked, open_idx)
        if close_idx == -1:
            continue

        options: list[str] = []
        depth = 0    # ( ) nesting relative to the describe's own parens
        bracket = 0  # [ ] nesting — an object inside an array is data, not options
        i = open_idx + 1
        while i < close_idx - 1:
            ch = masked[i]
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            elif ch == "[":
                bracket += 1
            elif ch == "]":
                bracket -= 1
            elif ch == "{" and depth == 0 and bracket == 0:
                end = _matched_brace_end(masked, i)
                if end == -1:
                    break
                j = i - 1
                while j > open_idx and masked[j] in " \t\r\n":
                    j -= 1
                if masked[j] not in ">)":
                    options.append(source[i:end])
                i = end
                continue
            i += 1

        tagged = [o for o in options if re.search(r"\btag\s*:", o)]
        if tagged:
            regions.append((match.start(), close_idx, "\n".join(tagged)))
    return regions


def extract_test_blocks(source: str, file: str = "") -> list[TestBlock]:
    """
    Find every test invocation in a spec file.

    Uses a masked copy for structure so that braces and parens inside strings,
    template literals and comments cannot break the matching, then slices the
    real source for content.
    """
    masked = _strip_for_scanning(source)
    suite_tags = _describe_tag_options(source, masked)
    blocks: list[TestBlock] = []

    for match in _TEST_CALL_RE.finditer(masked):
        modifiers = [m for m in match.group(2).split(".") if m]
        if any(mod.lower() in _NON_TEST_MODIFIERS for mod in modifiers):
            continue

        open_idx = match.end() - 1
        close_idx = _match_paren(masked, open_idx)
        if close_idx == -1:
            continue

        raw = source[match.start():close_idx]

        # A real test declaration takes a callback. `test.skip(cond, 'reason')`
        # and `test.slow(cond, 'reason')` are conditional STATEMENTS inside a
        # test, not declarations — they carry no function, and parsing them as
        # tests invented a phantom test named after the skip reason, with no
        # interactions, that then tripped no_user_interaction. (Same shape as
        # the regex `.test()` case: the token is right, the call is not a test.)
        # A genuinely skipped test — test.skip('name', () => {...}) — keeps its
        # callback and is still analysed.
        masked_raw = masked[match.start():close_idx]
        if not re.search(r"=>|\bfunction\b", masked_raw):
            continue

        start_line = source.count("\n", 0, match.start()) + 1
        end_line = source.count("\n", 0, close_idx) + 1

        name_match = re.search(r"(['\"`])((?:\\.|(?!\1).)*)\1", raw, flags=re.DOTALL)
        name = name_match.group(2) if name_match else ""

        # Union of every enclosing describe's tags (Playwright applies them to
        # each test inside): literals merge here, spreads wait for
        # resolve_flow_ids, which can follow the module they come from.
        flow_ids = re.findall(r"@flow:([\w.-]+)", raw)
        outcomes = re.findall(r"@outcome:([\w.-]+)", raw)
        inherited = [opts for s, e, opts in suite_tags if s < match.start() < e]

        # Options passed as an identifier — `test('n', TAGS, fn)` where
        # `const TAGS = { tag: [...] }`. No `tag:` appears in the call source,
        # so without resolving the declaration both the literal scan above and
        # resolve_flow_ids read the test as untagged (real case: four
        # process-alert specs reported "missing" around excellent tests). The
        # resolved object joins `inherited`, which gives it exactly the
        # describe-options treatment: literals merge below, spreads and nested
        # identifiers resolve lazily. Local declarations only — the shape
        # observed in the wild; an unresolvable identifier contributes nothing.
        opts_ref = _OPTIONS_IDENT_RE.match(masked, open_idx + 1)
        if opts_ref and opts_ref.end() <= close_idx:
            decl = re.search(rf"\b{re.escape(opts_ref.group(2))}\s*=\s*\{{", masked)
            if decl:
                obj_end = _matched_brace_end(masked, decl.end() - 1)
                if obj_end != -1:
                    opts_source = source[decl.end() - 1:obj_end]
                    if re.search(r"\btag\s*:", opts_source):
                        inherited = inherited + [opts_source]

        for opts in inherited:
            flow_ids += [f for f in re.findall(r"@flow:([\w.-]+)", opts) if f not in flow_ids]
            outcomes += [o for o in re.findall(r"@outcome:([\w.-]+)", opts) if o not in outcomes]

        blocks.append(TestBlock(
            name=name,
            start_line=start_line,
            end_line=end_line,
            source=raw,
            file=file,
            flow_ids=flow_ids,
            outcomes=outcomes,
            allow_markers={
                rule for marker, rule in ALLOW_MARKERS.items()
                if re.search(rf"quality:\s*{re.escape(marker)}", raw, re.IGNORECASE)
            },
            inherited_tags=inherited,
        ))

    return blocks


# ---------------------------------------------------------------------------
# Helper resolution
# ---------------------------------------------------------------------------
#
# Well-factored specs push their interactions into helpers:
#
#     async function openClosingPanel(page) { ...clicks... }
#     test('...', async ({page}) => { await openClosingPanel(page); ... })
#
# Reading only the test body would report "no user interaction" for exactly the
# best-written specs, which would discredit the rule on day one. So a test's
# effective source includes the bodies of the helpers it calls, resolved both
# within the file and across relative imports.

_FUNC_DECL_RE = re.compile(r"\b(?:async\s+)?function\s+(\w+)\s*\(")
# Arrow assignments: group 2 distinguishes a parenthesized param list (matched
# structurally below, so destructured/typed params with nested parens resolve)
# from the bare single-param form (`const f = x => …`).
_FUNC_CONST_RE = re.compile(r"\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(\(|\w+\s*=>)")
_IMPORT_RE = re.compile(r"import\s+\{([^}]*)\}\s+from\s+['\"](\.[^'\"]*)['\"]")

_MAX_HELPER_DEPTH = 3


def _matched_brace_end(masked: str, brace: int) -> int:
    """Index just past the brace that closes the one at `brace`, or -1."""
    depth = 0
    for i in range(brace, len(masked)):
        if masked[i] == "{":
            depth += 1
        elif masked[i] == "}":
            depth -= 1
            if depth == 0:
                return i + 1
    return -1


def _function_bodies(source: str) -> dict[str, str]:
    """Map every function defined in a module to its source text."""
    masked = _strip_for_scanning(source)
    bodies: dict[str, str] = {}

    for match in _FUNC_DECL_RE.finditer(masked):
        # Match the param list structurally first: a destructured default
        # (`{ title }: {...} = {}`) puts a `{` inside the parens, and taking
        # the first `{` after the name captured the params as the body.
        close = _match_paren(masked, match.end() - 1)
        if close == -1:
            continue
        brace = masked.find("{", close)
        if brace == -1:
            continue
        end = _matched_brace_end(masked, brace)
        if end != -1:
            bodies[match.group(1)] = source[match.start():end]

    for match in _FUNC_CONST_RE.finditer(masked):
        if match.group(2).startswith("("):
            close = _match_paren(masked, match.start(2))
            if close == -1:
                continue
            arrow = masked.find("=>", close)
            if arrow == -1:
                continue
            # Only whitespace or a TS return-type annotation may sit between
            # the params and the arrow; anything else is not this function.
            gap = masked[close:arrow].strip()
            if gap and not gap.startswith(":"):
                continue
            after = arrow + 2
        else:
            after = match.end()

        brace = after + (len(masked[after:]) - len(masked[after:].lstrip()))
        if brace >= len(masked) or masked[brace] != "{":
            continue  # Concise arrow body — nothing to inline.
        end = _matched_brace_end(masked, brace)
        if end != -1:
            bodies[match.group(1)] = source[match.start():end]

    return bodies


def _resolve_import_bodies(source: str, spec_path: Path | None) -> dict[str, str]:
    """Pull in functions a spec imports from sibling helper modules."""
    if spec_path is None:
        return {}

    bodies: dict[str, str] = {}
    for names, rel in _IMPORT_RE.findall(source):
        imported = {n.strip().split(" as ")[0].strip() for n in names.split(",") if n.strip()}
        if not imported:
            continue

        target = (spec_path.parent / rel).resolve()
        candidates = [target]
        if not target.suffix:
            candidates = [target.with_suffix(ext) for ext in (".js", ".ts", ".mjs")]
        candidates += [target / f"index{ext}" for ext in (".js", ".ts")]

        for candidate in candidates:
            if not candidate.is_file():
                continue
            try:
                helper_source = candidate.read_text(encoding="utf-8", errors="replace")
            except OSError:
                break
            for name, body in _function_bodies(helper_source).items():
                if name in imported:
                    bodies[name] = body
            break

    return bodies


def effective_source(block: TestBlock, known: dict[str, str]) -> str:
    """
    The test body plus the bodies of every helper it reaches.

    Expansion is transitive up to a small depth so helper-calls-helper chains
    resolve, and each helper is inlined once to avoid cycles blowing up.
    """
    combined = block.source
    seen: set[str] = set()

    for _ in range(_MAX_HELPER_DEPTH):
        called = set(re.findall(r"\b(\w+)\s*\(", combined))
        pending = [name for name in called if name in known and name not in seen]
        if not pending:
            break
        for name in pending:
            seen.add(name)
            combined += "\n" + known[name]

    return combined


# Helper-module sources read while resolving imported tag constants. The audit
# calls resolve_flow_ids once per test block, so a shared flow-tags module would
# otherwise be re-read for every block in the suite.
_MODULE_TEXT_CACHE: dict[str, str | None] = {}


def _module_text(path: Path) -> str | None:
    key = str(path)
    if key not in _MODULE_TEXT_CACHE:
        try:
            _MODULE_TEXT_CACHE[key] = (
                path.read_text(encoding="utf-8", errors="replace")
                if path.is_file() else None
            )
        except OSError:
            _MODULE_TEXT_CACHE[key] = None
    return _MODULE_TEXT_CACHE[key]


def _import_candidates(name: str, source: str, spec_path: Path | None) -> list[Path]:
    """Module files a relative named import of `name` may resolve to, in probe order."""
    if spec_path is None:
        return []
    imp = re.search(
        rf"import\s*(?:type\s+)?\{{[^}}]*\b{re.escape(name)}\b[^}}]*\}}\s*"
        rf"from\s*['\"](\.[^'\"]+)['\"]",
        source,
    )
    if not imp:
        return []
    target = (spec_path.parent / imp.group(1)).resolve()
    candidates = [target] if target.suffix else []
    candidates += [target.with_suffix(ext) for ext in (".ts", ".js", ".tsx")]
    return candidates


def _imported_flow_ids(const: str, source: str, spec_path: Path | None) -> list[str] | None:
    """
    Flow ids declared by a tag constant imported from a relative module.

    Returns None when the module (or the constant's declaration inside it)
    cannot be resolved, so the caller can fall back to the name-derived hint.
    A resolved declaration wins even when it carries no `@flow:` entries —
    same semantics as a locally defined constant.
    """
    for candidate in _import_candidates(const, source, spec_path):
        text = _module_text(candidate)
        if text is None:
            continue
        decl = re.search(
            rf"\b{re.escape(const)}\s*=\s*\[([^\]]*)\]", text, flags=re.DOTALL
        )
        if decl:
            return re.findall(r"@flow:([\w.-]+)", decl.group(1))
    return None


# Masked variants of module/spec texts scanned for object-literal declarations.
# resolve_flow_ids runs per test block, so without this the same flow-tags
# catalog (and the spec itself) would be re-masked for every block in a suite.
_MASKED_TEXT_CACHE: dict[str, str] = {}


def _masked_text(text: str) -> str:
    masked = _MASKED_TEXT_CACHE.get(text)
    if masked is None:
        masked = _MASKED_TEXT_CACHE[text] = _strip_for_scanning(text)
    return masked


def _object_member_flow_ids(text: str, obj: str, member: str) -> list[str] | None:
    """
    `@flow:` ids in the MEMBER array of `<obj> = { ..., MEMBER: [...], ... }`.

    This is the namespaced-catalog shape suites spread as
    `tag: [...FlowTags.AUTH_LOGIN]`, where the module declares one big object
    (`export const FlowTags = { AUTH_LOGIN: ['@flow:auth-login', ...], ... }`)
    instead of loose constants. Returns None when the object declaration or
    that member cannot be found in `text`. The declaration and its brace span
    are located on masked text (a brace inside a string must not cut the
    object short, and a decoy `X = {` inside a string must not match at all);
    the ids come from the original slice because tags are string content.
    """
    masked = _masked_text(text)
    decl = re.search(rf"\b{re.escape(obj)}\s*=\s*\{{", masked)
    if not decl:
        return None
    end = _matched_brace_end(masked, decl.end() - 1)
    if end == -1:
        return None
    body = text[decl.end() - 1:end]
    entry = re.search(rf"\b{re.escape(member)}\s*:\s*\[([^\]]*)\]", body, flags=re.DOTALL)
    if entry is None:
        return None
    return re.findall(r"@flow:([\w.-]+)", entry.group(1))


def _imported_object_member_flow_ids(
    obj: str, member: str, source: str, spec_path: Path | None
) -> list[str] | None:
    """
    Flow ids for `...Obj.MEMBER` where Obj is imported from a relative module.

    None when the import, the module, the object or the member is unresolvable.
    """
    for candidate in _import_candidates(obj, source, spec_path):
        text = _module_text(candidate)
        if text is None:
            continue
        ids = _object_member_flow_ids(text, obj, member)
        if ids is not None:
            return ids
    return None


# A spread reference inside a tag array: a bare constant (`...ADMIN_LOGIN`) or
# one namespaced member deep (`...FlowTags.AUTH_LOGIN`). The old pattern
# required ALL_CAPS and could not cross the dot, so a namespaced spread
# captured just its first capital letter (`F`) and resolved to garbage.
_SPREAD_REF_RE = re.compile(r"\.\.\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)")
# Bare spreads keep the original ALL_CAPS tag-constant contract: widening them
# to any identifier would mint name-hints out of lowercase data spreads.
_PLAIN_TAG_CONST_RE = re.compile(r"[A-Z][A-Z0-9_]*\Z")
# The whole `tag:` option VALUE as one identifier (`tag: TAGS`,
# `tag: FlowTags.MINUTAS`) instead of an array literal. The bracket-based
# region scan cannot see these at all, so suites tagged this way read as
# fully untagged (real case: two minutas specs reported "missing").
_TAG_VALUE_IDENT_RE = re.compile(
    r"\btag\s*:\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)"
)


def resolve_flow_ids(
    block: TestBlock, source: str, spec_path: Path | None = None
) -> list[str]:
    """
    Resolve flow ids for a test, following tag constants defined in the file.

    Specs commonly tag with an imported constant (`tag: [...ADMIN_LOGIN]`)
    instead of a literal `@flow:` string. Without this the tag looks absent and
    every flow rule silently no-ops — the same failure mode that let the junk
    accumulate in the first place. Two shapes on top of the test's own tags:

    * Suite-level tags (`block.inherited_tags`): a describe's `{ tag: [...] }`
      applies to every test inside it, so those regions are scanned exactly
      like the test's own — the union of all enclosing describes and the test.
    * Namespaced spreads (`...FlowTags.AUTH_LOGIN`): resolved to the member
      array of the object literal, local or imported. No name-derived hint for
      these — a fallback like `flowtags.auth-login` credits nothing real, so an
      unresolvable namespaced spread contributes nothing.
    * Identifier tag values (`tag: TAGS`): the identifier's array declaration
      is the region — its literals count and its nested spreads resolve. An
      unresolvable identifier contributes nothing: names like `TAGS` derive
      no flow anyone declared.
    * Alias arrays: a spread whose local declaration itself spreads other
      constants (`tag: [...TAGS]` over `const TAGS = [...DOCS_COLS, '@role:x']`)
      resolves transitively, cycle-safe.

    Literals and constants always UNION. There is deliberately no early return
    on `block.flow_ids`: a mixed array `{ tag: [...MY_CONST, '@flow:other'] }`
    used to short-circuit on the literal and never resolve the spread, so the
    flow behind MY_CONST read as missing while a qualified test carried it
    (real case: tuhuella my-applications-list).

    `spec_path` lets an imported constant be resolved to the actual ids its
    module declares (a name-derived guess like `d3-obs` credits nothing when
    the real id is `d3-anchored-observations`). Without it, or when the module
    is unresolvable, a bare constant's name is still used as a flow-shaped hint.
    """
    if spec_path is None and block.file and Path(block.file).is_file():
        spec_path = Path(block.file)

    # Literal tags first: the test's own plus the ones every enclosing
    # describe already merged into flow_ids at extraction.
    ids: list[str] = list(block.flow_ids)
    # Spreads count as flow tags only inside a `tag: [...]` option. Scanning
    # the whole body read data spreads in mocks (`{ ...DOC, ...patchBody }`)
    # as tag constants and invented phantom flows like "doc". A block can
    # carry more than one tag array (its own and each suite's), so every
    # region is scanned.
    option_sources = [block.source, *block.inherited_tags]
    tag_regions: list[str] = []
    for text in option_sources:
        tag_regions += re.findall(r"\btag\s*:\s*\[([^\]]*)\]", text)

    # Identifier tag values: `tag: TAGS` (array constant) or
    # `tag: FlowTags.MINUTAS` (namespaced member). A dotted reference behaves
    # exactly like a spread of the member, so it is handed to the spread loop
    # below; a bare one resolves to its local array declaration — whose content
    # becomes a region, so `const TAGS = [...IMPORTED, '@role:x']` still
    # follows the import — or to the imported constant's declared ids.
    for text in option_sources:
        for ref in _TAG_VALUE_IDENT_RE.findall(text):
            if "." in ref:
                tag_regions.append("..." + ref)
                continue
            local = re.search(
                rf"\b{re.escape(ref)}\s*=\s*\[([^\]]*)\]", source, flags=re.DOTALL
            )
            if local:
                ids.extend(re.findall(r"@flow:([\w.-]+)", local.group(1)))
                tag_regions.append(local.group(1))
                continue
            imported = _imported_flow_ids(ref, source, spec_path)
            if imported:
                ids.extend(imported)
            # Unresolvable: nothing. Unlike a bare SPREAD constant (usually
            # flow-shaped, e.g. ADMIN_LOGIN), a whole-value identifier is
            # generically named — a hint like "tags" credits no real flow.

    # Worklist, because spreads resolve TRANSITIVELY through local alias
    # arrays: `{ tag: [...TAGS] }` with `const TAGS = [...DOCS_COLS, '@role:x']`
    # reaches the imported constant two hops away (real case: gym
    # minutas-columns, which read as missing while every hop was declared).
    # A resolved local declaration is itself a tag region — its literals count
    # and its nested spreads are enqueued; the seen-set terminates cycles.
    pending: list[str] = _SPREAD_REF_RE.findall("\n".join(tag_regions))
    seen_refs: set[str] = set()
    while pending:
        ref = pending.pop(0)
        if ref in seen_refs:
            continue
        seen_refs.add(ref)
        if "." in ref:
            obj, member = ref.split(".", 1)
            resolved = _object_member_flow_ids(source, obj, member)
            if resolved is None:
                resolved = _imported_object_member_flow_ids(obj, member, source, spec_path)
            ids.extend(resolved or [])
            continue
        if not _PLAIN_TAG_CONST_RE.fullmatch(ref):
            continue
        # Constant defined locally in this file?
        local = re.search(
            rf"\b{ref}\s*=\s*\[([^\]]*)\]", source, flags=re.DOTALL
        )
        if local:
            ids.extend(re.findall(r"@flow:([\w.-]+)", local.group(1)))
            pending += _SPREAD_REF_RE.findall(local.group(1))
            continue
        imported = _imported_flow_ids(ref, source, spec_path)
        if imported is not None:
            ids.extend(imported)
        else:
            # Unresolvable: fall back to the name as a flow-shaped hint.
            ids.append(ref.lower().replace("_", "-"))

    # A flow tagged at both suite and test level (or reached via two spreads)
    # must count once.
    return list(dict.fromkeys(ids))


# ---------------------------------------------------------------------------
# Detectors
# ---------------------------------------------------------------------------

@dataclass
class Finding:
    """A junk-test finding, independent of the gate's Issue type."""

    rule_id: str
    message: str
    file: str
    line: int
    identifier: str
    suggestion: str


def _has_flow_tag(block: TestBlock) -> bool:
    return bool(block.flow_ids)


def detect_no_user_interaction(block: TestBlock) -> Finding | None:
    """An E2E test that never touches the UI is not testing a user flow."""
    if "no_user_interaction" in block.allow_markers:
        return None
    if block.interactions():
        return None
    return Finding(
        rule_id="no_user_interaction",
        message=(
            "E2E test performs no user interaction (no click/fill/press/select/upload) - "
            "it only navigates and asserts, so it cannot verify the flow it is tagged with"
        ),
        file=block.file,
        line=block.start_line,
        identifier=block.name,
        suggestion=(
            "Drive the flow through the UI, or delete the test and cover the render "
            "with a component test. Justify a genuine exception with "
            "`// quality: allow-no-interaction (reason)`"
        ),
    )


# Hyphen-glued qualifiers that name a state, not an action: in "post-login
# visit" the token `login` describes the session the test STARTS from, not a
# login it performs — requiring fill/type there flagged correct tests (real
# case: a post-login redirect spec, baselined). The compound is dropped whole
# BEFORE tokenizing, so `post-login` contributes neither token; a standalone
# "login" anywhere else in the name still claims the verb. The lookbehind
# keeps the qualifier reading to the START of a hyphen chain: mid-compound
# the word is a noun, not a prefix — `blog-post-created` is a created blog
# post, and dropping "post-created" there would unclaim a real creation.
_QUALIFIED_COMPOUND_RE = re.compile(r"(?<!-)\b(?:post|pre|re|after|non)-[a-z]+")


def _action_tokens(parts: list[str]) -> set[str]:
    """
    Split flow ids and test names into lowercase word tokens.

    Temporal/negation compounds (`post-login`, `pre-delete`, `non-payment`)
    are removed first: the hyphen-glued word is a qualifier of state, never
    the action itself. Ordinary hyphenated ids (`user-login-flow`) keep every
    token — only the five glued prefixes are qualifiers.
    """
    text = _QUALIFIED_COMPOUND_RE.sub(" ", " ".join(parts).lower())
    return {t for t in re.split(r"[^a-zA-Z]+", text) if t}


def _claims_verb(verb: str, tokens: set[str]) -> bool:
    """
    Whether the test claims to perform `verb`, matched as a whole word.

    Substring matching is not usable here: `proposal-payment-plan-closing`
    contains "pay" but is a display flow, and `updated_at` contains "update".
    A noun that merely mentions the domain must not be read as an action, so
    only the verb and its regular inflections count.
    """
    forms = {verb, verb + "s", verb + "d", verb + "ed", verb + "ing"}
    if verb.endswith("e"):
        stem = verb[:-1]
        forms |= {stem + "ed", stem + "ing"}
    return bool(forms & tokens)


def detect_flow_tag_mismatch(block: TestBlock, flow_ids: list[str]) -> Finding | None:
    """
    The tagged flow names an action the test does not actually carry out.

    Two independent signals, because no single one is reliable:

    * A verb that requires a distinctive call (upload needs `setInputFiles`,
      login needs typing) and that call is absent.
    * A verb that mutates state, where the test asserts nothing that could have
      changed as a result. This is what catches the common shape of mocking the
      DELETE endpoint, navigating, and asserting the list is still on screen.
    """
    if "flow_tag_mismatch" in block.allow_markers:
        return None
    interactions = block.interactions()
    if not interactions:
        # Already reported, and more severely, by no_user_interaction.
        return None

    tokens = _action_tokens(flow_ids + [block.name])

    for verb, required in REQUIRED_CALL_VERBS.items():
        if not _claims_verb(verb, tokens):
            continue
        if interactions & required:
            continue
        return Finding(
            rule_id="flow_tag_mismatch",
            message=(
                f"test claims the '{verb}' action but never calls "
                f"{' / '.join(sorted(required))} - the flow counts as covered "
                "while the action itself is untested"
            ),
            file=block.file,
            line=block.start_line,
            identifier=block.name,
            suggestion=(
                f"Perform the {verb} through the UI, retag the test to the flow it "
                "truly covers, or justify a genuine exception with "
                "`// quality: allow-flow-tag-mismatch (reason)`"
            ),
        )

    for verb in sorted(MUTATING_VERBS):
        if not _claims_verb(verb, tokens):
            continue
        if _STATE_CHANGE_RE.search(block.reach):
            continue
        return Finding(
            rule_id="flow_tag_mismatch",
            message=(
                f"test claims the '{verb}' action but asserts no resulting state change "
                "(no negative assertion, count, confirmation message or URL change) - "
                "it would pass even if the action did nothing"
            ),
            file=block.file,
            line=block.start_line,
            identifier=block.name,
            suggestion=(
                f"Assert what {verb} changed: the row is gone, the count dropped, "
                "the confirmation appeared, or the URL moved on. Justify a genuine "
                "exception with `// quality: allow-flow-tag-mismatch (reason)`"
            ),
        )

    return None


_DEEP_LINK_RE = re.compile(r"\.goto\(\s*[`'\"]([^`'\"]*)")


def detect_deep_link_entry(block: TestBlock) -> Finding | None:
    """
    A display flow reached by URL instead of by navigating the UI.

    Scoped deliberately to `@outcome:display` tests. Measured against a real
    219-spec suite, flagging every deep link produced 929 findings - 62% of all
    output - because jumping straight to a page is a legitimate setup shortcut
    for an *action* test: what that test verifies is the action, not the route.

    For a display flow the reachability IS the behavior under test, which is why
    the contract requires arriving through the UI there and only there. Until a
    suite carries outcome tags this rule stays silent by design.
    """
    if "deep_link_entry" in block.allow_markers:
        return None
    if "display" not in {o.lower() for o in block.outcomes}:
        return None
    for target in _DEEP_LINK_RE.findall(block.reach):
        path = target.split("?")[0].strip("/")
        segments = [s for s in path.split("/") if s]
        if len(segments) >= 2:
            return Finding(
                rule_id="deep_link_entry",
                message=(
                    f"test enters the view via deep link '/{path}' instead of navigating "
                    "through the UI, so the path a real user takes stays untested"
                ),
                file=block.file,
                line=block.start_line,
                identifier=block.name,
                suggestion=(
                    "Navigate from an entry point by clicking, or mark a deliberate "
                    "exception with `// quality: allow-deep-link (reason)`"
                ),
            )
    return None


def detect_no_data_assertion(block: TestBlock) -> Finding | None:
    """Asserting only that things are visible verifies presentation, not data."""
    if "no_data_assertion" in block.allow_markers:
        return None
    asserts = block.assertions()
    if not asserts:
        # An assertion-less test is already covered by NO_ASSERTIONS.
        return None
    if asserts & DATA_ASSERTIONS:
        return None
    if _CONTENT_LOCATOR_RE.search(block.reach):
        # `expect(page.getByText('Entrega fase 1')).toBeVisible()` does pin down
        # content: the expected value lives in the locator, so the assertion
        # fails if the text changes. Treating this as render-only would flag
        # idiomatic Playwright and bury the real findings in noise.
        return None
    return Finding(
        rule_id="no_data_assertion",
        message=(
            "test asserts only visibility/presence, never content or state "
            "(no toHaveText/toContainText/toHaveValue/toHaveURL/toHaveCount) - "
            "it passes on an empty or wrong dataset"
        ),
        file=block.file,
        line=block.start_line,
        identifier=block.name,
        suggestion="Assert real data: a cell value, a row count against the fixture, or the resulting URL",
    )


# Locators that carry the expected content in the selector itself. An assertion
# on one of these is a content assertion even when the matcher is toBeVisible.
_CONTENT_LOCATOR_RE = re.compile(
    r"getByText\(|getByLabel\(|getByPlaceholder\(|getByTitle\(|getByAltText\(|"
    r"getByRole\([^)]*name\s*:|filter\(\s*\{\s*has(?:Text|NotText)|:has-text\("
)

_WEAK_RE = re.compile(r"\.(toBeTruthy|toBeDefined|toBeAttached)\s*\(\s*\)")
_TAUTOLOGICAL_COUNT_RE = re.compile(r"\.toBeGreaterThanOrEqual\(\s*0\s*\)")
# A concrete-value assertion: the matcher pins an actual expected value, so the
# test can fail. `toBe(false)` counts; `toBeDefined()` does not.
_STRONG_ASSERTION_RE = re.compile(
    r"\.(toBe|toEqual|toStrictEqual|toMatchObject|toContain|toContainEqual|"
    r"toHaveLength|toHaveText|toContainText|toHaveValue|toHaveCount|toHaveURL|"
    r"toHaveAttribute|toHaveBeenCalledWith|toHaveBeenCalledTimes|toThrow)\s*\(\s*\S"
)


def detect_weak_assertion(block: TestBlock) -> Finding | None:
    """Assertions that hold for almost any state cannot catch a regression."""
    weak = sorted(set(_WEAK_RE.findall(block.source)))
    tautological = bool(_TAUTOLOGICAL_COUNT_RE.search(block.source))
    if not weak and not tautological:
        return None

    # A weak assertion alongside a concrete one is redundant noise, not a junk
    # test: `expect(route).toBeDefined(); expect(route.path).toBe('/')` verifies
    # real behavior. Flagging it buries the real findings, so only fire when the
    # weak assertion is the test's whole check.
    if _STRONG_ASSERTION_RE.search(block.source):
        return None

    detail = ", ".join(f"{w}()" for w in weak)
    if tautological:
        detail = f"{detail}, toBeGreaterThanOrEqual(0)" if detail else "toBeGreaterThanOrEqual(0)"

    return Finding(
        rule_id="weak_assertion",
        message=f"weak assertion ({detail}) - passes for almost any state, so it cannot fail meaningfully",
        file=block.file,
        line=block.start_line,
        identifier=block.name,
        suggestion="Assert the concrete expected value instead (toHaveText, toHaveCount, toEqual)",
    )


_GOTO_LITERAL_RE = re.compile(r"\.goto\(\s*[`'\"]([^`'\"]+)[`'\"]")
_URL_REGEX_ASSERT_RE = re.compile(r"toHaveURL\(\s*/((?:\\.|[^/\\])*)/")


def detect_tautological_url(block: TestBlock) -> Finding | None:
    """
    A `toHaveURL(/a|b/)` whose alternation matches the navigated path itself.

    The measured shape: `goto('/admin/dashboard')` then
    `toHaveURL(/sign-in|dashboard/)` — the second alternative matches the input
    URL, so redirect and no-redirect both pass and the assertion can never
    fail. 37 instances machine-verified across 12 files of one repo (F41), all
    reporting their auth-guard flows green. A single-pattern `toHaveURL(/x/)`
    after `goto('/x')` is NOT flagged: asserting you stayed is a real check.
    Alternatives are split naively on `|` — the measured shapes are simple, and
    an unparseable alternative just doesn't fire.
    """
    if "tautological_url" in block.allow_markers:
        return None
    source = block.expanded or block.source
    gotos = _GOTO_LITERAL_RE.findall(source)
    if not gotos:
        return None
    for m in _URL_REGEX_ASSERT_RE.finditer(source):
        body = m.group(1)
        if "|" not in body:
            continue
        for alt in body.split("|"):
            alt = alt.strip().replace("\\/", "/")
            if not alt:
                continue
            try:
                alt_re = re.compile(alt)
            except re.error:
                continue
            if any(alt_re.search(path) for path in gotos):
                return Finding(
                    rule_id="tautological_url",
                    message=(
                        f"toHaveURL alternation (/{body}/) matches the navigated path itself "
                        f"('{next(p for p in gotos if alt_re.search(p))}') - redirect and "
                        "no-redirect both pass, so the assertion cannot fail"
                    ),
                    file=block.file,
                    line=block.start_line,
                    identifier=block.name,
                    suggestion=(
                        "Assert the single expected destination (toHaveURL(/sign-in/)); a test "
                        "that legitimately accepts two destinations documents it with "
                        "`// quality: allow-url-alternation (reason)`"
                    ),
                )
    return None


_CLASS_SELECTOR_RE = re.compile(
    r"\.(?:findAll|find|querySelectorAll|querySelector|locator)\(\s*[`'\"]([^`'\"]*)"
)


def detect_tautological_selector(block: TestBlock) -> Finding | None:
    """
    A count assertion over a CSS-class selector with a `>=` matcher.

    This is the shape that passes no matter what the component renders: the
    selector matches incidental markup and the matcher accepts any surplus.
    """
    selectors = _CLASS_SELECTOR_RE.findall(block.source)
    css_class = [s for s in selectors if "[class" in s or re.search(r"(^|\s|,)\.[\w-]", s)]
    if not css_class:
        return None
    if not re.search(r"\.toBeGreaterThanOrEqual\(", block.source):
        return None
    return Finding(
        rule_id="tautological_selector",
        message=(
            f"count assertion over CSS-class selector ('{css_class[0][:40]}') with a >= matcher - "
            "matches incidental markup and accepts any surplus, so it cannot fail"
        ),
        file=block.file,
        line=block.start_line,
        identifier=block.name,
        suggestion="Select by role or data-testid and assert an exact count (toHaveLength / toHaveCount)",
    )


# Bare `.toHaveBeenCalled()` — no args, no times. `toHaveBeenCalledWith(payload)`
# and `toHaveBeenCalledTimes(n)` pin a real expectation and live in
# _STRONG_ASSERTION_RE, so this deliberately matches only the empty-argument form.
_BARE_CALLED_RE = re.compile(r"\.toHaveBeenCalled\s*\(\s*\)")


def detect_mock_only_assertion(block: TestBlock) -> Finding | None:
    """
    A unit test whose only verification is that a spy was called.

    `expect(spy).toHaveBeenCalled()` confirms the code reached the collaborator,
    never that it did the right thing with the result — it passes even when the
    effect is wrong. Fires only on the bare call and only when no concrete-value
    assertion accompanies it, so a test that also pins the payload
    (`toHaveBeenCalledWith`) or asserts the returned value is left alone.
    """
    if "mock_only_assertion" in block.allow_markers:
        return None
    if not _BARE_CALLED_RE.search(block.source):
        return None
    if _STRONG_ASSERTION_RE.search(block.source):
        return None
    if block.assertions() & DATA_ASSERTIONS:
        return None
    return Finding(
        rule_id="mock_only_assertion",
        message=(
            "the only assertion is toHaveBeenCalled() on a spy - it verifies the "
            "collaborator was reached, never that the code produced the right result, "
            "so it passes on a wrong effect"
        ),
        file=block.file,
        line=block.start_line,
        identifier=block.name,
        suggestion=(
            "Assert the resulting value or state, or pin the payload with "
            "toHaveBeenCalledWith(...). Justify a genuine exception with "
            "`// quality: allow-mock-only (reason)`"
        ),
    )


_EQ_MATCHER_RE = re.compile(r"\.(?:toBe|toEqual|toStrictEqual)\s*\(")
# An arithmetic operation with at least one identifier operand. The lookbehinds
# stop the `e` of scientific notation (1e-5) and mid-token chars from reading as
# an identifier, so pure-literal arithmetic stays silent.
_ARITH_IDENT_RE = re.compile(
    r"(?<![\w$.])[A-Za-z_$][\w$.]*\s*[-+*/%]\s*[\w$.(]"
    r"|[\w$.)]\s*[-+*/%]\s*(?<![\w$.])[A-Za-z_$]"
)


def detect_reimplements_sut(block: TestBlock) -> Finding | None:
    """
    An equality assertion whose expected side recomputes the result.

    `expect(sum(a, b)).toBe(a + b)` re-derives the answer with the same operator
    the code uses, so a bug shared by the implementation and the test passes. A
    real test uses a hand-verified literal (`toBe(7)`). Fires only when the
    expected argument does arithmetic on an identifier; pure-literal arithmetic
    (`toBe(2 + 3)`), string concatenation and property access stay silent. String
    and comment content is masked first so a literal cannot supply a false token.
    """
    if "reimplements_sut" in block.allow_markers:
        return None
    masked = _strip_for_scanning(block.source)
    for m in _EQ_MATCHER_RE.finditer(masked):
        open_idx = m.end() - 1
        close_idx = _match_paren(masked, open_idx)
        if close_idx == -1:
            continue
        expected = masked[open_idx + 1:close_idx - 1]
        if _ARITH_IDENT_RE.search(expected):
            return Finding(
                rule_id="reimplements_sut",
                message=(
                    "the expected value recomputes the result with an operator on a "
                    "variable (e.g. toBe(a + b)) instead of a hand-verified literal - "
                    "a bug shared by the code and the test would pass"
                ),
                file=block.file,
                line=block.start_line,
                identifier=block.name,
                suggestion=(
                    "Assert a concrete literal computed by hand (toBe(7)). Justify a "
                    "genuine exception with `// quality: allow-reimpl (reason)`"
                ),
            )
    return None


def detect_duplicates(blocks: list[TestBlock]) -> list[Finding]:
    """
    Group tests whose bodies are structurally identical.

    The signal is the body fingerprint (formatting and comments stripped,
    literals kept), which catches genuine copy-paste. A shared test NAME is
    deliberately NOT a signal on its own:

        describe('isValidPassword', () => it('returns false for null', ...isValidPassword(null)))
        describe('isNonEmpty',      () => it('returns false for null', ...isNonEmpty(null)))

    are different tests of different functions that happen to share a title. An
    earlier name-collision rule flagged these, and BaseInput/BaseSelect sharing a
    behavior-contract test name across files — both false positives. If two tests
    are truly the same, their bodies match and the fingerprint catches them.

    Reported on every member but the first, so the survivor is unambiguous.
    """
    findings: list[Finding] = []

    by_fingerprint: dict[str, list[TestBlock]] = {}
    for block in blocks:
        if "duplicate_coverage" in block.allow_markers:
            continue
        by_fingerprint.setdefault(block.fingerprint(), []).append(block)

    for group in by_fingerprint.values():
        if len(group) < 2:
            continue
        keeper = group[0]
        for dup in group[1:]:
            findings.append(Finding(
                rule_id="duplicate_coverage",
                message=(
                    f"test is structurally identical to '{keeper.name}' at "
                    f"{keeper.file}:{keeper.start_line} - the same behavior is covered twice"
                ),
                file=dup.file,
                line=dup.start_line,
                identifier=dup.name,
                suggestion="Merge into the stronger of the two and delete this one",
            ))

    return findings


# ---------------------------------------------------------------------------
# Entry points
# ---------------------------------------------------------------------------

def analyze_e2e_source(source: str, file: str, spec_path: Path | None = None) -> list[Finding]:
    """
    Run every E2E junk detector over one spec file.

    `spec_path` enables resolving helpers imported from sibling modules; without
    it only same-file helpers are followed, which risks false positives on specs
    that factor their interactions into shared helpers.
    """
    findings: list[Finding] = []
    known = _function_bodies(source)
    known.update(_resolve_import_bodies(source, spec_path))

    for block in extract_test_blocks(source, file):
        block.expanded = effective_source(block, known)
        flow_ids = resolve_flow_ids(block, source, spec_path)

        no_interaction = detect_no_user_interaction(block)
        if no_interaction:
            findings.append(no_interaction)
        else:
            mismatch = detect_flow_tag_mismatch(block, flow_ids)
            if mismatch:
                findings.append(mismatch)

        for detector in (
            detect_deep_link_entry,
            detect_no_data_assertion,
            detect_weak_assertion,
            detect_tautological_url,
        ):
            found = detector(block)
            if found:
                findings.append(found)

    return findings


def analyze_unit_source(source: str, file: str, spec_path: Path | None = None) -> list[Finding]:
    """Run the unit-applicable junk detectors over one spec file."""
    findings: list[Finding] = []
    known = _function_bodies(source)
    known.update(_resolve_import_bodies(source, spec_path))

    for block in extract_test_blocks(source, file):
        block.expanded = effective_source(block, known)
        for detector in (
            detect_weak_assertion,
            detect_tautological_selector,
            detect_mock_only_assertion,
            detect_reimplements_sut,
        ):
            found = detector(block)
            if found:
                findings.append(found)
    return findings


# ---------------------------------------------------------------------------
# Severity policy (the ratchet)
# ---------------------------------------------------------------------------
#
# Promoting these rules straight to ERROR would have turned CI red in all eleven
# fleet projects at once — 1152 findings — blocking every merge until a cleanup
# that takes weeks. Freezing development is not a quality improvement.
#
# So severity is decided per finding against a baseline of the debt that already
# exists: known findings stay warnings, anything new is an error. New junk cannot
# merge, existing junk stays visible and gets cleaned deliberately. The baseline
# only ever shrinks — a finding removed from the code is removed from the file.

_BASELINE: set[str] | None = None
_ESCALATE = False


def finding_key(finding: "Finding") -> str:
    """
    Identity of a finding, stable across edits elsewhere in the file.

    Deliberately excludes the line number: inserting a test above another one
    must not make the second look new.
    """
    return f"{finding.file}::{finding.rule_id}::{finding.identifier or ''}"


def set_junk_policy(baseline: set[str] | None, escalate: bool) -> None:
    """Configure how junk findings map to severities for this run."""
    global _BASELINE, _ESCALATE
    _BASELINE = baseline
    _ESCALATE = escalate


def findings_to_issues(findings: list[Finding], severity=None) -> list:
    """
    Convert detector findings into the gate's Issue type.

    Imported lazily so this module stays usable as a standalone library (the
    audit skill walks a corpus without booting the whole gate).
    """
    from .base import Issue, IssueCategory, JUNK_RULE_CATEGORIES, Severity

    issues = []
    for finding in findings:
        if severity is not None:
            level = severity
        elif not _ESCALATE:
            level = Severity.WARNING
        elif _BASELINE is not None and finding_key(finding) in _BASELINE:
            level = Severity.WARNING
        else:
            level = Severity.ERROR

        category_name = JUNK_RULE_CATEGORIES.get(finding.rule_id)
        category = getattr(IssueCategory, category_name) if category_name else IssueCategory.VAGUE_ASSERTION
        issues.append(Issue(
            file=finding.file,
            message=finding.message,
            severity=level,
            category=category,
            line=finding.line,
            identifier=finding.identifier,
            suggestion=finding.suggestion,
            rule_id=finding.rule_id,
        ))
    return issues


def collect_blocks(paths: list[Path], repo_root: Path) -> list[TestBlock]:
    """Read a set of spec files into TestBlocks, for corpus-wide analysis."""
    blocks: list[TestBlock] = []
    for path in paths:
        try:
            source = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        try:
            rel = path.relative_to(repo_root).as_posix()
        except ValueError:
            rel = str(path)
        blocks.extend(extract_test_blocks(source, rel))
    return blocks
