# 时间轴地图（docs）

交互式 Leaflet 地图，按年代筛选 `traditions/*.md` 祈福仪式条目。

## 本地打开

因浏览器对 `file://` 下 `fetch` JSON 常有限制，请在本目录启动静态服务：

```bash
cd docs
python3 -m http.server 8000
```

然后访问：<http://localhost:8000/timeline-map.html>

## 文件

- `timeline-map.html` — 地图 UI（Leaflet CDN + Carto 浅色底图）
- `map-data.json` — 由 `scripts/build_map_data.py` 从传统卡片生成

## 重建数据

在仓库根目录：

```bash
python3 scripts/build_map_data.py
```

## 年代说明

`year_start` 多为形成、首次文献或民族志记载的概略年份（BCE 为负），**不是**精确考古测年；`date_basis` 标明依据类型。地点为核心文化区近似坐标。
