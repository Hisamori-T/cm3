from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

# Jinja2に渡すデータ構造の例
data = {
    "summary": {
        "items": [
            {"code": "A", "name": "共通仮設工事", "spec": "", "unit": "式", "qty": 1.0, "price": None, "amount": 364000, "remark_val": 364000, "remark_str": ""},
            {"code": "B", "name": "直接仮設工事", "spec": "", "unit": "式", "qty": 1.0, "price": None, "amount": 430000, "remark_val": 430000, "remark_str": ""},
            # ...中略...
        ],
        "discount": -47400,
        "subtotal": 6464000,
        "tax": 646400,
        "total": 7110400
    },
    "details": [
        {
            "code": "A",
            "name": "共通仮設工事",
            "rows": [
                {"name": "準備費", "spec": "", "unit": "式", "qty": 1.0, "price": None, "amount": 30000, "remark": ""},
                {"name": "環境安全費", "spec": "安全標識、安全通路、カラーコーン等", "unit": "式", "qty": 1.0, "price": None, "amount": 5000, "remark": ""},
                {"name": "アスベスト調査費", "spec": "検体採取", "unit": "検体", "qty": 3.0, "price": 3000, "amount": 9000, "remark": ""},
                # ...中略...
            ],
            "subtotal": 364000
        }
        # C, D, E...と続く
    ]
}

# テンプレートのレンダリングとPDF出力
env = Environment(loader=FileSystemLoader('.'))
template = env.get_template('breakdown_template.html')
html_out = template.render(**data)

HTML(string=html_out).write_pdf("breakdown_output.pdf")