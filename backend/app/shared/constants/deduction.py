"""控除種別の日本語ラベル定数。deduction_service と pdf_export の両方から参照する。"""

DEDUCTION_LABEL_JA: dict[str, str] = {
    "safety_fee":        "安全協力会費",
    "materials_advance": "材料費立替",
    "parking_fee":       "駐車場代",
    "statutory_welfare": "法定福利費",
    "other":             "その他",
}
