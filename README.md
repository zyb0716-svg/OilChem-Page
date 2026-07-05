# 独立炼厂进口原油双向查询网页

本项目以每个月 Excel 中的 `2C炼厂加工进口原油详解` 为唯一数据源，读取第 4 行英文油种名，将第 5 行以后各炼厂非零采购数量展开成长表，单位为万吨，默认剔除名称包含“合计”的行，生成可按炼厂和油种双向查询的静态网页。

## 目录结构

```text
data/
  raw/          # 放入每月 OILCHEM Excel
  processed/    # 脚本生成的 CSV、JSON、处理日志
scripts/
  build_data.py
web/
  index.html
  app.js
  style.css
requirements.txt
README.md
```

## 安装依赖

```bash
pip install -r requirements.txt
```

如果 Windows 上 `python` 指向商店占位程序，也可以使用：

```bash
py -m pip install -r requirements.txt
```

## 更新月度 Excel

1. 将新的月度 Excel 放入 `data/raw/`。
2. 文件名需要包含月份，例如 `202605` 或 `2605`。
3. 运行：

```bash
python scripts/build_data.py
```

或：

```bash
py scripts/build_data.py
```

脚本会重新生成：

```text
data/processed/refinery_import_crude_long.csv
data/processed/refinery_import_crude_long.json
data/processed/processing_log.csv
```

## 本地打开网页

推荐从项目根目录启动一个静态服务：

```bash
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/web/
```

如果直接双击 `web/index.html`，部分浏览器会阻止读取本地 JSON。页面会显示手动选择 JSON 的入口，选择 `data/processed/refinery_import_crude_long.json` 后也可以使用。

## GitHub Pages 部署

1. 将整个项目提交到 GitHub 仓库。
2. 在仓库 Settings -> Pages 中选择部署分支。
3. Pages 根目录选择仓库根目录，或将 `web/` 作为访问入口。
4. 部署后打开 `https://<用户名>.github.io/<仓库名>/web/`。

## 数据口径

- 只读取 `2C炼厂加工进口原油详解`。
- 第 2 行为原油来源区域。
- 第 3 行为原油中文名。
- 第 4 行为原油英文名。
- 第 5 行开始为炼厂数据。
- B 列为炼厂所在地区，空值向下填充。
- C 列为炼厂名称。
- D 列为原表合计，仅用于质量检查。
- E 列开始为各进口原油油种数量。
- 数量为空、0、`-`、`--` 的单元格不生成记录。
- 英文油种名去除前后空格；英文名为空但中文名存在时，使用中文名并写入日志。
- 同一月份、同一炼厂、同一油种出现多条记录时合并求和。

## 网页功能

- 总览分析：月份、炼厂数量、油种数量、月度总量、Top 10 油种、Top 10 炼厂、来源区域结构。
- 按炼厂查询：选择炼厂后查看月度总量、油种月度矩阵、采购明细和堆叠柱状图。
- 按油种查询：选择油种后查看采购炼厂、月度总量、炼厂月度矩阵和采购明细。
- 全局筛选：月份范围、炼厂名称、油种英文名、炼厂地区、原油来源区域、合计行、非零记录。
