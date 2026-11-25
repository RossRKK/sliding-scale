import json
import zipfile
from pathlib import Path

from package_release import package_release


def built_module(path: Path) -> Path:
    (path / "lang").mkdir(parents=True)
    (path / "module.json").write_text(json.dumps({"id": "my-module", "version": "0.0.0"}))
    (path / "main.js").write_text("export {};")
    (path / "lang" / "en.json").write_text("{}")
    return path


def test_manifest_gets_the_version_and_its_download_url(tmp_path: Path) -> None:
    package_release(built_module(tmp_path / "dist"), tmp_path / "out", "1.2.3", "me/repo")

    manifest = json.loads((tmp_path / "out" / "module.json").read_text())
    assert manifest["version"] == "1.2.3"
    assert manifest["download"] == (
        "https://github.com/me/repo/releases/download/v1.2.3/my-module.zip"
    )


def test_zip_holds_the_module_with_the_stamped_manifest_at_its_root(tmp_path: Path) -> None:
    archive = package_release(built_module(tmp_path / "dist"), tmp_path / "out", "1.2.3", "me/repo")

    with zipfile.ZipFile(archive) as zip_file:
        assert sorted(zip_file.namelist()) == ["lang/en.json", "main.js", "module.json"]
        assert json.loads(zip_file.read("module.json"))["version"] == "1.2.3"
