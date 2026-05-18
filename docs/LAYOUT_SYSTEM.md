# 布局与缩放体系说明

本应用采用**单一布局体系**：设计尺寸 + 整页缩放，所有在容器内的 UI 只使用「设计像素」，由根容器统一 scale 适配视口。

---

## 1. 这套是什么

- **设计基准**：`DESKTOP_BASE_WIDTH × DESKTOP_BASE_HEIGHT`（1440×900）。所有尺寸按「在这一分辨率下的像素」来写。
- **唯一缩放**：根节点 `.container.desktop-device` 使用 CSS：
  - `width: calc(100% / var(--adaptive-ui-scale))`
  - `height: calc(100% / var(--adaptive-ui-scale))`
  - `transform: translate(-50%, -50%) scale(var(--adaptive-ui-scale))`
  - `position: fixed; top: 50%; left: 50%`
  即：逻辑上是一块 (1440/scale × 900/scale) 的画布，再整体缩放成填满视口，并始终居中。
- **唯一尺寸函数**：`designPx(n)`，即 `${n}px`。凡在 container 内的宽高、间距、字号等，只用 `designPx(n)`，**不再**使用 vw/vh 或 `calc(n / var(--adaptive-ui-scale))`。
- **全屏遮罩**（预加载、背景层）：在 container 内用 `width: 100%`、`height: 100%` 填满容器，从而随整页一起缩放、铺满视口。

JS 里根据 `window.innerWidth / DESKTOP_BASE_WIDTH` 与 `window.innerHeight / DESKTOP_BASE_HEIGHT` 算出 `--adaptive-ui-scale`，并 clamp 到 `MIN_UI_SCALE`～`MAX_UI_SCALE`，写入 `document.documentElement.style`。

---

## 2. 为什么这套是合理的

1. **单一真相来源**  
   只有「设计 px」和「一个 scale」，没有多套单位（没有「反缩放」、没有按视口再算一套）。改布局时只改 designPx 的数值即可，心智简单。

2. **行为可预期**  
   所有元素在同一坐标系里，一起被 scale。圆桌、信息卡、时间线、抽屉、按钮等比例一致，不会出现「有的跟着缩、有的不跟」的错位。

3. **和常见做法一致**  
   很多桌面/大屏工具的做法就是：在一个固定设计分辨率下做 UI，再整体缩放适配窗口。本方案就是「设计 1440×900 + 整页 scale」，易于理解和交接。

4. **维护成本低**  
   新人或后续改版只需记住：**在 container 里只用 designPx，别引入 vw/vh 或除以 scale 的 calc**。不会在「这里该用哪个单位」上纠结。

5. **与浏览器缩放兼容**  
   用户用浏览器缩放（Ctrl/Cmd + 加减）是在我们 scale 之上的再次缩放，不会破坏布局，只是整体变大变小。

---

## 3. 后续可能有哪些弊端与注意点

1. **极小窗口下可读性/可点性**  
   scale 有下限 `MIN_UI_SCALE`（0.78），窗口再小也不会再缩，可能出现横向/纵向滚动或挤在一起。若未来要支持「小窗口/平板竖屏」，可能需要：
   - 再设一个更小的 scale 下限，或
   - 在某个断点下切到另一套布局（例如信息卡、抽屉改为折叠或抽屉式），而不是继续压在同一块画布里。

2. **超宽/超扁屏的留白**  
   当前 scale 取「宽高比 scale 的较小值」，所以超宽屏上下会留黑边，超窄高屏左右会留黑边。这是刻意的「保持比例、不拉伸」；若产品希望填满无黑边，需要接受拉伸或裁切，那就得改 scale 策略或加媒体查询，会偏离「单一 scale」的单纯性。

3. **真正要做移动端时**  
   目前移动端是「暂不支持」提示页，未用这套设计尺寸。若以后要做手机/平板专用界面：
   - 要么在断点下整块换成另一套布局（另一套组件 + 另一套单位），与当前「设计 px + scale」并存但**不混用**；
   - 要么在极小视口下继续用同一 designPx + scale，但要评估字号与点击区域是否足够（见上一条）。

4. **无障碍与字号**  
   设计 px 经 scale 后，实际视觉字号会随窗口变化。若需满足「最小字号/对比度」等无障碍要求，需要在设计阶段保证在 `MIN_UI_SCALE` 下仍满足，或对关键文字单独做 min-font-size 等（会略增加复杂度）。

5. **全屏/嵌入 iframe**  
   若页面被嵌入 iframe，视口由 iframe 尺寸决定，本方案会自动适配；若需要「全屏 API」或「锁定横屏」等，需在应用层配合，与当前布局体系无冲突。

---

## 4. 实现上不要做的事

- 不要在 container 内再使用 `calc(xpx / var(--adaptive-ui-scale))` 或「反缩放」单位去试图保持某元素视觉大小不变，否则会回到多套逻辑。
- 不要在 container 内用 vw/vh 做主要尺寸（会与 scale 双重作用，难以推理）。
- 新增页面内组件时，尺寸/间距/字号统一用 `designPx(n)`；需要「占满容器」时用 `100%` 或 flex 等，而不是再算一遍视口。

---

## 5. 相关代码位置

- **Scale 计算与写入**：`App.tsx` 内 `useEffect` 中根据 `DESKTOP_BASE_*`、`MIN_UI_SCALE`、`MAX_UI_SCALE` 设置 `--adaptive-ui-scale`。
- **根容器样式**：`src/assets/styles/main.css` 中 `.container.desktop-device`。
- **设计像素**：`App.tsx` 中 `const designPx = (n: number) => \`${n}px\`;` 及所有使用处。
