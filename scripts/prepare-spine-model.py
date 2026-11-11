#!/usr/bin/env python3
"""BodyParts3D 원본에서 척추만 추출하고 웹용 GLB와 정적 대체 그림을 만듭니다."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import struct
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "qa/bodyparts-source/bodyparts3d-4.0.zip"
OUTPUT = ROOT / "public/models/bodyparts3d"
SOURCE_URL = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip"
ORDINALS = "first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth"

def selected_name(name):
    return name.lower() in {"atlas", "axis", "sacrum", "coccyx", "intervertebral disk"} or bool(
        re.match(r"^(?:(?:" + ORDINALS + r") (?:cervical|thoracic|lumbar) vertebra$|intervertebral disk of )", name, re.I)
    )

def vector(value):
    x, y, z = value
    return [x, z, -y]

def parse_obj(text):
    positions, normals, faces = [], [], []
    for line in text.splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == "v":
            positions.append(vector([float(v) for v in fields[1:4]]))
        elif fields[0] == "vn":
            normals.append(vector([float(v) for v in fields[1:4]]))
        elif fields[0] == "f":
            polygon = []
            for field in fields[1:]:
                values = field.split("/")
                vi = int(values[0])
                vi = vi - 1 if vi > 0 else len(positions) + vi
                ni = int(values[2]) if len(values) > 2 and values[2] else None
                if ni is not None:
                    ni = ni - 1 if ni > 0 else len(normals) + ni
                polygon.append((vi, ni))
            for i in range(1, len(polygon) - 1):
                faces.append([polygon[0], polygon[i], polygon[i + 1]])
    return positions, normals, faces

def rotated(v, yaw=-1.03, roll=-0.23):
    x, y, z = v
    x, z = x * math.cos(yaw) + z * math.sin(yaw), -x * math.sin(yaw) + z * math.cos(yaw)
    return [x * math.cos(roll) - y * math.sin(roll), x * math.sin(roll) + y * math.cos(roll), z]

def build(source):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    parts = []
    with ZipFile(source) as archive:
        for name in archive.namelist():
            if not name.endswith(".obj"):
                continue
            with archive.open(name) as file:
                header = file.read(2200).decode(errors="replace")
            match = re.search(r"# English name : (.+)", header)
            if not match or not selected_name(match.group(1).strip()):
                continue
            text = archive.read(name).decode()
            positions, normals, faces = parse_obj(text)
            parts.append({
                "id": Path(name).stem, "name": match.group(1).strip(),
                "concept": re.search(r"# Concept ID : (.+)", header).group(1).strip(),
                "kind": "disc" if "disk" in match.group(1).lower() else "bone",
                "positions": positions, "normals": normals, "faces": faces,
            })
    if len(parts) != 48:
        raise ValueError("예상한 48개 부위와 다릅니다: " + str(len(parts)))
    bones = sum(p["kind"] == "bone" for p in parts)
    discs = len(parts) - bones
    if (bones, discs) != (25, 23):
        raise ValueError("뼈와 디스크 구성이 예상과 다릅니다.")
    all_points = [p for part in parts for p in part["positions"]]
    lower = [min(p[a] for p in all_points) for a in range(3)]
    upper = [max(p[a] for p in all_points) for a in range(3)]
    origin = [(lower[a] + upper[a]) / 2 for a in range(3)]
    scale = 2.5 / (upper[1] - lower[1])
    for part in parts:
        part["world"] = [[(v[a] - origin[a]) * scale for a in range(3)] for v in part["positions"]]
        part["center"] = [(min(v[a] for v in part["world"]) + max(v[a] for v in part["world"])) / 2 for a in range(3)]
    parts.sort(key=lambda p: p["center"][1], reverse=True)

    document = {
        "asset": {"version": "2.0", "generator": "Spine Vision model preparation",
                  "copyright": "BodyParts3D, © The Database Center for Life Science",
                  "extras": {"license": "CC-BY-4.0", "source": SOURCE_URL}},
        "scene": 0, "scenes": [{"name": "BodyParts3D spinal column", "nodes": []}],
        "nodes": [], "meshes": [], "bufferViews": [], "accessors": [],
        "materials": [
            {"name": "Matte ivory bone", "pbrMetallicRoughness": {"baseColorFactor": [0.79, 0.77, 0.70, 1], "metallicFactor": 0, "roughnessFactor": 0.83}},
            {"name": "Mint intervertebral disc", "pbrMetallicRoughness": {"baseColorFactor": [0.45, 0.70, 0.54, 1], "metallicFactor": 0, "roughnessFactor": 0.88}},
        ],
    }
    binary = bytearray()
    def accessor(values, dimensions, component, kind, target, bounds=False):
        while len(binary) % 4:
            binary.append(0)
        flat = [v for row in values for v in row] if dimensions > 1 else values
        formats = {5126: "f", 5123: "H", 5125: "I"}
        content = struct.pack("<" + formats[component] * len(flat), *flat)
        view = len(document["bufferViews"])
        document["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(content), "target": target})
        binary.extend(content)
        info = {"bufferView": view, "componentType": component, "count": len(values), "type": kind}
        if bounds:
            info["min"] = [min(v[a] for v in values) for a in range(dimensions)]
            info["max"] = [max(v[a] for v in values) for a in range(dimensions)]
        index = len(document["accessors"])
        document["accessors"].append(info)
        return index

    total_triangles = 0
    poster_faces = []
    manifest_parts = []
    for order, part in enumerate(parts):
        remap, vertices, normals, indices = {}, [], [], []
        for face in part["faces"]:
            for vi, ni in face:
                key = (vi, ni)
                if key not in remap:
                    remap[key] = len(vertices)
                    vertices.append([part["world"][vi][a] - part["center"][a] for a in range(3)])
                    normals.append(part["normals"][ni] if ni is not None else [0, 0, 1])
                indices.append(remap[key])
            triangle = [rotated(part["world"][vi]) for vi, ni in face]
            normal = rotated([sum(part["normals"][ni][a] for vi, ni in face) / 3 for a in range(3)]) if all(ni is not None for vi, ni in face) else [0, 0, 1]
            if normal[2] > -0.05:
                poster_faces.append((sum(v[2] for v in triangle) / 3, triangle, normal, part["kind"]))
        mesh_index = len(document["meshes"])
        document["meshes"].append({"name": part["name"], "primitives": [{
            "attributes": {"POSITION": accessor(vertices, 3, 5126, "VEC3", 34962, True), "NORMAL": accessor(normals, 3, 5126, "VEC3", 34962)},
            "indices": accessor(indices, 1, 5123 if len(vertices) < 65536 else 5125, "SCALAR", 34963),
            "material": 1 if part["kind"] == "disc" else 0,
        }]})
        node_index = len(document["nodes"])
        extra = {"kind": part["kind"], "sourceId": part["id"], "concept": part["concept"], "order": order}
        document["nodes"].append({"name": part["name"], "mesh": mesh_index, "translation": part["center"], "extras": extra})
        document["scenes"][0]["nodes"].append(node_index)
        total_triangles += len(indices) // 3
        manifest_parts.append({"id": part["id"], "name": part["name"], "kind": part["kind"], "triangles": len(indices) // 3})
    while len(binary) % 4:
        binary.append(0)
    document["buffers"] = [{"byteLength": len(binary)}]
    json_bytes = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode()
    json_bytes += b" " * (-len(json_bytes) % 4)
    length = 12 + 8 + len(json_bytes) + 8 + len(binary)
    output = struct.pack("<III", 0x46546C67, 2, length) + struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes + struct.pack("<II", len(binary), 0x004E4942) + binary
    model_path = OUTPUT / "spine.glb"
    model_path.write_bytes(output)

    paths = []
    for depth, triangle, normal, kind in sorted(poster_faces, key=lambda f: f[0]):
        light = max(0, normal[0] * -0.35 + normal[1] * 0.4 + normal[2] * 0.8)
        shade = 0.58 + min(1, light) * 0.42
        rgb = (181, 227, 196) if kind == "disc" else (232, 229, 216)
        color = "#" + "".join(format(round(c * shade), "02x") for c in rgb)
        coords = " ".join(f"{300 + v[0] * 255:.1f},{380 - v[1] * 255:.1f}" for v in triangle)
        paths.append('<polygon points="' + coords + '" fill="' + color + '"/>')
    poster = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 760" role="img" aria-label="BodyParts3D 척추 모델"><title>BodyParts3D 척추 모델</title>' + "".join(paths) + '</svg>'
    (ROOT / "qa/bodyparts-source/spine-poster.svg").write_text(poster)
    manifest = {
        "source": SOURCE_URL, "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "license": "CC-BY-4.0", "license_url": "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html",
        "original_header_license": "CC-BY-SA-2.1-JP",
        "modifications": ["Spinal column selection", "Coordinate rotation and normalization", "Individual pivot centering", "Ivory and mint materials", "glTF 2.0 binary export"],
        "bone_parts": bones, "disc_parts": discs, "triangles": total_triangles,
        "bytes": len(output), "sha256": hashlib.sha256(output).hexdigest(), "parts": manifest_parts,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: manifest[k] for k in ["bone_parts", "disc_parts", "triangles", "bytes", "sha256"]}, indent=2))
    print("Poster bytes:", len(poster.encode()))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    build(parser.parse_args().source)
