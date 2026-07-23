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
    r"toHaveValue\(|toHaveURL\(|getByRole\(\s*['\"](?:alert|status)['\"]|"
    r"toEqual\(|toMatchObject\(|toHaveBeenCalled"
)

# Opt-out markers, mirroring the existing `quality: allow-*` convention.
ALLOW_MARKERS: dict[str, str] = {
    "allow-no-interaction": "no_user_interaction",
    "allow-deep-link": "deep_link_entry",
    "allow-render-only": "no_data_assertion",
    "allow-duplicate": "duplicate_coverage",
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
        """
        body = self.body_source()
        body = re.sub(r"//[^\n]*", "", body)
        body = re.sub(r"/\*.*?\*/", "", body, flags=re.DOTALL)
        body = re.sub(r"\s+", "", body)
        return hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]

    def body_source(self) -> str:
        """Test source with its title literal removed, so renames still match."""
        if not self.name:
            return self.source
        return self.source.replace(self.name, "", 1)


# ---------------------------------------------------------------------------
# Source scanning
# ---------------------------------------------------------------------------

def _strip_for_scanning(source: str) -> str:
    """
    Blank out string and comment content, preserving length and newlines.

    Delimiters are kept so offsets stay aligned with the original source; only
    the contents are replaced, so a brace inside a string cannot fool the
    paren matcher.
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
        i += 1
    return "".join(out)


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


def extract_test_blocks(source: str, file: str = "") -> list[TestBlock]:
    """
    Find every test invocation in a spec file.

    Uses a masked copy for structure so that braces and parens inside strings,
    template literals and comments cannot break the matching, then slices the
    real source for content.
    """
    masked = _strip_for_scanning(source)
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
        start_line = source.count("\n", 0, match.start()) + 1
        end_line = source.count("\n", 0, close_idx) + 1

        name_match = re.search(r"(['\"`])((?:\\.|(?!\1).)*)\1", raw, flags=re.DOTALL)
        name = name_match.group(2) if name_match else ""

        blocks.append(TestBlock(
            name=name,
            start_line=start_line,
            end_line=end_line,
            source=raw,
            file=file,
            flow_ids=re.findall(r"@flow:([\w.-]+)", raw),
            outcomes=re.findall(r"@outcome:([\w.-]+)", raw),
            allow_markers={
                rule for marker, rule in ALLOW_MARKERS.items()
                if re.search(rf"quality:\s*{re.escape(marker)}", raw, re.IGNORECASE)
            },
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
_FUNC_CONST_RE = re.compile(r"\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>")
_IMPORT_RE = re.compile(r"import\s+\{([^}]*)\}\s+from\s+['\"](\.[^'\"]*)['\"]")

_MAX_HELPER_DEPTH = 3


def _function_bodies(source: str) -> dict[str, str]:
    """Map every function defined in a module to its source text."""
    masked = _strip_for_scanning(source)
    bodies: dict[str, str] = {}

    for regex in (_FUNC_DECL_RE, _FUNC_CONST_RE):
        for match in regex.finditer(masked):
            name = match.group(1)
            brace = masked.find("{", match.end() - 1)
            if brace == -1:
                continue
            depth = 0
            end = -1
            for i in range(brace, len(masked)):
                if masked[i] == "{":
                    depth += 1
                elif masked[i] == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            if end != -1:
                bodies[name] = source[match.start():end]

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


def resolve_flow_ids(block: TestBlock, source: str) -> list[str]:
    """
    Resolve flow ids for a test, following tag constants defined in the file.

    Specs commonly tag with an imported constant (`tag: [...ADMIN_LOGIN]`)
    instead of a literal `@flow:` string. Without this the tag looks absent and
    every flow rule silently no-ops — the same failure mode that let the junk
    accumulate in the first place.
    """
    if block.flow_ids:
        return block.flow_ids

    ids: list[str] = []
    for const in re.findall(r"\.\.\.([A-Z][A-Z0-9_]*)", block.source):
        # Constant defined locally in this file?
        local = re.search(
            rf"\b{const}\s*=\s*\[([^\]]*)\]", source, flags=re.DOTALL
        )
        if local:
            ids.extend(re.findall(r"@flow:([\w.-]+)", local.group(1)))
        else:
            # Imported: fall back to the constant name as a flow-shaped hint.
            ids.append(const.lower().replace("_", "-"))
    return ids


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


def _action_tokens(parts: list[str]) -> set[str]:
    """Split flow ids and test names into lowercase word tokens."""
    return {t for t in re.split(r"[^a-zA-Z]+", " ".join(parts).lower()) if t}


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
            suggestion=f"Perform the {verb} through the UI, or retag the test to the flow it truly covers",
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
                "the confirmation appeared, or the URL moved on"
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


def detect_weak_assertion(block: TestBlock) -> Finding | None:
    """Assertions that hold for almost any state cannot catch a regression."""
    weak = sorted(set(_WEAK_RE.findall(block.source)))
    tautological = bool(_TAUTOLOGICAL_COUNT_RE.search(block.source))
    if not weak and not tautological:
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


def detect_duplicates(blocks: list[TestBlock]) -> list[Finding]:
    """
    Group tests that are structurally identical or share a name across files.

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

    # Name collisions count only WITHIN a file. Across files the same name is
    # normal and healthy: BaseInput and BaseSelect both legitimately have
    # 'respects size="sm" with smaller padding/text' because they share a
    # behavior contract, and flagging that pattern produced mostly noise. A test
    # genuinely copied into another file is caught by the structural
    # fingerprint above instead.
    by_name: dict[tuple[str, str], list[TestBlock]] = {}
    for block in blocks:
        if not block.name or "duplicate_coverage" in block.allow_markers:
            continue
        by_name.setdefault((block.file, block.name.strip().lower()), []).append(block)

    already = {(f.file, f.line) for f in findings}
    for group in by_name.values():
        if len(group) < 2:
            continue
        keeper = group[0]
        for dup in group[1:]:
            if (dup.file, dup.start_line) in already:
                continue
            findings.append(Finding(
                rule_id="duplicate_coverage",
                message=(
                    f"duplicated test name in the same file (also at line "
                    f"{keeper.start_line}) - two tests claiming the same behavior"
                ),
                file=dup.file,
                line=dup.start_line,
                identifier=dup.name,
                suggestion="Rename to describe the distinct behavior, or merge the two tests",
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
        flow_ids = resolve_flow_ids(block, source)

        no_interaction = detect_no_user_interaction(block)
        if no_interaction:
            findings.append(no_interaction)
        else:
            mismatch = detect_flow_tag_mismatch(block, flow_ids)
            if mismatch:
                findings.append(mismatch)

        for detector in (detect_deep_link_entry, detect_no_data_assertion, detect_weak_assertion):
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
        for detector in (detect_weak_assertion, detect_tautological_selector):
            found = detector(block)
            if found:
                findings.append(found)
    return findings


def findings_to_issues(findings: list[Finding], severity=None) -> list:
    """
    Convert detector findings into the gate's Issue type.

    Imported lazily so this module stays usable as a standalone library (the
    audit skill walks a corpus without booting the whole gate).
    """
    from .base import Issue, IssueCategory, JUNK_RULE_CATEGORIES, Severity

    level = severity or Severity.WARNING
    issues = []
    for finding in findings:
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
