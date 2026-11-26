#!/usr/bin/env python3
"""从 metadata.yaml 与 scripts/*.js 构建元书输入法可导入的 YAML 文件。"""

import argparse
import pathlib
import sys
import yaml


ROOT = pathlib.Path(__file__).resolve().parent.parent
META_PATH = ROOT / "metadata.yaml"
DEFAULT_OUT = ROOT / "dist" / "元输入法脚本.yaml"


class DoubleQuotedStr(str):
    pass


def _represent_double_quoted(dumper, data):
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style='"')


class HamsterDumper(yaml.SafeDumper):
    pass


HamsterDumper.add_representer(DoubleQuotedStr, _represent_double_quoted)


def build_yaml_text() -> str:
    meta = yaml.safe_load(META_PATH.read_text(encoding="utf-8"))
    if not isinstance(meta, dict) or not isinstance(meta.get("scripts"), list):
        raise ValueError("metadata.yaml 必须包含 scripts 列表")

    seen_names = set()
    output_scripts = []
    for item in meta["scripts"]:
        name = item["name"]
        if name in seen_names:
            raise ValueError(f"脚本名称重复: {name}")
        seen_names.add(name)

        src_path = ROOT / item["file"]
        if not src_path.is_file():
            raise FileNotFoundError(f"找不到脚本源码: {src_path}")

        content = src_path.read_text(encoding="utf-8").strip()
        if "async function output()" not in content:
            raise ValueError(f"{item['file']} 缺少入口函数 `async function output()`")

        output_scripts.append(
            {
                "iconName": item.get("iconName", "terminal"),
                "iconType": item.get("iconType", "system"),
                "name": name,
                "content": DoubleQuotedStr(content),
                "isFavorite": bool(item.get("isFavorite", False)),
                "allowPasteboard": bool(item.get("allowPasteboard", False)),
                "tags": list(item.get("tags") or []),
            }
        )

    payload = {
        "scripts": output_scripts,
        "scriptVariables": list(meta.get("scriptVariables") or []),
        "scriptTags": list(meta.get("scriptTags") or []),
    }

    return yaml.dump(
        payload,
        Dumper=HamsterDumper,
        allow_unicode=True,
        sort_keys=False,
        width=80,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="构建元书输入法脚本 YAML")
    parser.add_argument(
        "-o",
        "--output",
        type=pathlib.Path,
        default=DEFAULT_OUT,
        help="输出 YAML 路径（默认 dist/元输入法脚本.yaml）",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="仅校验输出文件是否已是最新构建结果",
    )
    args = parser.parse_args()

    rendered = build_yaml_text()

    if args.check:
        if not args.output.is_file():
            print(f"缺失构建产物: {args.output}", file=sys.stderr)
            return 1
        current = args.output.read_text(encoding="utf-8")
        if current != rendered:
            print(f"构建产物已过期，请重新运行 python3 tools/build.py", file=sys.stderr)
            return 1
        print(f"校验通过: {args.output}")
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    print(f"已生成: {args.output} ({len(rendered.encode('utf-8'))} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
