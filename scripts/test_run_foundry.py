import json
from pathlib import Path

import pytest

from run_foundry import MissingManifestError, link_module, project_root


def test_project_root_is_found_from_a_subdirectory(tmp_path: Path) -> None:
    (tmp_path / "flake.nix").touch()
    subdirectory = tmp_path / "src" / "deep"
    subdirectory.mkdir(parents=True)

    assert project_root(subdirectory) == tmp_path


def test_missing_project_root_is_reported(tmp_path: Path) -> None:
    with pytest.raises(SystemExit):
        project_root(tmp_path)


def built_module(path: Path, module_id: str) -> Path:
    path.mkdir(parents=True)
    (path / "module.json").write_text(json.dumps({"id": module_id}))
    return path


def test_links_module_under_its_manifest_id(tmp_path: Path) -> None:
    module_dir = built_module(tmp_path / "dist", "my-module")

    link = link_module(tmp_path / "data", module_dir)

    assert link == tmp_path / "data" / "Data" / "modules" / "my-module"
    assert link.resolve() == module_dir


def test_relinking_replaces_the_old_link(tmp_path: Path) -> None:
    link_module(tmp_path / "data", built_module(tmp_path / "old", "my-module"))
    new_dir = built_module(tmp_path / "new", "my-module")

    link = link_module(tmp_path / "data", new_dir)

    assert link.resolve() == new_dir
    assert sorted(p.name for p in link.parent.iterdir()) == ["my-module"]


def test_unbuilt_module_is_reported(tmp_path: Path) -> None:
    with pytest.raises(MissingManifestError):
        link_module(tmp_path / "data", tmp_path / "dist")
