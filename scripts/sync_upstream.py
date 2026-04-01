#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_UPSTREAM = "https://github.com/masseater/claude-code-plugin.git"
MARKETPLACE_NAME = "masseater-plugins"
MARKETPLACE_DISPLAY_NAME = "masseater Plugins"
REPO_URL = "https://github.com/masseater/codex-plugin"
TEXT_EXTENSIONS = {
    ".json",
    ".jsonc",
    ".md",
    ".mjs",
    ".cjs",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".sh",
    ".txt",
    ".toml",
    ".yaml",
    ".yml",
}
COPY_IGNORE_DIRS = {
    ".git",
    ".agents",
    "node_modules",
    "dist",
    "coverage",
    ".next",
    ".turbo",
}
COPY_IGNORE_FILES = {
    "plugin.json",
    "CLAUDE.md",
}


@dataclass(frozen=True)
class UpstreamPlugin:
    name: str
    description: str
    version: str
    source: str
    author_name: str


def run(
    args: list[str],
    *,
    cwd: Path | None = None,
    capture: bool = False,
) -> str:
    completed = subprocess.run(
        args,
        cwd=str(cwd) if cwd else None,
        check=True,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    return completed.stdout.strip() if capture else ""


def title_case_plugin(name: str) -> str:
    return " ".join(part.capitalize() for part in name.split("-"))


def posix_relpath(path: Path, start: Path) -> str:
    rel = os.path.relpath(path, start)
    rel_posix = Path(rel).as_posix()
    if rel_posix in {".", ""}:
        return "."
    if rel_posix.startswith("."):
        return rel_posix
    return f"./{rel_posix}"


def load_upstream_plugins(upstream_root: Path) -> list[UpstreamPlugin]:
    marketplace_path = upstream_root / ".claude-plugin" / "marketplace.json"
    marketplace = json.loads(marketplace_path.read_text())
    plugins: list[UpstreamPlugin] = []

    for entry in marketplace["plugins"]:
        plugin_root = upstream_root / entry["source"].removeprefix("./")
        plugin_json_path = plugin_root / "plugin.json"
        plugin_json = json.loads(plugin_json_path.read_text())
        plugins.append(
            UpstreamPlugin(
                name=plugin_json.get("name", entry["name"]),
                description=plugin_json.get("description", entry.get("description", "")),
                version=plugin_json.get("version", entry.get("version", "0.0.0")),
                source=entry["source"],
                author_name=plugin_json.get("author", {}).get("name", "masseater"),
            )
        )

    return plugins


def resolve_ref(source: str, ref: str) -> str:
    if ref not in {"", "auto", "HEAD"}:
        return ref

    source_path = Path(source).expanduser()
    if source_path.exists():
        branch = run(["git", "branch", "--show-current"], cwd=source_path.resolve(), capture=True)
        return branch or "HEAD"

    symref = run(["git", "ls-remote", "--symref", source, "HEAD"], capture=True)
    for line in symref.splitlines():
        if line.startswith("ref: "):
            return line.split()[1].removeprefix("refs/heads/")

    raise RuntimeError(f"failed to resolve default branch for {source}")


def clone_upstream(source: str, ref: str, scratch_root: Path) -> tuple[Path, str, str]:
    resolved_ref = resolve_ref(source, ref)
    source_path = Path(source).expanduser()
    if source_path.exists():
        upstream_root = source_path.resolve()
        sha = run(["git", "rev-parse", "HEAD"], cwd=upstream_root, capture=True)
        return upstream_root, sha, resolved_ref

    upstream_root = scratch_root / "upstream"
    run(["git", "clone", "--depth=1", "--branch", resolved_ref, source, str(upstream_root)])
    sha = run(["git", "rev-parse", "HEAD"], cwd=upstream_root, capture=True)
    return upstream_root, sha, resolved_ref


def should_skip(src: Path) -> bool:
    if src.name in COPY_IGNORE_FILES:
        return True
    return False


def copy_plugin_tree(src: Path, dst: Path) -> None:
    def ignore(_: str, names: list[str]) -> set[str]:
        skipped = {name for name in names if name in COPY_IGNORE_DIRS}
        skipped.update(name for name in names if name in COPY_IGNORE_FILES)
        return skipped

    shutil.copytree(src, dst, ignore=ignore)


def replace_plugin_root_refs_for_text(text: str, file_path: Path, plugin_root: Path) -> str:
    pattern = re.compile(r"\$\{CLAUDE_PLUGIN_ROOT\}(?:/([^\s)`\"'>]+))?")

    def repl(match: re.Match[str]) -> str:
        suffix = match.group(1)
        target = plugin_root / suffix if suffix else plugin_root
        return posix_relpath(target, file_path.parent)

    return pattern.sub(repl, text)


def replace_plugin_root_refs_for_hooks_json(text: str) -> str:
    text = re.sub(r"cd\s+\$\{CLAUDE_PLUGIN_ROOT\}\s*&&\s*", "", text)
    text = text.replace("${CLAUDE_PLUGIN_ROOT}/", "./")
    return text.replace("${CLAUDE_PLUGIN_ROOT}", ".")


def rewrite_file_contents(file_path: Path, plugin_root: Path) -> None:
    if file_path.suffix not in TEXT_EXTENSIONS and file_path.name != "hooks.json":
        return

    original = file_path.read_text()
    updated = original
    updated = updated.replace(
        "https://github.com/masseater/claude-code-plugin",
        REPO_URL,
    )
    updated = updated.replace("masseater/claude-code-plugin", "masseater/codex-plugin")

    if file_path.name == "hooks.json":
        updated = replace_plugin_root_refs_for_hooks_json(updated)
    else:
        updated = replace_plugin_root_refs_for_text(updated, file_path, plugin_root)

    if file_path.as_posix().endswith("plugins/debug/hooks/entry/session-start.ts"):
        updated = updated.replace(
            'const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? "(unset)";',
            'const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? new URL("../..", import.meta.url).pathname;',
        )

    if updated != original:
        file_path.write_text(updated)


def rewrite_plugin_files(plugin_root: Path) -> None:
    for path in plugin_root.rglob("*"):
        if path.is_dir():
            continue
        rewrite_file_contents(path, plugin_root)


def build_manifest(plugin: UpstreamPlugin, plugin_root: Path) -> dict[str, Any]:
    manifest: dict[str, Any] = {
        "name": plugin.name,
        "version": plugin.version,
        "description": plugin.description,
        "author": {
            "name": plugin.author_name,
            "url": "https://github.com/masseater",
        },
        "homepage": f"{REPO_URL}/tree/main/plugins/{plugin.name}",
        "repository": REPO_URL,
        "keywords": ["masseater", "claude-code-plugin", "codex"],
        "interface": {
            "displayName": title_case_plugin(plugin.name),
            "shortDescription": plugin.description,
            "longDescription": plugin.description,
            "developerName": plugin.author_name,
            "category": "Productivity",
        },
    }

    if (plugin_root / "skills").is_dir():
        manifest["skills"] = "./skills/"
    if (plugin_root / "hooks" / "hooks.json").is_file():
        manifest["hooks"] = "./hooks/hooks.json"
    if (plugin_root / ".mcp.json").is_file():
        manifest["mcpServers"] = "./.mcp.json"
    if (plugin_root / ".app.json").is_file():
        manifest["apps"] = "./.app.json"

    return manifest


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n")


def render_marketplace(plugins: list[UpstreamPlugin]) -> dict[str, Any]:
    return {
        "name": MARKETPLACE_NAME,
        "interface": {
            "displayName": MARKETPLACE_DISPLAY_NAME,
        },
        "plugins": [
            {
                "name": plugin.name,
                "source": {
                    "source": "local",
                    "path": f"./plugins/{plugin.name}",
                },
                "policy": {
                    "installation": "AVAILABLE",
                    "authentication": "ON_INSTALL",
                },
                "category": "Productivity",
            }
            for plugin in plugins
        ],
    }


def clean_generated_paths(repo_root: Path) -> None:
    plugins_root = repo_root / "plugins"
    if plugins_root.exists():
        shutil.rmtree(plugins_root)


def sync_plugins(
    repo_root: Path,
    upstream_root: Path,
    upstream_sha: str,
    source: str,
    ref: str,
) -> None:
    clean_generated_paths(repo_root)
    plugins = load_upstream_plugins(upstream_root)

    for plugin in plugins:
        src_root = upstream_root / plugin.source.removeprefix("./")
        dst_root = repo_root / "plugins" / plugin.name
        copy_plugin_tree(src_root, dst_root)
        rewrite_plugin_files(dst_root)
        write_json(dst_root / ".codex-plugin" / "plugin.json", build_manifest(plugin, dst_root))

    write_json(repo_root / ".agents" / "plugins" / "marketplace.json", render_marketplace(plugins))
    write_json(
        repo_root / ".sync" / "upstream.json",
        {
            "source": source,
            "ref": ref,
            "commit": upstream_sha,
            "pluginCount": len(plugins),
        },
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync masseater/claude-code-plugin into this repository as Codex plugins."
    )
    parser.add_argument(
        "--source",
        default=DEFAULT_UPSTREAM,
        help="Upstream git URL or a local checkout path.",
    )
    parser.add_argument(
        "--ref",
        default="auto",
        help="Git ref to sync. Use 'auto' to follow the upstream default branch.",
    )
    parser.add_argument(
        "--repo-root",
        default=Path(__file__).resolve().parents[1],
        type=Path,
        help="Destination repository root. Defaults to the current repository.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = args.repo_root.resolve()

    if not (repo_root / ".git").exists():
        print(f"error: {repo_root} is not a git repository", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory(prefix="codex-plugin-sync-") as tmp:
        upstream_root, upstream_sha, resolved_ref = clone_upstream(
            args.source, args.ref, Path(tmp)
        )
        sync_plugins(repo_root, upstream_root, upstream_sha, args.source, resolved_ref)

    print(f"Synced {MARKETPLACE_NAME} from {args.source} @ {resolved_ref}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
