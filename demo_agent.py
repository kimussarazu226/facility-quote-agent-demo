#!/usr/bin/env python3
"""
設備メンテ向け「複数社見積お試し」デモ:
  - RFQ(JSON)を読み込み
  - ベンダー一覧に「送信したことにする」（実送信はしない）
  - モック回答を取り込み、比較表を出す

本番では: メールAPI/ポータルAPI/人の承認フロー、各社フォーマットのパース、
契約・個人情報の取り扱いを別設計すること。
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


class RFQScopeItem(BaseModel):
    code: str
    description: str
    quantity: float
    unit: str


class RFQ(BaseModel):
    request_id: str
    facility: dict[str, Any]
    scope: dict[str, Any]
    contact: dict[str, Any]
    due_date: str


@dataclass
class Vendor:
    vendor_id: str
    display_name: str
    channel: str
    raw: dict[str, Any]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def build_outbound_payload(rfq: RFQ) -> dict[str, Any]:
    """各社に渡す中間表現（実際のメール本文やポータル項目は channel ごとに変換）。"""
    items = [RFQScopeItem.model_validate(x) for x in rfq.scope.get("items", [])]
    return {
        "request_id": rfq.request_id,
        "due_date": rfq.due_date,
        "facility_name": rfq.facility.get("name"),
        "items": [i.model_dump() for i in items],
        "period": rfq.scope.get("period"),
        "notes": rfq.scope.get("notes"),
    }


def fake_dispatch(vendor: Vendor, payload: dict[str, Any]) -> dict[str, Any]:
    """送信ログ（実装では SMTP / HTTP / ワークフロー連携）。"""
    rec: dict[str, Any] = {"vendor_id": vendor.vendor_id, "status": "queued"}
    if vendor.channel == "email":
        rec["to"] = vendor.raw.get("contact_email")
        rec["subject"] = f"見積依頼 {payload['request_id']} ({payload['facility_name']})"
    elif vendor.channel == "portal_mock":
        rec["portal_url"] = vendor.raw.get("portal_url")
    return rec


def mock_vendor_reply(vendor_id: str, request_id: str) -> dict[str, Any]:
    """デモ用の擬似回答（本番ではメール/HTML/PDF を LLM で構造化など）。"""
    base_lines = {
        "vendor_alpha": [
            {"line_ref": "PAC-INS-26", "unit_price_yen": 1_850_000, "quantity": 1},
            {"line_ref": "ELV-FM-26", "unit_price_yen": 520_000, "quantity": 4},
            {"line_ref": "FIRE-INS", "unit_price_yen": 380_000, "quantity": 1},
            {"line_ref": "LED-PAT", "unit_price_yen": 68_000, "quantity": 12},
        ],
        "vendor_beta": [
            {"line_ref": "PAC-INS-26", "unit_price_yen": 1_750_000, "quantity": 1},
            {"line_ref": "ELV-FM-26", "unit_price_yen": 495_000, "quantity": 4},
            {"line_ref": "FIRE-INS", "unit_price_yen": 410_000, "quantity": 1},
            {"line_ref": "LED-PAT", "unit_price_yen": 65_000, "quantity": 12},
        ],
        "ion_delight_style": [
            {"line_ref": "PAC-INS-26", "unit_price_yen": 1_800_000, "quantity": 1},
            {"line_ref": "ELV-FM-26", "unit_price_yen": 540_000, "quantity": 4},
            {"line_ref": "FIRE-INS", "unit_price_yen": 395_000, "quantity": 1},
            {"line_ref": "LED-PAT", "unit_price_yen": 71_000, "quantity": 12},
        ],
    }
    table = {
        "vendor-alpha": base_lines["vendor_alpha"],
        "vendor-beta": base_lines["vendor_beta"],
        "ion-delight-style": base_lines["ion_delight_style"],
    }
    lines = table.get(vendor_id, [])
    subtotal = sum(x["unit_price_yen"] * x["quantity"] for x in lines)
    tax = int(subtotal * 0.1)
    valid_until = {
        "vendor-alpha": "2026-06-12",
        "vendor-beta": "2026-06-08",
        "ion-delight-style": "2026-06-20",
    }.get(vendor_id, "2026-06-15")
    return {
        "vendor_id": vendor_id,
        "request_id": request_id,
        "currency": "JPY",
        "lines": lines,
        "subtotal_yen": subtotal,
        "tax_yen": tax,
        "total_yen": subtotal + tax,
        "valid_until": valid_until,
    }


def comparison_table(replies: list[dict[str, Any]]) -> str:
    rows: list[tuple[str, int, str]] = []
    for r in replies:
        rows.append((r["vendor_id"], r["total_yen"], r.get("valid_until", "")))
    rows.sort(key=lambda x: x[1])
    out = ["vendor_id", "total_yen", "valid_until"]
    lines = ["\t".join(out)]
    for vid, total, vu in rows:
        lines.append("\t".join([vid, str(total), vu]))
    return "\n".join(lines)


def main() -> int:
    root = Path(__file__).resolve().parent
    rfq_path = root / "sample_rfq.json"
    vendors_path = root / "sample_vendors.json"
    rfq = RFQ.model_validate(load_json(rfq_path))
    vendors_raw = load_json(vendors_path)

    vendors = [
        Vendor(
            vendor_id=v["vendor_id"],
            display_name=v["display_name"],
            channel=v["channel"],
            raw=v,
        )
        for v in vendors_raw
    ]

    payload = build_outbound_payload(rfq)
    print("--- 送信キュー（デモ・実送信なし）---")
    for v in vendors:
        log = fake_dispatch(v, payload)
        print(json.dumps({"payload_summary": payload, "dispatch": log}, ensure_ascii=False))

    print("\n--- 擬似回答の取り込み ---")
    replies = [mock_vendor_reply(v.vendor_id, rfq.request_id) for v in vendors]
    for r in replies:
        print(json.dumps(r, ensure_ascii=False))

    print("\n--- 総額比較（安い順）---")
    print(comparison_table(replies))

    return 0


if __name__ == "__main__":
    sys.exit(main())
