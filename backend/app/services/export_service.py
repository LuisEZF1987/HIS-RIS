from __future__ import annotations

import csv
import io
from typing import Any, List

from openpyxl import Workbook


def to_csv(headers: List[str], rows: List[List[Any]]) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    return output.getvalue().encode("utf-8-sig")


def to_excel(headers: List[str], rows: List[List[Any]], sheet_name: str = "Data") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    ws.append(headers)
    for row in rows:
        ws.append(row)
    # Auto-width
    for col in ws.columns:
        max_len = max(len(str(c.value or "")) for c in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)
    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
